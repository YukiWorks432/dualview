/**
 * Video Stitching Export
 *
 * Composes multiple clips from a track into a single sequential video.
 * Uses WebCodecs API for encoding.
 */

import type { TimelineTrack, MediaFile } from '../types'
import {
  ExportResources,
  createMp4ExportEncoder,
  encodeCanvasFrame,
  seekVideoAndWait,
  throwIfAborted,
  waitForExport,
  waitForMedia,
  yieldToExport,
} from './exportResources'

export interface StitchExportSettings {
  trackId: string
  format: 'mp4' | 'gif'
  resolution: '720p' | '1080p' | '4k'
  quality: 'low' | 'medium' | 'high'
  fps: 24 | 30 | 60
  includeAudio: boolean
}

export interface StitchExportProgress {
  status: 'idle' | 'preparing' | 'encoding' | 'done' | 'error'
  progress: number // 0-100
  message: string
  currentClip: number
  totalClips: number
}

// Resolution presets
const RESOLUTIONS: Record<string, { width: number; height: number }> = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
}

// Quality to bitrate mapping
const BITRATES: Record<string, number> = {
  low: 2_000_000,
  medium: 5_000_000,
  high: 10_000_000,
}

/**
 * Create a video element from a MediaFile
 */
function createVideoElement(media: MediaFile): HTMLVideoElement {
  const video = document.createElement('video')
  video.src = media.url
  video.muted = true
  video.playsInline = true
  video.crossOrigin = 'anonymous'
  return video
}

/**
 * Export stitched video from track clips
 */
