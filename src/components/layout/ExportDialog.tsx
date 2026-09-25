import { useCallback, useMemo, useRef, useState } from 'react'

import { GIF_PRESETS } from '../../lib/gifEncoder'
import {
  getVisualFrameDimensions,
  isVisualFrameReady,
  type VisualFrameElement,
} from '../../lib/media/frameSource'
import { findDisplayedClip } from '../../lib/media/timeline'
import { isWebCodecsSupported } from '../../lib/mp4Encoder'
import { createAvcMp4Muxer } from '../../lib/mp4Muxer'
import {
  captureCanvasScreenshot,
  downloadBlob,
  generatePDFReport,
} from '../../lib/screenshotExport'
import {
  exportStitchedVideo,
  downloadStitchedVideo,
  getTrackExportInfo,
  type StitchExportProgress,
} from '../../lib/stitchExport'
import { downloadVideo } from '../../lib/sweepExport'
import {
  getAllEngines,
  getAllVariants,
  getShader,
  getTotalShaderCount,
} from '../../lib/webgl/shaders'
import { WebGLTransitionRenderer } from '../../lib/webgl/WebGLTransitionRenderer'
import { useMediaStore } from '../../stores/mediaStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useProjectStore } from '../../stores/projectStore'
import { useTimelineStore } from '../../stores/timelineStore'
import type { SweepStyle, TransitionEngine, TransitionExportMode } from '../../types'
import { ExportModeTabs, type ExportMode } from '../export/ExportModeTabs'
import { ExportReadiness } from '../export/ExportReadiness'
import { PdfExportPanel } from '../export/PdfExportPanel'
import {
  ScreenshotExportPanel,
  type ScreenshotFormat,
  type ScreenshotResolution,
  type ScreenshotSource,
} from '../export/ScreenshotExportPanel'
import {
  StitchExportPanel,
  type StitchFps,
  type StitchQuality,
  type StitchResolution,
  type StitchTrackOption,
} from '../export/StitchExportPanel'
import {
  TransitionExportPanel,
  type TransitionExportFormat,
  type TransitionExportQuality,
} from '../export/TransitionExportPanel'
import { VideoExportPanel } from '../export/VideoExportPanel'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui'

interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  captureFrame: (options?: { width?: number; height?: number }) => HTMLCanvasElement | null
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

