// @ts-expect-error - gif.js-upgrade does not publish TypeScript declarations
import GIF from 'gif.js-upgrade'

import { throwIfAborted, waitForExport } from './exportResources'

export interface GifExportOptions {
  width: number
  height: number
  fps: number
  quality: number // 1-20, lower is better quality
}

const GIF_PRESETS = {
  small: { width: 320, height: 180, fps: 10, quality: 10 },
  medium: { width: 480, height: 270, fps: 12, quality: 10 },
  large: { width: 640, height: 360, fps: 15, quality: 10 },
  hd: { width: 854, height: 480, fps: 15, quality: 10 },
}

/**
 * Create GIF from canvas frames
 */
export async function createGifFromFrames(
  frames: ImageData[],
  preset: 'small' | 'medium' | 'large' | 'hd',
  onProgress: (progress: number, message: string) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  throwIfAborted(signal)
  const options = GIF_PRESETS[preset]
  const gif = new GIF({
    workers: 2,
    quality: options.quality,
    width: options.width,
    height: options.height,
    workerScript: `${import.meta.env.BASE_URL}gif.worker.js`,
  })
  try {
    const frameDelay = Math.round(1000 / options.fps)
    frames.forEach((frame) => gif.addFrame(frame, { delay: frameDelay }))
    return await waitForExport(
      new Promise<Blob>((resolve, reject) => {
        gif.on('progress', (progress: number) => onProgress(progress * 100, 'Encoding GIF...'))
        gif.on('finished', resolve)
        gif.on('error', reject)
        gif.render()
        // gif.js exposes no worker-disposal API and abort() only stops active workers.
        // Register native worker errors as well, otherwise a failed worker never settles.
        for (const worker of [...gif.activeWorkers, ...gif.freeWorkers] as Worker[]) {
          worker.onerror = () => reject(new Error('GIF worker failed'))
        }
      }),
      signal,
    )
  } finally {
    gif.removeAllListeners()
    const workers = new Set<Worker>([...gif.activeWorkers, ...gif.freeWorkers])
    gif.abort()
    for (const worker of workers) {
      worker.onmessage = null
      worker.onerror = null
      worker.terminate()
    }
    gif.activeWorkers.length = 0
    gif.freeWorkers.length = 0
    gif.frames.length = 0
  }
}

/**
 * Capture frames from a canvas during animation
 */
export function captureFrame(
  canvas: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number,
): ImageData {
  // Create a temporary canvas at target size
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = targetWidth
  tempCanvas.height = targetHeight
  const ctx = tempCanvas.getContext('2d')!

  // Draw scaled version
  ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight)

  return ctx.getImageData(0, 0, targetWidth, targetHeight)
}

/**
 * Export sweep animation as GIF
 * Records frames during the sweep and encodes to GIF
 */
export async function exportSweepAsGif(
  drawFrame: (progress: number) => HTMLCanvasElement,
  durationMs: number,
  preset: 'small' | 'medium' | 'large' | 'hd',
  onProgress: (progress: number, message: string) => void,
): Promise<Blob> {
  const options = GIF_PRESETS[preset]
  const totalFrames = Math.ceil((durationMs / 1000) * options.fps)
  const frames: ImageData[] = []

  onProgress(0, 'Capturing frames...')

  // Capture frames
  for (let i = 0; i < totalFrames; i++) {
    const progress = (i / totalFrames) * 100
    const canvas = drawFrame(progress)
    const frame = captureFrame(canvas, options.width, options.height)
    frames.push(frame)

    if (i % 5 === 0) {
      onProgress((i / totalFrames) * 30, `Capturing frame ${i + 1}/${totalFrames}`)
    }

    // Small delay to prevent blocking
    if (i % 10 === 0) {
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  onProgress(30, 'Encoding GIF...')

  // Create GIF
  const blob = await createGifFromFrames(frames, preset, (p, msg) => {
    onProgress(30 + p * 0.7, msg)
  })

  return blob
}

export { GIF_PRESETS }
