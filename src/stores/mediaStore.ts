import { create } from 'zustand'

import { getDocumentType, parseDocument, generateDocumentThumbnail } from '../lib/documentParser'
import { isLikelyVideoFile } from '../lib/media/fileTypes'
import { probeVideoFile } from '../lib/media/prores'
import { generateId } from '../lib/utils'
import type { MediaFile, MediaType } from '../types'
import { useTimelineStore } from './timelineStore'

interface MediaStore {
  files: MediaFile[]
  selectedIds: string[]

  addFile: (file: File) => Promise<MediaFile>
  addPrompt: (promptText: string, name?: string) => Promise<MediaFile>
  removeFile: (id: string) => void
  selectFile: (id: string) => void
  deselectFile: (id: string) => void
  clearSelection: () => void
  getFile: (id: string) => MediaFile | undefined
  clearFiles: () => void
  // MEDIA-012: Status management
  updateStatus: (id: string, status: MediaFile['status'], message?: string) => void
  retryProcessing: (id: string) => Promise<void>
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

  // Detect file type including containers whose browser-provided MIME type may be empty.
  const extension = file.name.toLowerCase().split('.').pop()
  const isModel = extension === 'glb' || extension === 'gltf'
  const documentType = getDocumentType(file.name)

  const type: MediaType = documentType
    ? documentType
    : isModel
      ? 'model'
      : isLikelyVideoFile(file)
        ? 'video'
        : file.type.startsWith('image/')
          ? 'image'
          : 'audio'

  const mediaFile: MediaFile = {
    id,
    name: file.name,
    type,
    url,
    file,
    status: 'processing',
    processingProgress: 0,
  }

  // Get video/image dimensions and duration.
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
      if (probeError instanceof Error) {
        throw new Error(`${probeError.message}; ${(nativeError as Error).message}`)
      }
      throw nativeError
    }
  } else if (type === 'image') {
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
  } else if (type === 'audio') {
    const audio = document.createElement('audio')
    audio.src = url
    audio.preload = 'metadata'

    await new Promise<void>((resolve, reject) => {
      audio.onloadedmetadata = () => {
        mediaFile.duration = audio.duration
        resolve()
      }
      audio.onerror = () => reject(new Error('The browser could not decode this audio file'))
    })

    // TL-006: Extract waveform peaks for timeline preview
    try {
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      const audioContext = new AudioContext()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

      // Get channel data
      const channelData = audioBuffer.getChannelData(0)
      const samples = 100 // Number of peaks for timeline preview
      const blockSize = Math.floor(channelData.length / samples)
      const peaks: number[] = []

      for (let i = 0; i < samples; i++) {
        const start = i * blockSize
        let max = 0

        for (let j = 0; j < blockSize; j++) {
          const value = Math.abs(channelData[start + j] || 0)
          if (value > max) max = value
        }

        peaks.push(max)
      }

      audioContext.close()
      mediaFile.waveformPeaks = peaks
    } catch (error) {
      console.warn('Failed to extract waveform:', error)
    }
  } else if (type === 'model') {
    // Set default duration for 3D models (5 seconds = one full rotation)
    mediaFile.duration = 5

    // Generate thumbnail for 3D model only when a model is actually imported.
    try {
      const { generateModelThumbnail } = await import('../lib/modelThumbnail')
      const thumbnail = await generateModelThumbnail(url)
      if (thumbnail) {
        mediaFile.thumbnail = thumbnail
      }
    } catch (error) {
      console.warn('Failed to generate model thumbnail:', error)
    }
  } else if (type === 'csv' || type === 'excel' || type === 'docx' || type === 'pdf') {
    // Parse document and extract metadata
    try {
      const documentMeta = await parseDocument(file)
      if (documentMeta) {
        mediaFile.documentMeta = documentMeta
      }
      // Generate document thumbnail
      mediaFile.thumbnail = generateDocumentThumbnail(type)
      // Documents don't have duration, set a default for timeline
      mediaFile.duration = 10
    } catch (error) {
      console.warn('Failed to parse document:', error)
    }
  }

  // MEDIA-012: Mark as ready after all processing
  mediaFile.status = 'ready'
  mediaFile.processingProgress = 100

  return mediaFile
}

