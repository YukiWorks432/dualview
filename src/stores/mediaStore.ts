import { create } from 'zustand'

import { clearFilmstripCache } from '../lib/filmstripExtractor'
import { detachFile } from '../lib/media/detachFile'
import { getSupportedMediaType } from '../lib/media/fileTypes'
import { captureMediaImport, invalidateMediaImports } from '../lib/media/importRequest'
import { probeVideoFile } from '../lib/media/prores'
import { generateId } from '../lib/utils'
import type { MediaFile } from '../types'
import { useTimelineStore } from './timelineStore'

interface MediaStore {
  files: MediaFile[]
  selectedIds: string[]

  addFile: (file: File, signal?: AbortSignal) => Promise<MediaFile | null>
  removeFile: (id: string) => void
  selectFile: (id: string) => void
  deselectFile: (id: string) => void
  clearSelection: () => void
  getFile: (id: string) => MediaFile | undefined
  clearFiles: () => void
  updateStatus: (id: string, status: MediaFile['status'], message?: string) => void
  retryProcessing: (id: string) => Promise<void>
}

async function loadNativeVideo(url: string, signal?: AbortSignal): Promise<HTMLVideoElement> {
  signal?.throwIfAborted()
  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('loadeddata', handleLoaded)
      video.removeEventListener('error', handleError)
      signal?.removeEventListener('abort', handleAbort)
    }
    const fail = (error: unknown) => {
      cleanup()
      video.removeAttribute('src')
      video.load()
      reject(error)
    }
    const handleLoaded = () => {
      cleanup()
      resolve()
    }
    const handleError = () => fail(new Error('The browser could not decode this video'))
    const handleAbort = () => fail(signal!.reason)
    video.addEventListener('loadeddata', handleLoaded, { once: true })
    video.addEventListener('error', handleError, { once: true })
    signal?.addEventListener('abort', handleAbort, { once: true })
    video.src = url
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) handleLoaded()
  })

  return video
}

function createVideoThumbnail(video: HTMLVideoElement): string | undefined {
  if (video.videoWidth === 0 || video.videoHeight === 0) return undefined

  const canvas = document.createElement('canvas')
  canvas.width = 160
  canvas.height = Math.max(1, Math.round((160 * video.videoHeight) / video.videoWidth))
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.7)
}

