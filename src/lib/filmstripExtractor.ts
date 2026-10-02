/**
 * Filmstrip Frame Extractor (FILMSTRIP-001)
 *
 * Extracts multiple frames from videos as thumbnails for timeline preview.
 * Runs extraction in the main thread but with requestIdleCallback for performance.
 */

export interface FilmstripFrame {
  time: number // Time in seconds
  dataUrl: string // Base64 thumbnail
}

export interface FilmstripData {
  mediaId: string
  duration: number
  frames: FilmstripFrame[]
  frameInterval: number // Seconds between frames
}

interface Extraction {
  mediaId: string
  controller: AbortController
  promise: Promise<FilmstripData | null>
  result?: FilmstripData | null
}

// 表示の再描画から独立した要求。失敗も完了として保持し、無限再試行を避ける。
const extractions = new Map<string, Extraction>()
const MAX_CACHE_SIZE = 50
const fileIds = new WeakMap<File, number>()
let nextFileId = 0

function fileIdentity(file?: File): number {
  if (!file) return 0
  let id = fileIds.get(file)
  if (id === undefined) {
    id = ++nextFileId
    fileIds.set(file, id)
  }
  return id
}

function trimCompletedCache(): void {
  const completed = [...extractions].filter(([, entry]) => entry.result !== undefined)
  for (const [key] of completed.slice(0, Math.max(0, completed.length - MAX_CACHE_SIZE))) {
    extractions.delete(key)
  }
}

/**
 * Configuration for filmstrip extraction
 */
export interface FilmstripConfig {
  frameInterval?: number // Seconds between frames (default: 1)
  thumbnailWidth?: number // Width of each thumbnail (default: 80)
  thumbnailHeight?: number // Height of each thumbnail (default: 45)
  maxFrames?: number // Maximum frames to extract (default: 100)
}

const DEFAULT_CONFIG: Required<FilmstripConfig> = {
  frameInterval: 1,
  thumbnailWidth: 80,
  thumbnailHeight: 45,
  maxFrames: 100,
}

/**
 * Extract filmstrip frames from a video
 */
export function extractFilmstrip(
  mediaId: string,
  videoUrl: string,
  duration: number,
  config: FilmstripConfig = {},
  file?: File,
): Promise<FilmstripData | null> {
  const cfg = {
    frameInterval: config.frameInterval ?? DEFAULT_CONFIG.frameInterval,
    thumbnailWidth: config.thumbnailWidth ?? DEFAULT_CONFIG.thumbnailWidth,
    thumbnailHeight: config.thumbnailHeight ?? DEFAULT_CONFIG.thumbnailHeight,
    maxFrames: config.maxFrames ?? DEFAULT_CONFIG.maxFrames,
  }
  const key = JSON.stringify([mediaId, fileIdentity(file), videoUrl, duration, cfg])
  const existing = extractions.get(key)
  if (existing) {
    extractions.delete(key)
    extractions.set(key, existing)
    return existing.promise
  }

  const controller = new AbortController()
  const entry: Extraction = {
    mediaId,
    controller,
    promise: Promise.resolve(null),
  }
  extractions.set(key, entry)
  entry.promise = performExtraction(mediaId, videoUrl, duration, cfg, controller.signal)
    .catch((error) => {
      console.warn('Failed to extract filmstrip:', error)
      return null
    })
    .then((result) => {
      if (controller.signal.aborted || extractions.get(key) !== entry) return null
      entry.result = result
      trimCompletedCache()
      return result
    })
  return entry.promise
}

/**
 * Perform the actual frame extraction
 */