export function ExportDialog({ isOpen, onClose, canvasRef, captureFrame }: ExportDialogProps) {
  const {
    exportSettings,
    setExportSettings,
    exportProgress,
    setExportProgress,
    comparisonMode,
    metricsSSIM,
    metricsPSNR,
    setSliderPosition,
  } = useProjectStore()
  const [exportMode, setExportMode] = useState<ExportMode>('video')
  const [screenshotFormat, setScreenshotFormat] = useState<ScreenshotFormat>('png')
  const [screenshotResolution, setScreenshotResolution] = useState<ScreenshotResolution>('1080p')
  const [screenshotSource, setScreenshotSource] = useState<ScreenshotSource>('comparison')
  const [screenshotQuality, setScreenshotQuality] = useState(95)
  const [isExporting, setIsExporting] = useState(false)
  const [isExportingScreenshot, setIsExportingScreenshot] = useState(false)
  const [isExportingPDF, setIsExportingPDF] = useState(false)
  const [pdfTitle, setPdfTitle] = useState('DualView Comparison Report')
  const [includeMetadata, setIncludeMetadata] = useState(true)
  const [includeSettings, setIncludeSettings] = useState(true)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Transition export settings
  const [isExportingTransition, setIsExportingTransition] = useState(false)
  const [transitionEngine, setTransitionEngine] = useState<TransitionEngine>('crossfade')
  const [transitionVariant, setTransitionVariant] = useState('crossfade')
  const [transitionDuration, setTransitionDuration] = useState(1.5)
  const [transitionIntensity, setTransitionIntensity] = useState(1.0)
  const [transitionExportMode, setTransitionExportMode] =
    useState<TransitionExportMode>('sequential')
  const [transitionFormat, setTransitionFormat] = useState<TransitionExportFormat>('mp4')
  const [transitionQuality, setTransitionQuality] = useState<TransitionExportQuality>('medium')
  // Stitch export settings
  const [isExportingStitch, setIsExportingStitch] = useState(false)
  const [stitchTrackId, setStitchTrackId] = useState<string>('track-a')
  const [stitchResolution, setStitchResolution] = useState<StitchResolution>('1080p')
  const [stitchQuality, setStitchQuality] = useState<StitchQuality>('medium')
  const [stitchFps, setStitchFps] = useState<StitchFps>(30)
  const [stitchProgress, setStitchProgress] = useState<StitchExportProgress>({
    status: 'idle',
    progress: 0,
    message: '',
    currentClip: 0,
    totalClips: 0,
  })
  const { getFile } = useMediaStore()
  const { tracks, duration } = useTimelineStore()
  const { currentTime, setExporting } = usePlaybackStore()
  const exportLockRef = useRef(false)

  const isAnyExporting =
    isExporting ||
    isExportingScreenshot ||
    isExportingPDF ||
    isExportingTransition ||
    isExportingStitch

  const acquireExportLock = useCallback(() => {
    if (exportLockRef.current) return false
    exportLockRef.current = true
    return true
  }, [])

  const releaseExportLock = useCallback(() => {
    exportLockRef.current = false
  }, [])

  const handleClose = useCallback(() => {
    if (!exportLockRef.current && !isAnyExporting) {
      onClose()
    }
  }, [isAnyExporting, onClose])

  const stitchTrackOptions = useMemo<StitchTrackOption[]>(
    () =>
      tracks
        .filter((track) => track.type === 'a' || track.type === 'b')
        .map((track) => {
          const info = getTrackExportInfo(track, getFile)
          return {
            id: track.id,
            name: track.name,
            type: track.type as 'a' | 'b',
            clipCount: info.clipCount,
            totalDuration: info.totalDuration,
            clips: info.clips.map((clip) => ({
              name: clip.name,
              duration: clip.duration,
            })),
          }
        }),
    [tracks, getFile],
  )

  const getVisualElements = () => {
    const container = canvasRef.current?.parentElement?.parentElement
    if (!container) return { mediaA: null, mediaB: null }

    const findReadySurface = (track: 'a' | 'b'): VisualFrameElement | null => {
      const selector = `video[data-track="${track}"], img[data-track="${track}"], canvas[data-track="${track}"]`
      const elements = Array.from(container.querySelectorAll(selector)) as VisualFrameElement[]
      return elements.find((element) => isVisualFrameReady(element)) ?? null
    }

    return {
      mediaA: findReadySurface('a'),
      mediaB: findReadySurface('b'),
    }
  }

  const getVideoElements = () => {
    const container = canvasRef.current?.parentElement?.parentElement
    if (!container) return { videoA: null, videoB: null }

    const videoA = container.querySelector('video[data-track="a"]') as HTMLVideoElement | null
    const videoB = container.querySelector('video[data-track="b"]') as HTMLVideoElement | null
    return { videoA, videoB }
  }

  const hasProResBackend = (...mediaIds: Array<string | undefined>) =>
    mediaIds.some((mediaId) => mediaId && getFile(mediaId)?.playbackBackend === 'mediabunny')

  const getDisplayedTrackClip = (trackType: 'a' | 'b') => {
    const track = tracks.find((candidate) => candidate.type === trackType)
    return findDisplayedClip(track?.clips ?? [], currentTime)
  }

  const drawContainedMedia = (
    context: CanvasRenderingContext2D,
    media: VisualFrameElement,
    width: number,
    height: number,
  ) => {
    const source = getVisualFrameDimensions(media)
    if (source.width <= 0 || source.height <= 0) {
      throw new Error('Current media frame has no drawable dimensions')
    }

    const scale = Math.min(width / source.width, height / source.height)
    const drawWidth = source.width * scale
    const drawHeight = source.height * scale
    context.drawImage(
      media,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    )
  }

  const handleExport = async () => {
    if (!acquireExportLock()) return

    setIsExporting(true)
    setExporting(true)
    setError(null)
    setProgress(0)

    try {
      const { videoA, videoB } = getVideoElements()
      const { mediaA, mediaB } = getVisualElements()

      if (!mediaA && !mediaB) {
        throw new Error('No media to export')
      }

      const clipA = getDisplayedTrackClip('a')
      const clipB = getDisplayedTrackClip('b')
      const fileA = clipA ? getFile(clipA.mediaId) : null
      const fileB = clipB ? getFile(clipB.mediaId) : null

      if (
        (clipA && fileA?.playbackBackend === 'mediabunny') ||
        (clipB && fileB?.playbackBackend === 'mediabunny') ||
        mediaA instanceof HTMLCanvasElement ||
        mediaB instanceof HTMLCanvasElement
      ) {
        throw new Error(
          'Animated export for ProRes is not supported yet. Use Image or PDF export for the current frame.',
        )
      }

      const loopDuration = Math.max(fileA?.duration || duration, fileB?.duration || duration, 1)

      // Create canvas for rendering
      const captureCanvas = document.createElement('canvas')
      captureCanvas.width = 1920
      captureCanvas.height = 1080
      const ctx = captureCanvas.getContext('2d')!

      setExportProgress({ status: 'encoding', progress: 0, message: 'Recording sweep...' })

      // Generate random parameters for spotlight animation (once per export)
      // This makes each export have a unique trajectory
      const spotlightRandom = {
        // Random phase offsets (0-2 range for full triangle wave cycle)
        phaseX: Math.random() * 2,
        phaseY: Math.random() * 2,
        // Random speed multipliers with variance (base is around 2.0, variance ±0.8)
        speedMultX: 1.2 + Math.random() * 1.6, // 1.2 to 2.8
        speedMultY: 1.2 + Math.random() * 1.6, // 1.2 to 2.8
        // Random direction (1 or -1) - determines if we start going left/right, up/down
        dirX: Math.random() > 0.5 ? 1 : -1,
        dirY: Math.random() > 0.5 ? 1 : -1,
      }

      // Function to draw sweep frame directly to canvas
      const drawSweepFrame = (progress: number, style: SweepStyle) => {
        const width = 1920
        const height = 1080

        // Clear canvas
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, width, height)

        // Draw media B as background
        if (mediaB) {
          try {
            ctx.drawImage(mediaB, 0, 0, width, height)
          } catch {}
        }

        // Draw media A with different clip shapes based on sweep style
        if (mediaA) {
          ctx.save()
          ctx.beginPath()

          switch (style) {
            case 'horizontal': {
              // Left to right sweep
              const sliderX = (progress / 100) * width
              ctx.rect(0, 0, sliderX, height)
              ctx.clip()
              try {
                ctx.drawImage(mediaA, 0, 0, width, height)
              } catch {}
              ctx.restore()
              // Draw slider line
              ctx.fillStyle = '#ffffff'
              ctx.fillRect(sliderX - 1, 0, 2, height)
              return
            }

            case 'vertical': {
              // Top to bottom sweep
              const sliderY = (progress / 100) * height
              ctx.rect(0, 0, width, sliderY)
              ctx.clip()
              try {
                ctx.drawImage(mediaA, 0, 0, width, height)
              } catch {}
              ctx.restore()
              // Draw slider line
              ctx.fillStyle = '#ffffff'
              ctx.fillRect(0, sliderY - 1, width, 2)
              return
            }

            case 'diagonal': {
              // Diagonal wipe from top-left to bottom-right
              const diagProgress = (progress / 100) * 2 // 0 to 2
              const offset = (diagProgress - 1) * (width + height)
              ctx.moveTo(offset, 0)
              ctx.lineTo(offset + height, height)
              ctx.lineTo(-width, height)
              ctx.lineTo(-width, 0)
              ctx.closePath()
              ctx.clip()
              try {
                ctx.drawImage(mediaA, 0, 0, width, height)
              } catch {}
              ctx.restore()
              // Draw diagonal line
              ctx.strokeStyle = '#ffffff'
              ctx.lineWidth = 2
              ctx.beginPath()
              ctx.moveTo(offset, 0)
              ctx.lineTo(offset + height, height)
              ctx.stroke()
              return
            }

            case 'circle': {
              // Expanding circle from center (iris wipe)
              const maxRadius = Math.sqrt(width * width + height * height) / 2
              const radius = (progress / 100) * maxRadius
              const centerX = width / 2
              const centerY = height / 2
              ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
              ctx.clip()
              try {
                ctx.drawImage(mediaA, 0, 0, width, height)
              } catch {}
              ctx.restore()
              // Draw circle outline
              ctx.strokeStyle = '#ffffff'
              ctx.lineWidth = 2
              ctx.beginPath()
              ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
              ctx.stroke()
              return
            }

            case 'rectangle': {
              // Growing rectangle from center
              const maxW = width
              const maxH = height
              const rectW = (progress / 100) * maxW
              const rectH = (progress / 100) * maxH
              const rectX = (width - rectW) / 2
              const rectY = (height - rectH) / 2
              ctx.rect(rectX, rectY, rectW, rectH)
              ctx.clip()
              try {
                ctx.drawImage(mediaA, 0, 0, width, height)
              } catch {}
              ctx.restore()
              // Draw rectangle outline
              ctx.strokeStyle = '#ffffff'
              ctx.lineWidth = 2
              ctx.strokeRect(rectX, rectY, rectW, rectH)
              return
            }

            case 'spotlight': {
              // Bouncing rectangle like classic DVD screensaver
              const rectW = exportSettings.spotlightWidth * width
              const rectH = exportSettings.spotlightHeight * height

              // Bouncing area bounds
              const maxX = width - rectW
              const maxY = height - rectH

              // Speed factor - configurable, with randomized X/Y multipliers for unique patterns
              const baseSpeed = exportSettings.spotlightSpeed
              const speedX = baseSpeed * spotlightRandom.speedMultX
              const speedY = baseSpeed * spotlightRandom.speedMultY

              // Calculate position using triangle wave (bouncing)
              // Triangle wave: goes 0→1→0→1... creating bounce effect
              const triangleWave = (t: number, dir: number) => {
                // Apply direction to potentially reverse the wave
                const adjusted = dir > 0 ? t : t + 1 // Phase shift for reverse direction
                const normalized = adjusted % 2
                return normalized <= 1 ? normalized : 2 - normalized
              }

              // Progress determines how far along the animation we are
              // Add random phase offset for unique starting positions
              const t = progress / 100

              // Calculate bouncing positions with random offsets and directions
              const bounceX = triangleWave(
                t * speedX * 2 + spotlightRandom.phaseX,
                spotlightRandom.dirX,
              )
              const bounceY = triangleWave(
                t * speedY * 2 + spotlightRandom.phaseY,
                spotlightRandom.dirY,
              )

              const rectX = bounceX * maxX
              const rectY = bounceY * maxY

              ctx.rect(rectX, rectY, rectW, rectH)
              ctx.clip()
              try {
                ctx.drawImage(mediaA, 0, 0, width, height)
              } catch {}
              ctx.restore()
              // Draw rectangle outline
              ctx.strokeStyle = '#ffffff'
              ctx.lineWidth = 3
              ctx.strokeRect(rectX, rectY, rectW, rectH)
              return
            }

            case 'spotlight-circle': {
              // Bouncing circle like DVD screensaver
              // Use the average of width and height for circle radius
              const circleRadius =
                (((exportSettings.spotlightWidth + exportSettings.spotlightHeight) / 2) *
                  Math.min(width, height)) /
                2

              // Bouncing area bounds (accounting for circle radius)
              const maxX = width - circleRadius * 2
              const maxY = height - circleRadius * 2

              // Speed factor - configurable, with randomized X/Y multipliers for unique patterns
              const baseSpeed = exportSettings.spotlightSpeed
              const speedX = baseSpeed * spotlightRandom.speedMultX
              const speedY = baseSpeed * spotlightRandom.speedMultY

              // Calculate position using triangle wave (bouncing)
              const triangleWave = (t: number, dir: number) => {
                // Apply direction to potentially reverse the wave
                const adjusted = dir > 0 ? t : t + 1 // Phase shift for reverse direction
                const normalized = adjusted % 2
                return normalized <= 1 ? normalized : 2 - normalized
              }

              // Progress determines how far along the animation we are
              const t = progress / 100

              // Calculate bouncing positions with random offsets and directions
              const bounceX = triangleWave(
                t * speedX * 2 + spotlightRandom.phaseX,
                spotlightRandom.dirX,
              )
              const bounceY = triangleWave(
                t * speedY * 2 + spotlightRandom.phaseY,
                spotlightRandom.dirY,
              )

              const centerX = circleRadius + bounceX * maxX
              const centerY = circleRadius + bounceY * maxY

              ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2)
              ctx.clip()
              try {
                ctx.drawImage(mediaA, 0, 0, width, height)
              } catch {}
              ctx.restore()
              // Draw circle outline
              ctx.strokeStyle = '#ffffff'
              ctx.lineWidth = 3
              ctx.beginPath()
              ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2)
              ctx.stroke()
              return
            }
          }

          ctx.restore()
        }
      }

      // Function to draw single media (for A-only or B-only export)
      const drawSingleMedia = (media: VisualFrameElement | null) => {
        const width = 1920
        const height = 1080
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, width, height)
        if (media) {
          try {
            ctx.drawImage(media, 0, 0, width, height)
          } catch {}
        }
      }

      // Handle A-only or B-only export (no sweep animation)
      if (exportSettings.exportSource === 'a-only' || exportSettings.exportSource === 'b-only') {
        const targetMedia = exportSettings.exportSource === 'a-only' ? mediaA : mediaB
        const targetVideo = exportSettings.exportSource === 'a-only' ? videoA : videoB
        const targetFile = exportSettings.exportSource === 'a-only' ? fileA : fileB
        const targetDuration = targetFile?.duration || duration || 1

        if (!targetMedia) {
          throw new Error(
            `No media ${exportSettings.exportSource === 'a-only' ? 'A' : 'B'} to export`,
          )
        }

        setExportProgress({
          status: 'encoding',
          progress: 0,
          message: `Exporting ${exportSettings.exportSource === 'a-only' ? 'A' : 'B'}...`,
        })

        // Handle MP4 export for single media
        if (exportSettings.format === 'mp4') {
          if (!isWebCodecsSupported()) {
            throw new Error(
              'MP4 export requires a modern browser with WebCodecs support (Chrome, Edge)',
            )
          }

          const fps = 30
          const totalFrames = Math.ceil(targetDuration * fps)
          const bitrate =
            exportSettings.quality === 'high'
              ? 10_000_000
              : exportSettings.quality === 'medium'
                ? 5_000_000
                : 2_500_000

          // Pause and prepare for seeking
          if (targetVideo) targetVideo.pause()

          const muxer = await createAvcMp4Muxer()

          const encoder = new VideoEncoder({
            output: (chunk, meta) => muxer.addChunk(chunk, meta),
            error: (e) => console.error('VideoEncoder error:', e),
          })

          encoder.configure({
            codec: 'avc1.640028',
            width: 1920,
            height: 1080,
            bitrate,
            framerate: fps,
          })

          const frameDuration = 1_000_000 / fps

          for (let i = 0; i < totalFrames; i++) {
            const frameTime = (i / totalFrames) * targetDuration

            if (targetVideo) {
              await new Promise<void>((resolve) => {
                if (Math.abs(targetVideo.currentTime - frameTime) < 0.01) {
                  resolve()
                  return
                }
                const onSeeked = () => {
                  targetVideo.removeEventListener('seeked', onSeeked)
                  resolve()
                }
                targetVideo.addEventListener('seeked', onSeeked)
                targetVideo.currentTime = frameTime
              })
            }

            drawSingleMedia(targetMedia)

            const frame = new VideoFrame(captureCanvas, {
              timestamp: i * frameDuration,
              duration: frameDuration,
            })
            encoder.encode(frame, { keyFrame: i % 30 === 0 })
            frame.close()

            if (i % 5 === 0) {
              const progress = Math.round((i / totalFrames) * 90)
              setProgress(progress)
              setExportProgress({
                status: 'encoding',
                progress,
                message: `Encoding frame ${i + 1}/${totalFrames}`,
              })
            }
            if (i % 3 === 0) await new Promise((r) => setTimeout(r, 0))
          }

          await encoder.flush()
          encoder.close()
          const buffer = await muxer.finalize()
          const mp4Blob = new Blob([buffer], { type: 'video/mp4' })
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          downloadVideo(mp4Blob, `dualview-${exportSettings.exportSource}-${timestamp}.mp4`)
          setExportProgress({ status: 'done', progress: 100, message: 'Export complete!' })
          return
        }

        // Handle GIF export for single media
        if (exportSettings.format === 'gif') {
          const gifPreset = exportSettings.gifPreset || 'medium'
          const gifOptions = GIF_PRESETS[gifPreset]
          const totalFrames = Math.ceil(targetDuration * gifOptions.fps)
          const frames: ImageData[] = []

          if (targetVideo) targetVideo.pause()

          const gifCanvas = document.createElement('canvas')
          gifCanvas.width = gifOptions.width
          gifCanvas.height = gifOptions.height
          const gifCtx = gifCanvas.getContext('2d')!

          for (let i = 0; i < totalFrames; i++) {
            const frameTime = (i / totalFrames) * targetDuration

            if (targetVideo) {
              await new Promise<void>((resolve) => {
                if (Math.abs(targetVideo.currentTime - frameTime) < 0.01) {
                  resolve()
                  return
                }
                const onSeeked = () => {
                  targetVideo.removeEventListener('seeked', onSeeked)
                  resolve()
                }
                targetVideo.addEventListener('seeked', onSeeked)
                targetVideo.currentTime = frameTime
              })
            }

            drawSingleMedia(targetMedia)
            gifCtx.drawImage(captureCanvas, 0, 0, gifOptions.width, gifOptions.height)
            frames.push(gifCtx.getImageData(0, 0, gifOptions.width, gifOptions.height))

            if (i % 5 === 0) {
              setProgress(Math.round((i / totalFrames) * 40))
              setExportProgress({
                status: 'encoding',
                progress: Math.round((i / totalFrames) * 40),
                message: `Capturing frame ${i + 1}/${totalFrames}`,
              })
            }
            if (i % 3 === 0) await new Promise((r) => setTimeout(r, 0))
          }

          // Load and encode GIF
          if (!(window as any).GIF) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement('script')
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js'
              script.onload = () => resolve()
              script.onerror = () => reject(new Error('Failed to load GIF encoder'))
              document.head.appendChild(script)
            })
          }

          const GIF = (window as any).GIF
          const gif = new GIF({
            workers: 2,
            quality: 10,
            width: gifOptions.width,
            height: gifOptions.height,
            workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js',
          })

          const frameDelay = Math.round(1000 / gifOptions.fps)
          frames.forEach((frame) => gif.addFrame(frame, { delay: frameDelay }))

          const gifBlob = await new Promise<Blob>((resolve, reject) => {
            gif.on('progress', (p: number) => {
              setProgress(40 + Math.round(p * 60))
              setExportProgress({
                status: 'encoding',
                progress: 40 + Math.round(p * 60),
                message: `Encoding GIF... ${Math.round(p * 100)}%`,
              })
            })
            gif.on('finished', (blob: Blob) => resolve(blob))
            gif.on('error', (err: Error) => reject(err))
            gif.render()
          })

          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          downloadVideo(gifBlob, `dualview-${exportSettings.exportSource}-${timestamp}.gif`)
          setExportProgress({ status: 'done', progress: 100, message: 'GIF export complete!' })
          return
        }

        // WebM export for single media (real-time)
        const stream = captureCanvas.captureStream(30)
        const mimeType = 'video/webm;codecs=vp9'
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          throw new Error('Video recording not supported')
        }

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond:
            exportSettings.quality === 'high'
              ? 10_000_000
              : exportSettings.quality === 'medium'
                ? 5_000_000
                : 2_500_000,
        })

        const chunks: Blob[] = []
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data)
        }

        const recordingPromise = new Promise<Blob>((resolve) => {
          mediaRecorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }))
        })

        if (targetVideo) {
          targetVideo.currentTime = 0
          targetVideo.play()
        }

        mediaRecorder.start(100)

        const totalDurationMs = targetDuration * 1000
        const startTime = performance.now()

        const animateSingle = () => {
          const elapsed = performance.now() - startTime
          const progressPct = elapsed / totalDurationMs

          if (progressPct >= 1) {
            if (targetVideo) targetVideo.pause()
            mediaRecorder.stop()
            return
          }

          drawSingleMedia(targetMedia)
          setProgress(Math.round(progressPct * 100))
          setExportProgress({
            status: 'encoding',
            progress: Math.round(progressPct * 100),
            message: `Recording... ${Math.round(progressPct * 100)}%`,
          })
          requestAnimationFrame(animateSingle)
        }

        setTimeout(animateSingle, 100)
        const webmBlob = await recordingPromise
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        downloadVideo(webmBlob, `dualview-${exportSettings.exportSource}-${timestamp}.webm`)
        setExportProgress({ status: 'done', progress: 100, message: 'Export complete!' })
        return
      }

      // Set up canvas stream capture (for comparison/sweep export)
      const stream = captureCanvas.captureStream(30)

      const mimeType = 'video/webm;codecs=vp9'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error('Video recording not supported')
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond:
          exportSettings.quality === 'high'
            ? 10_000_000
            : exportSettings.quality === 'medium'
              ? 5_000_000
              : 2_500_000,
      })

      const chunks: Blob[] = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      const recordingPromise = new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          resolve(new Blob(chunks, { type: 'video/webm' }))
        }
      })

      // Reset videos to start
      if (videoA) {
        videoA.currentTime = 0
        videoA.play().catch(() => {})
      }
      if (videoB) {
        videoB.currentTime = 0
        videoB.play().catch(() => {})
      }

      mediaRecorder.start(100)

      const totalDuration = loopDuration * exportSettings.videoLoops * 1000
      const loopDurationMs = loopDuration * 1000
      const startTime = performance.now()
      let lastLoopIndex = 0

      // Animation loop - render directly to canvas
      const animate = () => {
        const elapsed = performance.now() - startTime
        const progressPct = elapsed / totalDuration

        if (progressPct >= 1) {
          if (videoA) videoA.pause()
          if (videoB) videoB.pause()
          mediaRecorder.stop()
          return
        }

        // Check if we've crossed into a new loop - if so, restart videos
        const currentLoopIndex = Math.floor(elapsed / loopDurationMs)
        if (currentLoopIndex > lastLoopIndex) {
          lastLoopIndex = currentLoopIndex
          // Restart videos for the new loop and ensure they keep playing
          if (videoA) {
            videoA.currentTime = 0
            videoA.play().catch(() => {})
          }
          if (videoB) {
            videoB.currentTime = 0
            videoB.play().catch(() => {})
          }
        }

        // Sweep: multiple sweeps per video loop using sine wave
        const loopProgress = (elapsed % loopDurationMs) / loopDurationMs
        const sweepProgress = (loopProgress * exportSettings.sweepsPerLoop) % 1
        const sweepPos = Math.sin(sweepProgress * Math.PI) * 100

        // Draw the sweep frame directly to canvas (no React dependency)
        drawSweepFrame(sweepPos, exportSettings.sweepStyle)

        // Also update UI slider for visual feedback (only for horizontal mode)
        if (exportSettings.sweepStyle === 'horizontal') {
          setSliderPosition(sweepPos)
        }

        setProgress(Math.round(progressPct * 100))
        setExportProgress({
          status: 'encoding',
          progress: Math.round(progressPct * 100),
          message: `Recording... ${Math.round(progressPct * 100)}%`,
        })

        requestAnimationFrame(animate)
      }

      // Helper function to seek video and wait for it to be ready
      const seekVideoAndWait = async (video: HTMLVideoElement, time: number): Promise<void> => {
        return new Promise((resolve) => {
          if (Math.abs(video.currentTime - time) < 0.01) {
            resolve()
            return
          }
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked)
            resolve()
          }
          video.addEventListener('seeked', onSeeked)
          video.currentTime = time
        })
      }

      // Handle MP4 export using WebCodecs + mp4-muxer
      if (exportSettings.format === 'mp4') {
        if (!isWebCodecsSupported()) {
          throw new Error(
            'MP4 export requires a modern browser with WebCodecs support (Chrome, Edge)',
          )
        }

        const fps = 30
        const totalExportDuration = loopDuration * exportSettings.videoLoops
        const totalFrames = Math.ceil(totalExportDuration * fps)
        const bitrate =
          exportSettings.quality === 'high'
            ? 10_000_000
            : exportSettings.quality === 'medium'
              ? 5_000_000
              : 2_500_000

        // Get individual video durations for looping
        const videoADuration = fileA?.duration || loopDuration
        const videoBDuration = fileB?.duration || loopDuration

        setExportProgress({
          status: 'encoding',
          progress: 0,
          message: 'Initializing MP4 encoder...',
        })

        // Pause videos and prepare for seeking
        if (videoA) videoA.pause()
        if (videoB) videoB.pause()

        // Create muxer
        const muxer = await createAvcMp4Muxer()

        // Create video encoder
        let encodedFrames = 0
        const encoder = new VideoEncoder({
          output: (chunk, meta) => {
            muxer.addChunk(chunk, meta)
            encodedFrames++
          },
          error: (e) => console.error('VideoEncoder error:', e),
        })

        encoder.configure({
          codec: 'avc1.640028',
          width: 1920,
          height: 1080,
          bitrate,
          framerate: fps,
        })

        const frameDuration = 1_000_000 / fps // microseconds

        // Encode frames - now with proper video seeking
        for (let i = 0; i < totalFrames; i++) {
          const frameProgress = i / totalFrames
          const currentTime = frameProgress * totalExportDuration

          // First, get time within the current sweep loop (videos restart each loop)
          const timeWithinLoop = currentTime % loopDuration

          // Seek videos to the correct time within the loop
          if (videoA) {
            // If video is shorter than loop, optionally loop it within the sweep
            const videoTimeA =
              exportSettings.loopShorterVideo && videoADuration < loopDuration
                ? timeWithinLoop % videoADuration
                : Math.min(timeWithinLoop, videoADuration - 0.001)
            await seekVideoAndWait(videoA, videoTimeA)
          }
          if (videoB) {
            const videoTimeB =
              exportSettings.loopShorterVideo && videoBDuration < loopDuration
                ? timeWithinLoop % videoBDuration
                : Math.min(timeWithinLoop, videoBDuration - 0.001)
            await seekVideoAndWait(videoB, videoTimeB)
          }

          // Calculate sweep position - multiple sweeps per video loop
          const loopProgress = timeWithinLoop / loopDuration // 0-1 within current video loop
          const sweepProgress = (loopProgress * exportSettings.sweepsPerLoop) % 1
          const sweepPos = Math.sin(sweepProgress * Math.PI) * 100

          // Draw the frame with current video positions
          drawSweepFrame(sweepPos, exportSettings.sweepStyle)

          // Create VideoFrame from canvas
          const frame = new VideoFrame(captureCanvas, {
            timestamp: i * frameDuration,
            duration: frameDuration,
          })

          encoder.encode(frame, { keyFrame: i % 30 === 0 })
          frame.close()

          if (i % 5 === 0) {
            const progress = Math.round((i / totalFrames) * 90)
            setProgress(progress)
            setExportProgress({
              status: 'encoding',
              progress,
              message: `Encoding frame ${i + 1}/${totalFrames}`,
            })
          }

          // Small delay to prevent blocking and allow UI updates
          if (i % 3 === 0) await new Promise((r) => setTimeout(r, 0))
        }

        setExportProgress({ status: 'encoding', progress: 95, message: 'Finalizing MP4...' })
        await encoder.flush()
        encoder.close()
        const buffer = await muxer.finalize()
        const mp4Blob = new Blob([buffer], { type: 'video/mp4' })

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        downloadVideo(mp4Blob, `dualview-sweep-${timestamp}.mp4`)
        setExportProgress({ status: 'done', progress: 100, message: 'MP4 export complete!' })
        return
      }

      // Handle GIF export differently - capture frames directly
      if (exportSettings.format === 'gif') {
        const gifPreset = exportSettings.gifPreset || 'medium'
        const gifOptions = GIF_PRESETS[gifPreset]
        const totalExportDuration = loopDuration * exportSettings.videoLoops
        const totalFrames = Math.ceil(totalExportDuration * gifOptions.fps)
        const frames: ImageData[] = []

        // Get individual video durations for looping
        const videoADuration = fileA?.duration || loopDuration
        const videoBDuration = fileB?.duration || loopDuration

        setExportProgress({
          status: 'encoding',
          progress: 0,
          message: 'Capturing frames for GIF...',
        })

        // Pause videos and prepare for seeking
        if (videoA) videoA.pause()
        if (videoB) videoB.pause()

        // Create smaller canvas for GIF
        const gifCanvas = document.createElement('canvas')
        gifCanvas.width = gifOptions.width
        gifCanvas.height = gifOptions.height
        const gifCtx = gifCanvas.getContext('2d')!

        // Capture frames - now with proper video seeking
        for (let i = 0; i < totalFrames; i++) {
          const frameProgress = i / totalFrames
          const currentTime = frameProgress * totalExportDuration

          // First, get time within the current sweep loop (videos restart each loop)
          const timeWithinLoop = currentTime % loopDuration

          // Seek videos to the correct time within the loop
          if (videoA) {
            // If video is shorter than loop, optionally loop it within the sweep
            const videoTimeA =
              exportSettings.loopShorterVideo && videoADuration < loopDuration
                ? timeWithinLoop % videoADuration
                : Math.min(timeWithinLoop, videoADuration - 0.001)
            await seekVideoAndWait(videoA, videoTimeA)
          }
          if (videoB) {
            const videoTimeB =
              exportSettings.loopShorterVideo && videoBDuration < loopDuration
                ? timeWithinLoop % videoBDuration
                : Math.min(timeWithinLoop, videoBDuration - 0.001)
            await seekVideoAndWait(videoB, videoTimeB)
          }

          // Calculate sweep position - multiple sweeps per video loop
          const loopProgress = timeWithinLoop / loopDuration // 0-1 within current video loop
          const sweepProgress = (loopProgress * exportSettings.sweepsPerLoop) % 1
          const sweepPos = Math.sin(sweepProgress * Math.PI) * 100

          // Draw the frame with current video positions
          drawSweepFrame(sweepPos, exportSettings.sweepStyle)

          // Scale down to GIF size
          gifCtx.drawImage(captureCanvas, 0, 0, gifOptions.width, gifOptions.height)
          frames.push(gifCtx.getImageData(0, 0, gifOptions.width, gifOptions.height))

          if (i % 5 === 0) {
            setProgress(Math.round((i / totalFrames) * 40))
            setExportProgress({
              status: 'encoding',
              progress: Math.round((i / totalFrames) * 40),
              message: `Capturing frame ${i + 1}/${totalFrames}`,
            })
          }

          // Small delay to prevent blocking and allow UI updates
          if (i % 3 === 0) await new Promise((r) => setTimeout(r, 0))
        }

        // Encode GIF using gif.js from CDN
        setExportProgress({ status: 'encoding', progress: 40, message: 'Loading GIF encoder...' })

        // Dynamically load gif.js
        if (!(window as any).GIF) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js'
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('Failed to load GIF encoder'))
            document.head.appendChild(script)
          })
        }

        setExportProgress({ status: 'encoding', progress: 45, message: 'Encoding GIF...' })

        const GIF = (window as any).GIF
        const gif = new GIF({
          workers: 2,
          quality: 10,
          width: gifOptions.width,
          height: gifOptions.height,
          workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js',
        })

        const frameDelay = Math.round(1000 / gifOptions.fps)
        frames.forEach((frame) => {
          gif.addFrame(frame, { delay: frameDelay })
        })

        const gifBlob = await new Promise<Blob>((resolve, reject) => {
          gif.on('progress', (p: number) => {
            setProgress(45 + Math.round(p * 55))
            setExportProgress({
              status: 'encoding',
              progress: 45 + Math.round(p * 55),
              message: `Encoding GIF... ${Math.round(p * 100)}%`,
            })
          })
          gif.on('finished', (blob: Blob) => resolve(blob))
          gif.on('error', (err: Error) => reject(err))
          gif.render()
        })

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        downloadVideo(gifBlob, `dualview-sweep-${timestamp}.gif`)
        setExportProgress({ status: 'done', progress: 100, message: 'GIF export complete!' })
        return
      }

      // WebM export (default, fast)
      setTimeout(animate, 100)

      const webmBlob = await recordingPromise
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      downloadVideo(webmBlob, `dualview-sweep-${timestamp}.webm`)

      setExportProgress({ status: 'done', progress: 100, message: 'Export complete!' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed'
      setError(message)
      setExportProgress({ status: 'error', progress: 0, message })
    } finally {
      setIsExporting(false)
      setExporting(false)
      setSliderPosition(50)
      releaseExportLock()
    }
  }

  const handleScreenshotExport = async (copyToClipboard = false) => {
    if (!acquireExportLock()) return

    setIsExportingScreenshot(true)
    setError(null)

    try {
      const resolutions = {
        '720p': { width: 1280, height: 720 },
        '1080p': { width: 1920, height: 1080 },
        '4k': { width: 3840, height: 2160 },
      }
      const { width, height } = resolutions[screenshotResolution]
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to create screenshot canvas')

      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, width, height)

      if (screenshotSource === 'comparison') {
        const comparisonFrame = captureFrame({ width, height })
        if (!comparisonFrame) {
          throw new Error('The current comparison frame is still loading. Try again after it is ready.')
        }
        ctx.drawImage(comparisonFrame, 0, 0, width, height)
      } else {
        const { mediaA, mediaB } = getVisualElements()
        const media = screenshotSource === 'a-only' ? mediaA : mediaB
        if (!media || !isVisualFrameReady(media)) {
          throw new Error(
            `Media ${screenshotSource === 'a-only' ? 'A' : 'B'} is not ready to capture`,
          )
        }
        drawContainedMedia(ctx, media, width, height)
      }

      const mimeType = screenshotFormat === 'png' ? 'image/png' : 'image/jpeg'
      const quality = screenshotFormat === 'jpg' ? screenshotQuality / 100 : undefined
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error('Failed to create blob'))),
          mimeType,
          quality,
        )
      })

      if (copyToClipboard) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ [mimeType]: blob })])
          setExportProgress({ status: 'done', progress: 100, message: 'Copied to clipboard!' })
        } catch (clipboardError) {
          console.error('Clipboard write failed:', clipboardError)
          const filename = `dualview-${screenshotSource}-${Date.now()}.${screenshotFormat}`
          downloadBlob(blob, filename)
          setExportProgress({
            status: 'done',
            progress: 100,
            message: 'Downloaded (clipboard not supported)',
          })
        }
      } else {
        const filename = `dualview-${screenshotSource}-${Date.now()}.${screenshotFormat}`
        downloadBlob(blob, filename)
        setExportProgress({ status: 'done', progress: 100, message: 'Screenshot saved!' })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Screenshot failed'
      console.error('Screenshot export failed:', err)
      setError(message)
      setExportProgress({ status: 'error', progress: 0, message })
    } finally {
      setIsExportingScreenshot(false)
      releaseExportLock()
    }
  }

  const handlePDFExport = async () => {
    if (!acquireExportLock()) return

    setIsExportingPDF(true)
    setError(null)

    try {
      const comparisonFrame = captureFrame({ width: 1920, height: 1080 })
      if (!comparisonFrame) {
        throw new Error('The current comparison frame is still loading. Try again after it is ready.')
      }

      const screenshotBlob = await captureCanvasScreenshot(comparisonFrame, 'png')
      if (!screenshotBlob) throw new Error('Failed to capture screenshot')

      // Get media info
      const clipA = getDisplayedTrackClip('a')
      const clipB = getDisplayedTrackClip('b')
      const mediaA = clipA ? getFile(clipA.mediaId) : undefined
      const mediaB = clipB ? getFile(clipB.mediaId) : undefined

      const pdfBlob = await generatePDFReport({
        title: pdfTitle,
        includeMetadata,
        includeAnnotations: false,
        includeSettings,
        screenshotBlob,
        mediaA: mediaA
          ? {
              name: mediaA.name,
              type: mediaA.type,
              size: formatFileSize(mediaA.file.size),
              dimensions:
                mediaA.width && mediaA.height ? `${mediaA.width}×${mediaA.height}` : undefined,
            }
          : undefined,
        mediaB: mediaB
          ? {
              name: mediaB.name,
              type: mediaB.type,
              size: formatFileSize(mediaB.file.size),
              dimensions:
                mediaB.width && mediaB.height ? `${mediaB.width}×${mediaB.height}` : undefined,
            }
          : undefined,
        comparisonMode,
        metrics: {
          ssim: metricsSSIM ?? undefined,
          psnr: metricsPSNR ?? undefined,
        },
      })

      const filename = `dualview-report-${Date.now()}.pdf`
      downloadBlob(pdfBlob, filename)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PDF export failed'
      console.error('PDF export failed:', err)
      setError(message)
      setExportProgress({ status: 'error', progress: 0, message })
    } finally {
      setIsExportingPDF(false)
      releaseExportLock()
    }
  }

  // Get available engines and variants for transition UI
  const transitionEngines = useMemo(() => getAllEngines(), [])
  const transitionVariants = useMemo(() => getAllVariants(transitionEngine), [transitionEngine])
  const transitionVariantOptions = useMemo(
    () =>
      transitionVariants.map((value) => ({
        value,
        label: getShader(transitionEngine, value)?.label || value,
      })),
    [transitionEngine, transitionVariants],
  )
  const transitionShaderCount = useMemo(() => getTotalShaderCount(), [])

  // Handle engine change - reset variant to first available
  const handleEngineChange = (engine: TransitionEngine) => {
    setTransitionEngine(engine)
    const variants = getAllVariants(engine)
    setTransitionVariant(variants[0] || 'crossfade')
  }

  const handleTransitionExport = async () => {
    if (!acquireExportLock()) return

    setIsExportingTransition(true)
    setExporting(true)
    setError(null)
    setProgress(0)

    try {
      const { videoA, videoB } = getVideoElements()
      const { mediaA, mediaB } = getVisualElements()

      if (!mediaA || !mediaB) {
        throw new Error('Both media A and B are required for transition export')
      }

      const clipA = getDisplayedTrackClip('a')
      const clipB = getDisplayedTrackClip('b')
      const fileA = clipA ? getFile(clipA.mediaId) : null
      const fileB = clipB ? getFile(clipB.mediaId) : null

      if (fileA?.playbackBackend === 'mediabunny' || fileB?.playbackBackend === 'mediabunny') {
        throw new Error(
          'Transition export for ProRes is not supported yet. Use Image or PDF export for the current frame.',
        )
      }

      if (mediaA instanceof HTMLCanvasElement || mediaB instanceof HTMLCanvasElement) {
        throw new Error('Transition export requires browser-native video or image sources.')
      }

      // Check WebGL support
      if (!WebGLTransitionRenderer.isSupported()) {
        throw new Error('WebGL is not supported in this browser')
      }

      // Get media durations
      const durationA = fileA?.duration || 0
      const durationB = fileB?.duration || 0

      // Determine total export duration based on mode
      let totalDuration: number
      switch (transitionExportMode) {
        case 'sequential':
          // Full A + transition + Full B
          totalDuration = durationA + transitionDuration + durationB
          break
        case 'overlap':
          // Videos overlap during transition
          totalDuration = Math.max(durationA, durationB) + transitionDuration * 0.5
          break
        case 'loop':
          // A → B → A cycle
          totalDuration = transitionDuration * 2 + Math.max(durationA, durationB)
          break
        case 'transition-only':
          // Just the transition
          totalDuration = transitionDuration
          break
        default:
          totalDuration = transitionDuration
      }

      // Ensure minimum duration
      if (totalDuration < 0.5) totalDuration = 0.5

      const fps = 30
      const totalFrames = Math.ceil(totalDuration * fps)
      const width = 1920
      const height = 1080

      setExportProgress({ status: 'encoding', progress: 0, message: 'Initializing WebGL...' })

      // Create WebGL renderer
      const renderer = new WebGLTransitionRenderer(width, height)

      // Load the selected shader
      const shaderLoaded = renderer.loadTransition(transitionEngine, transitionVariant)
      if (!shaderLoaded) {
        throw new Error(`Failed to load shader: ${transitionEngine}/${transitionVariant}`)
      }

      // Pause videos for seeking
      if (videoA) videoA.pause()
      if (videoB) videoB.pause()

      // Create capture canvas
      const captureCanvas = document.createElement('canvas')
      captureCanvas.width = width
      captureCanvas.height = height
      const ctx = captureCanvas.getContext('2d')!

      // Helper to seek video and wait
      const seekVideoAndWait = async (video: HTMLVideoElement, time: number): Promise<void> => {
        return new Promise((resolve) => {
          if (Math.abs(video.currentTime - time) < 0.01) {
            resolve()
            return
          }
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked)
            resolve()
          }
          video.addEventListener('seeked', onSeeked)
          video.currentTime = Math.max(0, Math.min(time, video.duration - 0.001))
        })
      }

      // Helper to draw media to canvas
      const drawToCanvas = (source: HTMLVideoElement | HTMLImageElement) => {
        ctx.drawImage(source, 0, 0, width, height)
      }

      setExportProgress({ status: 'encoding', progress: 5, message: 'Starting encode...' })

      if (transitionFormat === 'mp4') {
        if (!isWebCodecsSupported()) {
          throw new Error('MP4 export requires WebCodecs support (Chrome, Edge)')
        }

        const bitrate =
          transitionQuality === 'high'
            ? 10_000_000
            : transitionQuality === 'medium'
              ? 5_000_000
              : 2_500_000

        const muxer = await createAvcMp4Muxer()

        const encoder = new VideoEncoder({
          output: (chunk, meta) => muxer.addChunk(chunk, meta),
          error: (e) => console.error('VideoEncoder error:', e),
        })

        encoder.configure({
          codec: 'avc1.640028',
          width,
          height,
          bitrate,
          framerate: fps,
        })

        const frameDuration = 1_000_000 / fps

        // Encode frames
        for (let i = 0; i < totalFrames; i++) {
          const currentTime = (i / totalFrames) * totalDuration
          let transitionProgress = 0
          let showA = true
          let showB = false
          let timeA = 0
          let timeB = 0

          // Calculate what to show based on export mode
          switch (transitionExportMode) {
            case 'sequential': {
              if (currentTime < durationA) {
                // Phase 1: Show A
                showA = true
                showB = false
                transitionProgress = 0
                timeA = currentTime
              } else if (currentTime < durationA + transitionDuration) {
                // Phase 2: Transition
                showA = true
                showB = true
                transitionProgress = (currentTime - durationA) / transitionDuration
                timeA = Math.min(durationA - 0.001, durationA)
                timeB = 0
              } else {
                // Phase 3: Show B
                showA = false
                showB = true
                transitionProgress = 1
                timeB = currentTime - durationA - transitionDuration
              }
              break
            }
            case 'overlap': {
              const midPoint = totalDuration / 2
              if (currentTime < midPoint - transitionDuration / 2) {
                showA = true
                showB = false
                transitionProgress = 0
                timeA = currentTime
              } else if (currentTime > midPoint + transitionDuration / 2) {
                showA = false
                showB = true
                transitionProgress = 1
                timeB = currentTime - (midPoint - transitionDuration / 2)
              } else {
                showA = true
                showB = true
                transitionProgress =
                  (currentTime - (midPoint - transitionDuration / 2)) / transitionDuration
                timeA = currentTime
                timeB = currentTime - (midPoint - transitionDuration / 2)
              }
              break
            }
            case 'loop': {
              // A → transition → B → transition → loop
              const cycleTime = currentTime % (transitionDuration * 2 + 0.1)
              if (cycleTime < transitionDuration) {
                showA = true
                showB = true
                transitionProgress = cycleTime / transitionDuration
                timeA = 0
                timeB = 0
              } else {
                showA = true
                showB = true
                transitionProgress = 1 - (cycleTime - transitionDuration) / transitionDuration
                timeA = 0
                timeB = 0
              }
              break
            }
            case 'transition-only': {
              showA = true
              showB = true
              transitionProgress = currentTime / transitionDuration
              timeA = 0
              timeB = 0
              break
            }
          }

          // Seek videos if needed
          if (showA && videoA) {
            await seekVideoAndWait(videoA, timeA)
          }
          if (showB && videoB) {
            await seekVideoAndWait(videoB, timeB)
          }

          // Render frame
          if (showA && showB && transitionProgress > 0 && transitionProgress < 1) {
            // WebGL transition
            renderer.updateTexture('A', mediaA)
            renderer.updateTexture('B', mediaB)
            renderer.render(transitionProgress, transitionIntensity, currentTime)
            ctx.drawImage(renderer.getCanvas(), 0, 0)
          } else if (showB && (!showA || transitionProgress >= 1)) {
            // Show B only
            drawToCanvas(mediaB)
          } else {
            // Show A only
            drawToCanvas(mediaA)
          }

          // Encode frame
          const frame = new VideoFrame(captureCanvas, {
            timestamp: i * frameDuration,
            duration: frameDuration,
          })
          encoder.encode(frame, { keyFrame: i % 30 === 0 })
          frame.close()

          if (i % 5 === 0) {
            const prog = 5 + Math.round((i / totalFrames) * 90)
            setProgress(prog)
            setExportProgress({
              status: 'encoding',
              progress: prog,
              message: `Encoding frame ${i + 1}/${totalFrames}`,
            })
          }

          if (i % 3 === 0) await new Promise((r) => setTimeout(r, 0))
        }

        setExportProgress({ status: 'encoding', progress: 95, message: 'Finalizing MP4...' })
        await encoder.flush()
        encoder.close()
        const buffer = await muxer.finalize()
        const mp4Blob = new Blob([buffer], { type: 'video/mp4' })
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        downloadVideo(mp4Blob, `dualview-transition-${transitionEngine}-${timestamp}.mp4`)
      } else {
        // GIF export
        const gifOptions = GIF_PRESETS.medium
        const gifFrames: ImageData[] = []

        const gifCanvas = document.createElement('canvas')
        gifCanvas.width = gifOptions.width
        gifCanvas.height = gifOptions.height
        const gifCtx = gifCanvas.getContext('2d')!

        const gifTotalFrames = Math.ceil(totalDuration * gifOptions.fps)

        for (let i = 0; i < gifTotalFrames; i++) {
          const currentTime = (i / gifTotalFrames) * totalDuration
          let transitionProgress = 0
          let showA = true
          let showB = false
          let timeA = 0
          let timeB = 0

          // Same logic as MP4 for calculating what to show
          switch (transitionExportMode) {
            case 'sequential': {
              if (currentTime < durationA) {
                showA = true
                showB = false
                transitionProgress = 0
                timeA = currentTime
              } else if (currentTime < durationA + transitionDuration) {
                showA = true
                showB = true
                transitionProgress = (currentTime - durationA) / transitionDuration
                timeA = durationA - 0.001
                timeB = 0
              } else {
                showA = false
                showB = true
                transitionProgress = 1
                timeB = currentTime - durationA - transitionDuration
              }
              break
            }
            case 'transition-only': {
              showA = true
              showB = true
              transitionProgress = currentTime / transitionDuration
              timeA = 0
              timeB = 0
              break
            }
            default: {
              showA = true
              showB = true
              transitionProgress = currentTime / totalDuration
              timeA = 0
              timeB = 0
            }
          }

          if (showA && videoA) await seekVideoAndWait(videoA, timeA)
          if (showB && videoB) await seekVideoAndWait(videoB, timeB)

          if (showA && showB && transitionProgress > 0 && transitionProgress < 1) {
            renderer.updateTexture('A', mediaA)
            renderer.updateTexture('B', mediaB)
            renderer.render(transitionProgress, transitionIntensity, currentTime)
            ctx.drawImage(renderer.getCanvas(), 0, 0)
          } else if (showB && (!showA || transitionProgress >= 1)) {
            drawToCanvas(mediaB)
          } else {
            drawToCanvas(mediaA)
          }

          gifCtx.drawImage(captureCanvas, 0, 0, gifOptions.width, gifOptions.height)
          gifFrames.push(gifCtx.getImageData(0, 0, gifOptions.width, gifOptions.height))

          if (i % 5 === 0) {
            setProgress(5 + Math.round((i / gifTotalFrames) * 40))
            setExportProgress({
              status: 'encoding',
              progress: 5 + Math.round((i / gifTotalFrames) * 40),
              message: `Capturing frame ${i + 1}/${gifTotalFrames}`,
            })
          }
          if (i % 3 === 0) await new Promise((r) => setTimeout(r, 0))
        }

        // Encode GIF
        setExportProgress({ status: 'encoding', progress: 50, message: 'Encoding GIF...' })

        if (!(window as any).GIF) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js'
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('Failed to load GIF encoder'))
            document.head.appendChild(script)
          })
        }

        const GIF = (window as any).GIF
        const gif = new GIF({
          workers: 2,
          quality: 10,
          width: gifOptions.width,
          height: gifOptions.height,
          workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js',
        })

        const frameDelay = Math.round(1000 / gifOptions.fps)
        gifFrames.forEach((frame) => gif.addFrame(frame, { delay: frameDelay }))

        const gifBlob = await new Promise<Blob>((resolve, reject) => {
          gif.on('progress', (p: number) => {
            setProgress(50 + Math.round(p * 50))
            setExportProgress({
              status: 'encoding',
              progress: 50 + Math.round(p * 50),
              message: `Encoding GIF... ${Math.round(p * 100)}%`,
            })
          })
          gif.on('finished', (blob: Blob) => resolve(blob))
          gif.on('error', (err: Error) => reject(err))
          gif.render()
        })

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        downloadVideo(gifBlob, `dualview-transition-${transitionEngine}-${timestamp}.gif`)
      }

      // Cleanup
      renderer.dispose()

      setExportProgress({ status: 'done', progress: 100, message: 'Transition export complete!' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transition export failed'
      setError(message)
      setExportProgress({ status: 'error', progress: 0, message })
    } finally {
      setIsExportingTransition(false)
      setExporting(false)
      releaseExportLock()
    }
  }

  const handleStitchExport = async () => {
    const selectedTrack = tracks.find((track) => track.id === stitchTrackId)
    if (!selectedTrack || selectedTrack.clips.length === 0) return

    if (hasProResBackend(...selectedTrack.clips.map((clip) => clip.mediaId))) {
      setStitchProgress({
        status: 'error',
        progress: 0,
        message:
          'Stitch export for ProRes is not supported yet. Use the comparison view for review.',
        currentClip: 0,
        totalClips: selectedTrack.clips.length,
      })
      return
    }

    if (!acquireExportLock()) return

    setIsExportingStitch(true)
    setStitchProgress({
      status: 'preparing',
      progress: 0,
      message: 'Preparing...',
      currentClip: 0,
      totalClips: selectedTrack.clips.length,
    })

    try {
      const blob = await exportStitchedVideo(
        selectedTrack,
        getFile,
        {
          trackId: stitchTrackId,
          format: 'mp4',
          resolution: stitchResolution,
          quality: stitchQuality,
          fps: stitchFps,
          includeAudio: false,
        },
        setStitchProgress,
      )

      if (blob) {
        downloadStitchedVideo(
          blob,
          `${selectedTrack.name.toLowerCase().replace(/\s+/g, '-')}-stitched.mp4`,
        )
      }
    } catch (err) {
      console.error('Stitch export error:', err)
      setStitchProgress({
        status: 'error',
        progress: 0,
        message: err instanceof Error ? err.message : 'Export failed',
        currentClip: 0,
        totalClips: 0,
      })
    } finally {
      setIsExportingStitch(false)
      releaseExportLock()
    }
  }

  if (!isOpen) return null

  const trackAForReadiness = tracks.find((track) => track.type === 'a')
  const trackBForReadiness = tracks.find((track) => track.type === 'b')

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      <DialogContent
        className="w-full max-w-md p-6"
        backdropClassName="bg-black/60 backdrop-blur-sm"
      >
        <DialogTitle className="mb-2 text-lg font-semibold">Export Comparison</DialogTitle>
        <DialogDescription className="sr-only">
          Configure and export the current comparison in video, image, transition, stitch, or PDF
          format.
        </DialogDescription>

        <ExportReadiness
          hasMediaA={Boolean(trackAForReadiness?.clips.length)}
          hasMediaB={Boolean(trackBForReadiness?.clips.length)}
        />

        <ExportModeTabs
          value={exportMode}
          onValueChange={setExportMode}
          disabled={isAnyExporting}
        />

        <div className="space-y-4">
          {exportMode === 'video' && (
            <VideoExportPanel
              settings={exportSettings}
              comparisonMode={comparisonMode}
              isExporting={isExporting}
              progress={progress}
              exportProgress={exportProgress}
              error={error}
              onSettingsChange={setExportSettings}
              onClose={handleClose}
              onExport={() => void handleExport()}
              onReset={() => {
                setExportProgress({ status: 'idle', progress: 0 })
                setProgress(0)
              }}
            />
          )}

          {exportMode === 'transition' && (
            <TransitionExportPanel
              shaderCount={transitionShaderCount}
              webglSupported={WebGLTransitionRenderer.isSupported()}
              exportMode={transitionExportMode}
              onExportModeChange={setTransitionExportMode}
              engines={transitionEngines}
              engine={transitionEngine}
              onEngineChange={handleEngineChange}
              variants={transitionVariantOptions}
              variant={transitionVariant}
              onVariantChange={setTransitionVariant}
              duration={transitionDuration}
              onDurationChange={setTransitionDuration}
              intensity={transitionIntensity}
              onIntensityChange={setTransitionIntensity}
              format={transitionFormat}
              onFormatChange={setTransitionFormat}
              quality={transitionQuality}
              onQualityChange={setTransitionQuality}
              isExporting={isExportingTransition}
              progress={progress}
              exportProgress={exportProgress}
              error={error}
              onClose={handleClose}
              onExport={() => void handleTransitionExport()}
              onReset={() => {
                setExportProgress({ status: 'idle', progress: 0 })
                setProgress(0)
              }}
            />
          )}

          {exportMode === 'screenshot' && (
            <ScreenshotExportPanel
              source={screenshotSource}
              onSourceChange={setScreenshotSource}
              resolution={screenshotResolution}
              onResolutionChange={setScreenshotResolution}
              format={screenshotFormat}
              onFormatChange={setScreenshotFormat}
              quality={screenshotQuality}
              onQualityChange={setScreenshotQuality}
              progress={exportProgress}
              error={error}
              isExporting={isExportingScreenshot}
              onClose={handleClose}
              onExport={(copyToClipboard) => void handleScreenshotExport(copyToClipboard)}
            />
          )}

          {exportMode === 'stitch' && (
            <StitchExportPanel
              tracks={stitchTrackOptions}
              trackId={stitchTrackId}
              onTrackChange={setStitchTrackId}
              resolution={stitchResolution}
              onResolutionChange={setStitchResolution}
              quality={stitchQuality}
              onQualityChange={setStitchQuality}
              fps={stitchFps}
              onFpsChange={setStitchFps}
              progress={stitchProgress}
              isExporting={isExportingStitch}
              onClose={handleClose}
              onExport={() => void handleStitchExport()}
              onReset={() =>
                setStitchProgress({
                  status: 'idle',
                  progress: 0,
                  message: '',
                  currentClip: 0,
                  totalClips: 0,
                })
              }
            />
          )}

          {exportMode === 'pdf' && (
            <PdfExportPanel
              title={pdfTitle}
              onTitleChange={setPdfTitle}
              includeMetadata={includeMetadata}
              onIncludeMetadataChange={setIncludeMetadata}
              includeSettings={includeSettings}
              onIncludeSettingsChange={setIncludeSettings}
              isExporting={isExportingPDF}
              onClose={handleClose}
              onExport={() => void handlePDFExport()}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