// Prepare resources without publishing them to the active media library.
export async function prepareMediaFile(file: File, signal?: AbortSignal): Promise<MediaFile> {
  signal?.throwIfAborted()
  const type = getSupportedMediaType(file)
  if (!type) throw new Error('DualView only accepts image and video files')

  const id = generateId()
  const url = URL.createObjectURL(file)
  const mediaFile: MediaFile = {
    id,
    name: file.name,
    type,
    url,
    file,
    status: 'processing',
    processingProgress: 0,
  }

  try {
    if (type === 'video') {
      let probeError: unknown = null

      try {
        const probe = await probeVideoFile(file, signal)
        signal?.throwIfAborted()
        mediaFile.videoCodec = probe.codec ?? undefined
        mediaFile.playbackBackend = probe.codec === 'prores' ? 'mediabunny' : 'native'
        mediaFile.hasAlpha = probe.hasAlpha
        mediaFile.duration = probe.duration
        mediaFile.width = probe.width
        mediaFile.height = probe.height
        mediaFile.thumbnail = probe.thumbnail

        if (probe.codec === 'prores') {
          if (!probe.decodable) {
            throw new Error('This ProRes stream could not be decoded')
          }

          mediaFile.status = 'ready'
          mediaFile.processingProgress = 100
          return mediaFile
        }
      } catch (error) {
        signal?.throwIfAborted()
        probeError = error
        console.warn('Mediabunny video probe failed; falling back to native video metadata:', error)
      }

      try {
        const video = await loadNativeVideo(url, signal)
        try {
          signal?.throwIfAborted()
          mediaFile.playbackBackend = 'native'
          mediaFile.duration = mediaFile.duration ?? video.duration
          mediaFile.width = mediaFile.width ?? video.videoWidth
          mediaFile.height = mediaFile.height ?? video.videoHeight
          mediaFile.thumbnail = createVideoThumbnail(video)
        } finally {
          video.removeAttribute('src')
          video.load()
        }
      } catch (nativeError) {
        if (probeError instanceof Error) {
          throw new Error(`${probeError.message}; ${(nativeError as Error).message}`)
        }
        throw nativeError
      }
    } else {
      const img = new Image()
      let handleAbort: (() => void) | undefined
      try {
        await new Promise<void>((resolve, reject) => {
          handleAbort = () => reject(signal!.reason)
          signal?.addEventListener('abort', handleAbort, { once: true })
          img.onload = () => {
            try {
              signal?.throwIfAborted()
              mediaFile.width = img.naturalWidth
              mediaFile.height = img.naturalHeight
              const canvas = document.createElement('canvas')
              canvas.width = 160
              canvas.height = 90
              const ctx = canvas.getContext('2d')
              if (ctx) {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
                mediaFile.thumbnail = canvas.toDataURL('image/jpeg', 0.7)
              }
              resolve()
            } catch (error) {
              reject(error)
            }
          }
          img.onerror = () => reject(new Error('The browser could not decode this image'))
          img.src = url
        })
      } finally {
        if (handleAbort) signal?.removeEventListener('abort', handleAbort)
        img.onload = null
        img.onerror = null
        img.src = ''
      }
    }
    signal?.throwIfAborted()

    mediaFile.status = 'ready'
    mediaFile.processingProgress = 100
    return mediaFile
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

// 要求ごとの所有権を確認してから採用する。削除・再試行・プロジェクト切替で失効する。
const processing = new Map<string, AbortController>()

async function processMedia(
  id: string,
  file: File,
  signal: AbortSignal,
): Promise<MediaFile | null> {
  processing.get(id)?.abort()
  const controller = new AbortController()
  processing.set(id, controller)
  const request = AbortSignal.any([signal, controller.signal])
  const isCurrent = () =>
    !request.aborted &&
    processing.get(id) === controller &&
    useMediaStore.getState().getFile(id)?.file === file
  let prepared: MediaFile | undefined
  try {
    prepared = await prepareMediaFile(file, request)
    if (!isCurrent()) return null
    const adopted = { ...prepared, id }
    const previous = useMediaStore.getState().getFile(id)
    useMediaStore.setState((state) => ({
      files: state.files.map((item) => (item.id === id ? adopted : item)),
    }))
    if (previous?.url && previous.url !== adopted.url) URL.revokeObjectURL(previous.url)
    prepared = undefined
    // 同期購読側が採用直後に削除する場合も、呼出側へ成功を返さない。
    return isCurrent() && useMediaStore.getState().getFile(id) === adopted ? adopted : null
  } catch (error) {
    if (!isCurrent()) return null
    useMediaStore.setState((state) => ({
      files: state.files.map((item) =>
        item.id === id
          ? {
              ...item,
              status: 'error' as const,
              statusMessage: error instanceof Error ? error.message : 'Processing failed',
            }
          : item,
      ),
    }))
    throw error
  } finally {
    if (prepared) URL.revokeObjectURL(prepared.url)
    const remaining = useMediaStore.getState().getFile(id)
    if (
      request.aborted &&
      processing.get(id) === controller &&
      remaining?.file === file &&
      remaining.status === 'processing'
    ) {
      useMediaStore.getState().removeFile(id)
    }
    if (processing.get(id) === controller) processing.delete(id)
  }
}

export const useMediaStore = create<MediaStore>((set, get) => ({
  files: [],
  selectedIds: [],

  addFile: async (source: File, context?: AbortSignal) => {
    const signal = captureMediaImport(context)
    if (signal.aborted) return null
    const type = getSupportedMediaType(source)
    if (!type) throw new Error('DualView only accepts image and video files')
    let file: File
    try {
      file = await detachFile(source, signal)
    } catch (error) {
      if (signal.aborted) return null
      throw error
    }
    if (signal.aborted) return null
    const id = generateId()
    set((state) => ({
      files: [
        ...state.files,
        {
          id,
          name: file.name,
          type,
          url: '',
          file,
          status: 'processing',
          processingProgress: 10,
        },
      ],
    }))
    if (signal.aborted || !get().getFile(id)) return null
    return processMedia(id, file, signal)
  },

  removeFile: (id: string) => {
    processing.get(id)?.abort()
    clearFilmstripCache(id)
    const file = get().files.find((item) => item.id === id)
    if (file?.url) URL.revokeObjectURL(file.url)

    useTimelineStore.getState().removeClipsByMediaId(id)

    set((state) => ({
      files: state.files.filter((item) => item.id !== id),
      selectedIds: state.selectedIds.filter((selectedId) => selectedId !== id),
    }))
  },

  selectFile: (id: string) => {
    set((state) => ({
      selectedIds: state.selectedIds.includes(id) ? state.selectedIds : [...state.selectedIds, id],
    }))
  },

  deselectFile: (id: string) => {
    set((state) => ({
      selectedIds: state.selectedIds.filter((selectedId) => selectedId !== id),
    }))
  },

  clearSelection: () => set({ selectedIds: [] }),

  getFile: (id: string) => get().files.find((item) => item.id === id),

  clearFiles: () => {
    invalidateMediaImports()
    get().files.forEach((file) => {
      if (file.url.startsWith('blob:')) URL.revokeObjectURL(file.url)
      useTimelineStore.getState().removeClipsByMediaId(file.id)
    })
    set({ files: [], selectedIds: [] })
  },

  updateStatus: (id: string, status: MediaFile['status'], message?: string) => {
    set((state) => ({
      files: state.files.map((item) =>
        item.id === id ? { ...item, status, statusMessage: message } : item,
      ),
    }))
  },

  retryProcessing: async (id: string) => {
    const file = get().getFile(id)
    if (!file || file.status !== 'error') return
    const signal = captureMediaImport()
    set((state) => ({
      files: state.files.map((item) =>
        item.id === id
          ? {
              ...item,
              status: 'processing' as const,
              statusMessage: undefined,
              processingProgress: 10,
            }
          : item,
      ),
    }))
    try {
      await processMedia(id, file.file, signal)
    } catch {
      // 失敗状態は共通の採用処理で更新する。
    }
  },
}))

// プロジェクト読込はsetStateで一覧を置換するため、その経路も同じ資源境界に含める。
useMediaStore.subscribe((state, previous) => {
  if (state.files === previous.files) return
  for (const file of previous.files) {
    const current = state.files.find((item) => item.id === file.id)
    if (!current || current.file !== file.file) {
      processing.get(file.id)?.abort()
    }
    if (!current || current.file !== file.file || current.url !== file.url) {
      clearFilmstripCache(file.id)
    }
  }
})

export function isMediaImportCurrent(
  media: MediaFile | null,
  signal: AbortSignal,
): media is MediaFile {
  return !signal.aborted && media !== null && useMediaStore.getState().getFile(media.id) === media
}