async function performExtraction(
  mediaId: string,
  videoUrl: string,
  duration: number,
  config: Required<FilmstripConfig>,
  signal: AbortSignal,
): Promise<FilmstripData | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'metadata'
    video.muted = true

    const frames: FilmstripFrame[] = []
    let currentFrame = 0
    let isResolved = false
    let idleId: number | null = null
    let nextFrameTimeout: ReturnType<typeof setTimeout> | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    // Cleanup function to properly release resources
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('seeked', handleSeeked)
      video.removeEventListener('error', handleError)
      signal.removeEventListener('abort', handleAbort)
      if (idleId !== null) window.cancelIdleCallback(idleId)
      if (nextFrameTimeout !== null) clearTimeout(nextFrameTimeout)
      video.removeAttribute('src')
      video.load() // Force release
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    const resolveOnce = (result: FilmstripData | null) => {
      if (isResolved) return
      isResolved = true
      cleanup()
      resolve(result)
    }

    const handleAbort = () => resolveOnce(null)

    // Calculate frame times
    const frameCount = Math.min(Math.ceil(duration / config.frameInterval), config.maxFrames)
    const frameTimes: number[] = []
    for (let i = 0; i < frameCount; i++) {
      frameTimes.push(i * config.frameInterval)
    }

    const captureFrame = () => {
      if (isResolved) return

      if (currentFrame >= frameTimes.length) {
        // All frames captured
        resolveOnce({
          mediaId,
          duration,
          frames,
          frameInterval: config.frameInterval,
        })
        return
      }

      const time = frameTimes[currentFrame]
      video.currentTime = time
    }

    const handleSeeked = () => {
      if (isResolved) return

      try {
        const canvas = document.createElement('canvas')
        canvas.width = config.thumbnailWidth
        canvas.height = config.thumbnailHeight
        const ctx = canvas.getContext('2d')

        if (ctx) {
          // Draw frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6)

          frames.push({
            time: frameTimes[currentFrame],
            dataUrl,
          })
        }

        currentFrame++

        // Use requestIdleCallback for next frame if available, otherwise setTimeout
        if ('requestIdleCallback' in window) {
          idleId = window.requestIdleCallback(captureFrame, { timeout: 100 })
        } else {
          nextFrameTimeout = setTimeout(captureFrame, 10)
        }
      } catch (error) {
        console.warn('Failed to capture frame:', error)
        currentFrame++
        if (currentFrame < frameTimes.length) {
          captureFrame()
        } else {
          // Return what we have so far
          resolveOnce(
            frames.length > 0
              ? {
                  mediaId,
                  duration,
                  frames,
                  frameInterval: config.frameInterval,
                }
              : null,
          )
        }
      }
    }

    const handleLoadedMetadata = () => {
      video.addEventListener('seeked', handleSeeked)
      captureFrame()
    }

    const handleError = () => {
      console.warn('Failed to load video for filmstrip extraction')
      resolveOnce(null)
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('error', handleError)
    signal.addEventListener('abort', handleAbort, { once: true })
    if (signal.aborted) {
      handleAbort()
      return
    }

    // Timeout fallback - resolve with partial results or null
    timeoutId = setTimeout(() => {
      if (!isResolved) {
        console.warn('Filmstrip extraction timed out')
        resolveOnce(
          frames.length > 0
            ? {
                mediaId,
                duration,
                frames,
                frameInterval: config.frameInterval,
              }
            : null,
        )
      }
    }, 30000) // 30 second timeout
    video.src = videoUrl
  })
}

/**
 * 素材の直近の成功結果を診断用に取得する
 */
export function getCachedFilmstrip(mediaId: string): FilmstripData | null {
  // 診断用。抽出時の再利用判定は必ず実ファイル・URL・設定も照合する。
  const entries = [...extractions.values()].reverse()
  return entries.find((entry) => entry.mediaId === mediaId && entry.result)?.result ?? null
}

export function clearFilmstripCache(mediaId: string): void {
  for (const [key, entry] of extractions) {
    if (entry.mediaId !== mediaId) continue
    extractions.delete(key)
    entry.controller.abort()
  }
}

export function clearAllFilmstripCache(): void {
  for (const entry of extractions.values()) entry.controller.abort()
  extractions.clear()
}

/**
 * Get frames visible in a time range
 */
export function getVisibleFrames(
  filmstrip: FilmstripData,
  startTime: number,
  endTime: number,
  inPoint: number = 0,
): FilmstripFrame[] {
  // Adjust for clip's in-point
  const adjustedStart = startTime + inPoint
  const adjustedEnd = endTime + inPoint

  return filmstrip.frames.filter(
    (frame) => frame.time >= adjustedStart && frame.time <= adjustedEnd,
  )
}

/**
 * Calculate how many frames should be shown based on clip width
 */
export function calculateVisibleFrameCount(
  clipWidth: number,
  thumbnailWidth: number = DEFAULT_CONFIG.thumbnailWidth,
): number {
  return Math.max(1, Math.floor(clipWidth / thumbnailWidth))
}