export async function exportStitchedVideo(
  track: TimelineTrack,
  getFile: (id: string) => MediaFile | undefined,
  settings: StitchExportSettings,
  onProgress: (progress: StitchExportProgress) => void,
  signal?: AbortSignal,
): Promise<Blob | null> {
  // Sort clips by start time
  const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime)

  if (sortedClips.length === 0) {
    onProgress({
      status: 'error',
      progress: 0,
      message: 'No clips to export',
      currentClip: 0,
      totalClips: 0,
    })
    return null
  }

  throwIfAborted(signal)
  if (sortedClips.some((clip) => getFile(clip.mediaId)?.playbackBackend === 'mediabunny')) {
    throw new Error(
      'Stitch export for ProRes is not supported yet. Use Image or PDF export for the current frame.',
    )
  }
  const resources = new ExportResources()
  const onAbort = () => resources.controller.abort(signal?.reason)
  signal?.addEventListener('abort', onAbort, { once: true })
  resources.defer(() => signal?.removeEventListener('abort', onAbort))
  try {
    const { width, height } = RESOLUTIONS[settings.resolution]
    const bitrate = BITRATES[settings.quality]
    const fps = settings.fps

    // Create canvas for rendering
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    // Check WebCodecs support
    if (typeof VideoEncoder === 'undefined') {
      onProgress({
        status: 'error',
        progress: 0,
        message: 'WebCodecs not supported in this browser',
        currentClip: 0,
        totalClips: sortedClips.length,
      })
      return null
    }

    onProgress({
      status: 'preparing',
      progress: 0,
      message: 'Preparing video encoder...',
      currentClip: 0,
      totalClips: sortedClips.length,
    })

    // Calculate total frames needed
    let totalDuration = 0
    for (const clip of sortedClips) {
      totalDuration += clip.outPoint - clip.inPoint
    }
    const totalFrames = Math.ceil(totalDuration * fps)

    const { muxer, encoder } = await createMp4ExportEncoder(resources)

    encoder.configure({
      codec: 'avc1.640028',
      width,
      height,
      bitrate,
      framerate: fps,
    })

    onProgress({
      status: 'encoding',
      progress: 0,
      message: 'Encoding clips...',
      currentClip: 1,
      totalClips: sortedClips.length,
    })

    let globalFrameIndex = 0
    const frameDuration = 1 / fps

    // Process each clip
    for (let clipIndex = 0; clipIndex < sortedClips.length; clipIndex++) {
      throwIfAborted(resources.signal)
      const clip = sortedClips[clipIndex]
      const media = getFile(clip.mediaId)

      if (!media) {
        console.warn(`Media not found for clip ${clip.id}`)
        continue
      }

      onProgress({
        status: 'encoding',
        progress: Math.round((clipIndex / sortedClips.length) * 100),
        message: `Processing clip ${clipIndex + 1}/${sortedClips.length}: ${media.name}`,
        currentClip: clipIndex + 1,
        totalClips: sortedClips.length,
      })

      // Handle different media types
      if (media.type === 'video') {
        // Create video element for this clip
        const video = createVideoElement(media)
        try {
          if (video.readyState < 2) {
            await waitForMedia(video, 'canplay', () => video.load(), resources.signal)
          }

          // Calculate clip duration and frames
          const clipDuration = clip.outPoint - clip.inPoint
          const clipFrames = Math.ceil(clipDuration * fps)

          // Process each frame of the clip
          for (let frameInClip = 0; frameInClip < clipFrames; frameInClip++) {
            throwIfAborted(resources.signal)
            if (frameInClip % 3 === 0) await yieldToExport(resources.signal)
            // Calculate source time in video
            const sourceTime = clip.inPoint + frameInClip * frameDuration

            // Seek video
            await seekVideoAndWait(video, sourceTime, resources.signal)

            // Draw to canvas with aspect ratio correction
            ctx.fillStyle = '#000'
            ctx.fillRect(0, 0, width, height)

            // Calculate scaled dimensions maintaining aspect ratio
            const videoAspect = video.videoWidth / video.videoHeight
            const canvasAspect = width / height
            let drawWidth = width
            let drawHeight = height
            let drawX = 0
            let drawY = 0

            if (videoAspect > canvasAspect) {
              drawHeight = width / videoAspect
              drawY = (height - drawHeight) / 2
            } else {
              drawWidth = height * videoAspect
              drawX = (width - drawWidth) / 2
            }

            ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight)

            encodeCanvasFrame(encoder, canvas, globalFrameIndex, fps)

            globalFrameIndex++

            // Update progress
            const overallProgress = Math.round(
              ((clipIndex + frameInClip / clipFrames) / sortedClips.length) * 100,
            )
            onProgress({
              status: 'encoding',
              progress: overallProgress,
              message: `Encoding frame ${globalFrameIndex}/${totalFrames}`,
              currentClip: clipIndex + 1,
              totalClips: sortedClips.length,
            })
          }
        } finally {
          video.pause()
          video.removeAttribute('src')
          video.load()
        }
      } else if (media.type === 'image') {
        // Load image
        const img = new Image()
        img.crossOrigin = 'anonymous'
        try {
          await waitForMedia(
            img,
            'load',
            () => {
              img.src = media.url
            },
            resources.signal,
          )

          // Calculate clip duration (use outPoint - inPoint, or default to 5 seconds)
          const clipDuration = clip.outPoint - clip.inPoint
          const clipFrames = Math.ceil(clipDuration * fps)

          // Draw image for duration
          for (let frameInClip = 0; frameInClip < clipFrames; frameInClip++) {
            throwIfAborted(resources.signal)
            if (frameInClip % 3 === 0) await yieldToExport(resources.signal)
            // Draw to canvas with aspect ratio correction
            ctx.fillStyle = '#000'
            ctx.fillRect(0, 0, width, height)

            const imgAspect = img.width / img.height
            const canvasAspect = width / height
            let drawWidth = width
            let drawHeight = height
            let drawX = 0
            let drawY = 0

            if (imgAspect > canvasAspect) {
              drawHeight = width / imgAspect
              drawY = (height - drawHeight) / 2
            } else {
              drawWidth = height * imgAspect
              drawX = (width - drawWidth) / 2
            }

            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

            encodeCanvasFrame(encoder, canvas, globalFrameIndex, fps)

            globalFrameIndex++
          }
        } finally {
          img.removeAttribute('src')
        }
      }
    }

    // Flush encoder
    await waitForExport(encoder.flush(), resources.signal)

    // Finalize muxer
    const buffer = await waitForExport(muxer.finalize(), resources.signal)
    throwIfAborted(resources.signal)

    onProgress({
      status: 'done',
      progress: 100,
      message: 'Export complete!',
      currentClip: sortedClips.length,
      totalClips: sortedClips.length,
    })

    // Create blob
    return new Blob([buffer], { type: 'video/mp4' })
  } finally {
    await resources.dispose()
  }
}

/**
 * Download the exported blob
 */
export function downloadStitchedVideo(blob: Blob, filename: string = 'stitched-video.mp4'): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Get track export info
 */
export function getTrackExportInfo(
  track: TimelineTrack,
  getFile: (id: string) => MediaFile | undefined,
): {
  totalDuration: number
  clipCount: number
  clips: Array<{ name: string; duration: number; type: string }>
} {
  const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime)

  let totalDuration = 0
  const clips: Array<{ name: string; duration: number; type: string }> = []

  for (const clip of sortedClips) {
    const media = getFile(clip.mediaId)
    const duration = clip.outPoint - clip.inPoint
    totalDuration += duration

    clips.push({
      name: media?.name || 'Unknown',
      duration,
      type: media?.type || 'unknown',
    })
  }

  return {
    totalDuration,
    clipCount: sortedClips.length,
    clips,
  }
}
