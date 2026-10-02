import { createAvcMp4Muxer } from './mp4Muxer'

/** Resources and cancellable waits owned by one animated export. */
export class ExportResources {
  readonly controller = new AbortController()
  private cleanups: Array<() => void | Promise<void>> = []

  get signal() {
    return this.controller.signal
  }

  defer(cleanup: () => void | Promise<void>) {
    this.cleanups.push(cleanup)
  }

  async dispose() {
    this.controller.abort()
    for (const cleanup of this.cleanups.splice(0).reverse()) {
      try {
        await cleanup()
      } catch (error) {
        // A failed cleanup must not strand the remaining resources or the UI lock.
        console.error('Export cleanup failed:', error)
      }
    }
  }
}

export function abortError() {
  return new DOMException('Export cancelled', 'AbortError')
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason ?? abortError()
}

/** Observe a promise without leaving an abort listener behind after it settles. */
export function waitForExport<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal?.removeEventListener('abort', onAbort)
      reject(signal?.reason ?? abortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    promise.then(resolve, reject).finally(() => signal?.removeEventListener('abort', onAbort))
    if (signal?.aborted) onAbort()
  })
}

export function yieldToExport(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      if (signal?.aborted) reject(signal.reason ?? abortError())
      else resolve()
    }
    const onAbort = () => finish()
    const timer = setTimeout(finish, 0)
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) finish()
  })
}

export function waitForMedia(
  media: HTMLMediaElement | HTMLImageElement,
  event: 'seeked' | 'canplay' | 'load',
  start: () => void,
  signal?: AbortSignal,
  timeoutMs = 10_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error?: unknown) => {
      clearTimeout(timer)
      media.removeEventListener(event, onReady)
      media.removeEventListener('error', onError)
      signal?.removeEventListener('abort', onAbort)
      if (error) reject(error)
      else resolve()
    }
    const onReady = () => finish()
    const onError = () => finish(new Error('Export media failed to load or seek'))
    const onAbort = () => finish(signal?.reason ?? abortError())
    const timer = setTimeout(() => finish(new Error(`Export media ${event} timeout`)), timeoutMs)
    media.addEventListener(event, onReady, { once: true })
    media.addEventListener('error', onError, { once: true })
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) onAbort()
    else {
      try {
        start()
      } catch (error) {
        finish(error)
      }
    }
  })
}

export async function seekVideoAndWait(
  video: HTMLVideoElement,
  time: number,
  signal?: AbortSignal,
): Promise<void> {
  throwIfAborted(signal)
  const target = Math.max(
    0,
    Math.min(time, Number.isFinite(video.duration) ? video.duration - 0.001 : time),
  )
  if (!video.seeking && Math.abs(video.currentTime - target) < 0.001) return
  await waitForMedia(
    video,
    'seeked',
    () => {
      video.currentTime = target
    },
    signal,
  )
}

/** The preview owns these elements; restore their paused position, never detach them. */
export function preserveVideoPositions(
  resources: ExportResources,
  videos: Array<HTMLVideoElement | null>,
) {
  for (const video of videos) {
    if (!video) continue
    const time = video.currentTime
    video.pause()
    resources.defer(() => {
      video.pause()
      if (Math.abs(video.currentTime - time) > 0.001) video.currentTime = time
    })
  }
}

export function encodeCanvasFrame(
  encoder: VideoEncoder,
  canvas: HTMLCanvasElement,
  index: number,
  fps: number,
) {
  const frame = new VideoFrame(canvas, {
    timestamp: Math.round((index * 1_000_000) / fps),
    duration: Math.round(1_000_000 / fps),
  })
  try {
    encoder.encode(frame, { keyFrame: index % fps === 0 })
  } finally {
    frame.close()
  }
}

/** Only WebM exports create a stream, recorder, timers, and animation callbacks. */
export async function recordCanvasWebM(
  canvas: HTMLCanvasElement,
  durationMs: number,
  bitrate: number,
  draw: (elapsedMs: number) => void,
  signal: AbortSignal,
  startPlayback: () => Promise<void>,
): Promise<Blob> {
  throwIfAborted(signal)
  const mimeType = 'video/webm;codecs=vp9'
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported(mimeType)) {
    throw new Error('Video recording not supported')
  }
  const stream = canvas.captureStream(30)
  let recorder: MediaRecorder | undefined
  let animation: number | undefined
  let deadline: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined
  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate })
    await waitForExport(startPlayback(), signal)
    throwIfAborted(signal)
    draw(0)
    const activeRecorder = recorder
    return await new Promise<Blob>((resolve, reject) => {
      const chunks: Blob[] = []
      onAbort = () => reject(signal.reason ?? abortError())
      signal.addEventListener('abort', onAbort, { once: true })
      activeRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data)
      }
      activeRecorder.onerror = () => reject(new Error('Video recording failed'))
      activeRecorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }))
      const stop = () => {
        try {
          if (activeRecorder.state !== 'inactive') activeRecorder.stop()
        } catch (error) {
          reject(error)
        }
      }
      const started = performance.now()
      const animate = () => {
        try {
          throwIfAborted(signal)
          const elapsed = performance.now() - started
          if (elapsed >= durationMs) {
            stop()
            return
          }
          draw(elapsed)
          animation = requestAnimationFrame(animate)
        } catch (error) {
          reject(error)
        }
      }
      activeRecorder.start(100)
      deadline = setTimeout(stop, durationMs)
      animation = requestAnimationFrame(animate)
    })
  } finally {
    if (animation !== undefined) cancelAnimationFrame(animation)
    if (deadline !== undefined) clearTimeout(deadline)
    if (onAbort) signal.removeEventListener('abort', onAbort)
    try {
      if (recorder) {
        recorder.ondataavailable = null
        recorder.onerror = null
        recorder.onstop = null
        if (recorder.state !== 'inactive') recorder.stop()
      }
    } finally {
      for (const track of stream.getTracks()) track.stop()
    }
  }
}

export async function createMp4ExportEncoder(resources: ExportResources) {
  const muxer = await createAvcMp4Muxer()
  resources.defer(() => muxer.dispose())
  throwIfAborted(resources.signal)
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      try {
        muxer.addChunk(chunk, metadata)
      } catch (error) {
        resources.controller.abort(error)
      }
    },
    error: (error) => resources.controller.abort(error),
  })
  resources.defer(() => {
    if (encoder.state !== 'closed') encoder.close()
  })
  return { encoder, muxer }
}