export const useMediaStore = create<MediaStore>((set, get) => ({
  files: [],
  selectedIds: [],

  addFile: async (file: File) => {
    // MEDIA-012: Create pending entry first
    const pendingId = generateId()

    // Detect file type including 3D models and documents (same logic as processFile)
    const extension = file.name.toLowerCase().split('.').pop()
    const isModel = extension === 'glb' || extension === 'gltf'
    const documentType = getDocumentType(file.name)
    const pendingType: MediaType = documentType
      ? documentType
      : isModel
        ? 'model'
        : isLikelyVideoFile(file)
          ? 'video'
          : file.type.startsWith('image/')
            ? 'image'
            : file.type.startsWith('audio/')
              ? 'audio'
              : 'model'

    const pendingFile: MediaFile = {
      id: pendingId,
      name: file.name,
      type: pendingType,
      url: '',
      file,
      status: 'pending',
      processingProgress: 0,
    }

    set((state) => ({
      files: [...state.files, pendingFile],
    }))

    // Update status to processing
    set((state) => ({
      files: state.files.map((f) =>
        f.id === pendingId ? { ...f, status: 'processing' as const, processingProgress: 10 } : f,
      ),
    }))

    try {
      const mediaFile = await processFile(file)
      // Replace pending with processed file, keeping the pending ID
      set((state) => ({
        files: state.files.map((f) => (f.id === pendingId ? { ...mediaFile, id: pendingId } : f)),
      }))
      return { ...mediaFile, id: pendingId }
    } catch (error) {
      // MEDIA-012: Mark as error
      set((state) => ({
        files: state.files.map((f) =>
          f.id === pendingId
            ? {
                ...f,
                status: 'error' as const,
                statusMessage: error instanceof Error ? error.message : 'Processing failed',
              }
            : f,
        ),
      }))
      throw error
    }
  },

  addPrompt: async (promptText: string, name?: string) => {
    const id = generateId()
    const fileName = name || `prompt-${Date.now()}.txt`
    const file = new File([promptText], fileName, { type: 'text/plain' })
    const url = URL.createObjectURL(file)

    const mediaFile: MediaFile = {
      id,
      name: fileName,
      type: 'prompt',
      url,
      file,
      promptText,
      status: 'ready', // MEDIA-012: Prompts are immediately ready
    }

    set((state) => ({
      files: [...state.files, mediaFile],
    }))

    return mediaFile
  },

  removeFile: (id: string) => {
    const file = get().files.find((f) => f.id === id)
    if (file) {
      URL.revokeObjectURL(file.url)
    }

    // Cascade delete: remove all clips using this media from the timeline
    useTimelineStore.getState().removeClipsByMediaId(id)

    set((state) => ({
      files: state.files.filter((f) => f.id !== id),
      selectedIds: state.selectedIds.filter((i) => i !== id),
    }))
  },

  selectFile: (id: string) => {
    set((state) => ({
      selectedIds: state.selectedIds.includes(id) ? state.selectedIds : [...state.selectedIds, id],
    }))
  },

  deselectFile: (id: string) => {
    set((state) => ({
      selectedIds: state.selectedIds.filter((i) => i !== id),
    }))
  },

  clearSelection: () => {
    set({ selectedIds: [] })
  },

  getFile: (id: string) => {
    return get().files.find((f) => f.id === id)
  },

  clearFiles: () => {
    // Revoke all blob URLs
    get().files.forEach((file) => {
      if (file.url.startsWith('blob:')) {
        URL.revokeObjectURL(file.url)
      }
    })
    set({ files: [], selectedIds: [] })
  },

  // MEDIA-012: Update file status
  updateStatus: (id: string, status: MediaFile['status'], message?: string) => {
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, status, statusMessage: message } : f)),
    }))
  },

  // MEDIA-012: Retry failed processing
  retryProcessing: async (id: string) => {
    const file = get().files.find((f) => f.id === id)
    if (!file || file.status !== 'error') return

    // Mark as pending
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id
          ? { ...f, status: 'pending' as const, statusMessage: undefined, processingProgress: 0 }
          : f,
      ),
    }))

    try {
      const newMediaFile = await processFile(file.file)
      set((state) => ({
        files: state.files.map((f) =>
          f.id === id
            ? { ...newMediaFile, id } // Keep original ID
            : f,
        ),
      }))
    } catch (error) {
      set((state) => ({
        files: state.files.map((f) =>
          f.id === id
            ? {
                ...f,
                status: 'error' as const,
                statusMessage: error instanceof Error ? error.message : 'Retry failed',
              }
            : f,
        ),
      }))
    }
  },
}))
