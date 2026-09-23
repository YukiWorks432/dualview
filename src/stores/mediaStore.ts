import { create } from 'zustand'

import { isLikelyVideoFile } from '../lib/media/fileTypes'
import { probeVideoFile } from '../lib/media/prores'
import { generateId } from '../lib/utils'
import type { MediaFile } from '../types'
import { useTimelineStore } from './timelineStore'

interface MediaStore {
  files: MediaFile[]
  selectedIds: string[]

  addFile: (file: File) => Promise<MediaFile>
  removeFile: (id: string) => void
  selectFile: (id: string) => void
  deselectFile: (id: string) => void
  clearSelection: () => void
  getFile: (id: string) => MediaFile | undefined
  clearFiles: () => void
  updateStatus: (id: string, status: MediaFile['status'], message?: string) => void
  retryProcessing: (id: string) => Promise<void>
}

type SupportedMediaType = 'video' | 'image'

function getSupportedMediaType(file: File): SupportedMediaType {
  if (isLikelyVideoFile(file)) return 'video'
  if (file.type.startsWith('image/')) return 'image'
  throw new Error('DualView only accepts image and video files')
}

async function loadNativeVideo(url: string): Promise<HTMLVideoElement> {
  const video = document.createElement('video')
  video.src = url
  video.preload = 'auto'
  video.muted = true

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('loadeddata', handleLoaded)
      video.removeEventListener('error', handleError)
    }
    const handleLoaded = () => {
      cleanup()
      resolve()
    }
    const handleError = () => {
      cleanup()
      reject(new Error('The browser could not decode this video'))
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      resolve()
      return
    }

    video.addEventListener('loadeddata', handleLoaded, { once: true })
    video.addEventListener('error', handleError, { once: true })
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

async function processFile(file: File): Promise<MediaFile> {
  const id = generateId()
  const url = URL.createObjectURL(file)
  const type = getSupportedMediaType(file)

  const mediaFile: MediaFile = {
    id,
    name: file.name,
    type,
    url,
    file,
    status: 'processing',
    processingProgress: 0,
  }

  if (type === 'video') {
    let probeError: unknown = null

    try {
      const probe = await probeVideoFile(file)
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
      probeError = error
      console.warn('Mediabunny video probe failed; falling back to native video metadata:', error)
    }

    try {
      const video = await loadNativeVideo(url)
      mediaFile.playbackBackend = 'native'
      mediaFile.duration = mediaFile.duration ?? video.duration
      mediaFile.width = mediaFile.width ?? video.videoWidth
      mediaFile.height = mediaFile.height ?? video.videoHeight
      mediaFile.thumbnail = createVideoThumbnail(video)
    } catch (nativeError) {
      URL.revokeObjectURL(url)
      if (probeError instanceof Error) {
        throw new Error(`${probeError.message}; ${(nativeError as Error).message}`)
      }
      throw nativeError
    }
  } else {
    const img = new Image()
    img.src = url
    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
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
      }
      img.onerror = () => reject(new Error('The browser could not decode this image'))
    })
  }

  mediaFile.status = 'ready'
  mediaFile.processingProgress = 100
  return mediaFile
}

export const useMediaStore = create<MediaStore>((set, get) => ({
  files: [],
  selectedIds: [],

  addFile: async (file: File) => {
    const pendingId = generateId()
    const pendingType = getSupportedMediaType(file)

    const pendingFile: MediaFile = {
      id: pendingId,
      name: file.name,
      type: pendingType,
      url: '',
      file,
      status: 'pending',
      processingProgress: 0,
    }

    set((state) => ({ files: [...state.files, pendingFile] }))
    set((state) => ({
      files: state.files.map((item) =>
        item.id === pendingId
          ? { ...item, status: 'processing' as const, processingProgress: 10 }
          : item,
      ),
    }))

    try {
      const mediaFile = await processFile(file)
      set((state) => ({
        files: state.files.map((item) =>
        item.id === pendingId ? { ...mediaFile, id: pendingId } : item,
      ),
      }))
      return { ...mediaFile, id: pendingId }
    } catch (error) {
      set((state) => ({
        files: state.files.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                status: 'error' as const,
                statusMessage: error instanceof Error ? error.message : 'Processing failed',
              }
            : item,
        ),
      }))
      throw error
    }
  },

  removeFile: (id: string) => {
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
    get().files.forEach((file) => {
      if (file.url.startsWith('blob:')) URL.revokeObjectURL(file.url)
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
    const file = get().files.find((item) => item.id === id)
    if (!file || file.status !== 'error') return

    set((state) => ({
      files: state.files.map((item) =>
        item.id === id
          ? { ...item, status: 'pending' as const, statusMessage: undefined, processingProgress: 0 }
          : item,
      ),
    }))

    try {
      const newMediaFile = await processFile(file.file)
      set((state) => ({
        files: state.files.map((item) => (item.id === id ? { ...newMediaFile, id } : item)),
      }))
    } catch (error) {
      set((state) => ({
        files: state.files.map((item) =>
          item.id === id
            ? {
                ...item,
                status: 'error' as const,
                statusMessage: error instanceof Error ? error.message : 'Retry failed',
              }
            : item,
        ),
      }))
    }
  },
}))
