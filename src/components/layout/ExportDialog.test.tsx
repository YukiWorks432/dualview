import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({
  hooks: [] as unknown[],
  index: 0,
  mode: 'video',
  download: vi.fn<(blob: Blob, filename: string) => void>(),
  disposedMuxers: [] as Array<ReturnType<typeof vi.fn>>,
  drawFails: false,
  shaderFails: false,
  stitchReady: false,
  renderers: [] as Array<{ disposed: boolean }>,
}))
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = harness.index++
      if (!(index in harness.hooks))
        harness.hooks[index] = initial === 'video' ? harness.mode : initial
      return [
        harness.hooks[index],
        (value: unknown) => {
          harness.hooks[index] = value
        },
      ]
    },
    useRef: (initial: unknown) => {
      const index = harness.index++
      if (!(index in harness.hooks)) harness.hooks[index] = { current: initial }
      return harness.hooks[index]
    },
    useEffect: () => {},
    useMemo: (fn: () => unknown) => fn(),
    useCallback: (fn: unknown) => fn,
    useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  }
})
vi.mock('../../stores/timelineStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../stores/timelineStore')>()
  return {
    ...actual,
    useTimelineStore: Object.assign(
      () => actual.useTimelineStore.getState(),
      actual.useTimelineStore,
    ),
  }
})
vi.mock('../../stores/mediaStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../stores/mediaStore')>()
  return {
    ...actual,
    useMediaStore: Object.assign(() => actual.useMediaStore.getState(), actual.useMediaStore),
  }
})
vi.mock('../../stores/playbackStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../stores/playbackStore')>()
  return {
    ...actual,
    usePlaybackStore: Object.assign(
      () => actual.usePlaybackStore.getState(),
      actual.usePlaybackStore,
    ),
  }
})
vi.mock('../../stores/projectStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../stores/projectStore')>()
  return {
    ...actual,
    useProjectStore: Object.assign(() => actual.useProjectStore.getState(), actual.useProjectStore),
  }
})
vi.mock('../../lib/mp4Muxer', () => ({
  createAvcMp4Muxer: async () => {
    const dispose = vi.fn<() => void>()
    harness.disposedMuxers.push(dispose)
    return {
      addChunk: vi.fn<() => void>(),
      finalize: async () => new TextEncoder().encode('encoded-mp4').buffer,
      dispose,
    }
  },
}))
vi.mock('../../lib/sweepExport', () => ({ downloadVideo: harness.download }))
vi.mock('../../lib/webgl/WebGLTransitionRenderer', () => ({
  WebGLTransitionRenderer: class {
    static isSupported() {
      return true
    }
    disposed = false
    constructor() {
      harness.renderers.push(this)
    }
    loadTransition() {
      return !harness.shaderFails
    }
    updateTexture() {}
    render() {}
    getCanvas() {
      return new TestCanvas()
    }
    dispose() {
      this.disposed = true
    }
  },
}))

import { exportStitchedVideo } from '../../lib/stitchExport'
import { useMediaStore } from '../../stores/mediaStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useProjectStore } from '../../stores/projectStore'
import { useTimelineStore } from '../../stores/timelineStore'
import type { MediaFile, TimelineTrack } from '../../types'
import { ExportDialog } from './ExportDialog'

const encoders: TestEncoder[] = []
const frames: TestFrame[] = []
const streams: Array<{ stopped: boolean }> = []
const recorders: TestRecorder[] = []
class TestImage extends EventTarget {
  complete = true
  naturalWidth = 100
  naturalHeight = 100
  width = 100
  height = 100
  dataset = {}
  src = ''
  removeAttribute() {
    this.src = ''
  }
}
class TestVideo extends EventTarget {
  static HAVE_CURRENT_DATA = 2
  readyState = 2
  seeking = false
  duration = 1
  videoWidth = 100
  videoHeight = 100
  dataset = {}
  paused = true
  src = 'test-video'
  failSeek = false
  stallSeek = false
  stallRestore = false
  private time = 0.2
  set currentTime(time: number) {
    this.time = time
    if (time === 0.2) {
      if (this.stallRestore && encoders.every((encoder) => encoder.state === 'closed')) {
        this.seeking = true
        this.dataset = { frameReady: 'false' }
        return
      }
      this.seeking = false
      queueMicrotask(() => this.dispatchEvent(new Event('seeked')))
      return
    }
    if (!this.stallSeek)
      queueMicrotask(() => this.dispatchEvent(new Event(this.failSeek ? 'error' : 'seeked')))
  }
  get currentTime() {
    return this.time
  }
  pause() {
    this.paused = true
  }
  async play() {
    this.paused = false
  }
  load() {}
  removeAttribute() {
    this.src = ''
  }
}
class TestCanvas {
  width = 1
  height = 1
  dataset = {}
  getContext() {
    return new Proxy(
      {},
      {
        get: (_, name) =>
          name === 'drawImage'
            ? () => {
                if (harness.drawFails) throw new Error('capture failed')
              }
            : () => {},
      },
    )
  }
  captureStream() {
    const track = {
      stopped: false,
      stop() {
        this.stopped = true
      },
    }
    streams.push(track)
    return { getTracks: () => [track] }
  }
}
class TestRecorder {
  static supported = false
  static isTypeSupported() {
    return this.supported
  }
  state = 'inactive'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor() {
    recorders.push(this)
  }
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['webm']) })
    this.onstop?.()
  }
}
class TestEncoder {
  static failure = ''
  static stallFlush = false
  state = 'unconfigured'
  config?: VideoEncoderConfig
  encoded = 0
  constructor() {
    encoders.push(this)
  }
  configure(config: VideoEncoderConfig) {
    if (TestEncoder.failure === 'configure') throw new Error('configure failed')
    this.config = config
    this.state = 'configured'
  }
  encode() {
    if (TestEncoder.failure === 'encode') throw new Error('encode failed')
    this.encoded++
  }
  async flush() {
    if (TestEncoder.failure === 'flush') throw new Error('flush failed')
    if (TestEncoder.stallFlush) await new Promise(() => {})
  }
  close() {
    this.state = 'closed'
  }
}
class TestFrame {
  closed = false
  constructor() {
    frames.push(this)
  }
  close() {
    this.closed = true
  }
}
function findPanel(
  node: unknown,
): { onExport: () => void; onClose: () => void; isExporting: boolean } | undefined {
  if (!node || typeof node !== 'object') return
  const element = node as ReactElement<Record<string, unknown>>
  if (element.props?.onExport) return element.props as ReturnType<typeof findPanel>
  for (const child of [element.props?.children].flat(Infinity)) {
    const found = findPanel(child)
    if (found) return found
  }
}
let video: TestVideo | null = null
let ownedVideo: TestVideo | null = null
function panel() {
  harness.index = 0
  const image = new TestImage()
  const container = { querySelector: () => video, querySelectorAll: () => [video ?? image] }
  const canvasRef = { current: { parentElement: { parentElement: container } } }
  return findPanel(
    ExportDialog({
      isOpen: true,
      onClose: vi.fn<() => void>(),
      canvasRef: canvasRef as never,
      captureFrame: () => null,
    }),
  )!
}
async function finished(status: 'done' | 'error' | 'idle') {
  await vi.waitFor(() => {
    expect(useProjectStore.getState().exportProgress.status).toBe(status)
    expect(panel().isExporting).toBe(false)
    expect(usePlaybackStore.getState().isExporting).toBe(false)
  })
  expect(encoders.every((encoder) => encoder.state === 'closed')).toBe(true)
  expect(frames.every((frame) => frame.closed)).toBe(true)
  expect(harness.disposedMuxers.every((dispose) => dispose.mock.calls.length === 1)).toBe(true)
  expect(harness.renderers.every((renderer) => renderer.disposed)).toBe(true)
}
beforeEach(() => {
  vi.clearAllMocks()
  harness.hooks = []
  harness.index = 0
  harness.mode = 'video'
  harness.disposedMuxers = []
  harness.renderers = []
  harness.drawFails = false
  harness.shaderFails = false
  harness.stitchReady = false
  encoders.length = 0
  frames.length = 0
  streams.length = 0
  recorders.length = 0
  TestEncoder.failure = ''
  TestEncoder.stallFlush = false
  TestRecorder.supported = false
  video = null
  ownedVideo = null
  vi.stubGlobal('HTMLImageElement', TestImage)
  vi.stubGlobal('HTMLVideoElement', TestVideo)
  vi.stubGlobal('HTMLMediaElement', TestVideo)
  vi.stubGlobal('HTMLCanvasElement', TestCanvas)
  vi.stubGlobal('VideoEncoder', TestEncoder)
  vi.stubGlobal('VideoFrame', TestFrame)
  vi.stubGlobal('MediaRecorder', TestRecorder)
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', vi.fn<() => void>())
  vi.stubGlobal('window', { dispatchEvent: vi.fn<() => void>() })
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      if (tag === 'video') {
        ownedVideo = new TestVideo()
        ownedVideo.readyState = harness.stitchReady ? 2 : 0
        return ownedVideo
      }
      return new TestCanvas()
    },
  })
  useProjectStore.getState().setExportSettings({
    format: 'mp4',
    exportSource: 'comparison',
    videoLoops: 1,
    sweepStyle: 'horizontal',
  })
  useProjectStore.getState().setExportProgress({ status: 'idle', progress: 0 })
  useTimelineStore.setState({ tracks: [], duration: 1 })
  useMediaStore.setState({ files: [] })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('animated export ownership at the dialog boundary', () => {
  it.each(['comparison', 'a-only', 'b-only'] as const)(
    'exports %s MP4 without WebM support and can repeat',
    async (exportSource) => {
      useProjectStore.getState().setExportSettings({ exportSource })
      for (let run = 0; run < 2; run++) {
        panel().onExport()
        await finished('done')
      }
      expect(harness.download).toHaveBeenCalledTimes(2)
      const blob = harness.download.mock.calls[0][0] as Blob
      expect(blob.type).toBe('video/mp4')
      expect(await blob.text()).toBe('encoded-mp4')
      expect(encoders[0].config).toMatchObject({ width: 1920, height: 1080, framerate: 30 })
      expect(encoders[0].encoded).toBe(30)
      expect(streams).toHaveLength(0)
      expect(recorders).toHaveLength(0)
    },
  )
  it.each(['configure', 'encode', 'flush', 'capture'])(
    'releases failed %s resources and permits another export',
    async (failure) => {
      TestEncoder.failure = failure
      harness.drawFails = failure === 'capture'
      panel().onExport()
      await finished('error')
      expect(harness.download).not.toHaveBeenCalled()
      TestEncoder.failure = ''
      harness.drawFails = false
      panel().onExport()
      await finished('done')
      expect(harness.download).toHaveBeenCalledTimes(1)
    },
  )
  it('cancels a pending flush without downloading and immediately permits retry', async () => {
    TestEncoder.stallFlush = true
    panel().onExport()
    await vi.waitFor(() => expect(encoders[0]?.encoded).toBe(30))
    panel().onClose()
    await finished('idle')
    expect(harness.download).not.toHaveBeenCalled()
    TestEncoder.stallFlush = false
    panel().onExport()
    await finished('done')
  })
  it.each(['error', 'cancel'] as const)(
    'settles a video seek on %s and restores the borrowed preview position',
    async (outcome) => {
      video = new TestVideo()
      video.failSeek = outcome === 'error'
      video.stallSeek = outcome === 'cancel'
      panel().onExport()
      await vi.waitFor(() => expect(encoders).toHaveLength(1))
      if (outcome === 'cancel') panel().onClose()
      await finished(outcome === 'cancel' ? 'idle' : 'error')
      expect(video.currentTime).toBe(0.2)
      expect(video.paused).toBe(true)
      expect(video.src).toBe('test-video')
      expect(harness.download).not.toHaveBeenCalled()
    },
  )
  it.each(['success', 'failure', 'cancel'])(
    'holds the dialog lock through preview restoration after %s',
    async (outcome) => {
      let present: () => void = () => {}
      let observing = false
      vi.stubGlobal(
        'MutationObserver',
        class {
          constructor(callback: () => void) {
            present = callback
          }
          observe() {
            observing = true
          }
          disconnect() {
            observing = false
          }
        },
      )
      video = new TestVideo()
      video.stallRestore = true
      TestEncoder.failure = outcome === 'failure' ? 'encode' : ''
      TestEncoder.stallFlush = outcome === 'cancel'
      panel().onExport()
      await vi.waitFor(() => expect(encoders[0]?.encoded).toBe(outcome === 'failure' ? 0 : 30))
      if (outcome === 'cancel') panel().onClose()
      await vi.waitFor(() => {
        expect(video!.currentTime).toBe(0.2)
        expect(video!.seeking).toBe(true)
      })
      expect(panel().isExporting).toBe(true)
      expect(usePlaybackStore.getState().isExporting).toBe(true)
      panel().onExport()
      expect(encoders).toHaveLength(1)
      video.seeking = false
      video.dispatchEvent(new Event('seeked'))
      await vi.waitFor(() => expect(observing).toBe(true))
      expect(panel().isExporting).toBe(true)
      video.dataset = { frameReady: 'true' }
      present()
      await finished(outcome === 'success' ? 'done' : outcome === 'failure' ? 'error' : 'idle')
      video.stallRestore = false
      TestEncoder.failure = ''
      TestEncoder.stallFlush = false
      panel().onExport()
      await finished('done')
      expect(encoders).toHaveLength(2)
    },
  )
  it('stops WebM recording and its tracks on cancellation', async () => {
    TestRecorder.supported = true
    useProjectStore.getState().setExportSettings({ format: 'webm' })
    panel().onExport()
    await vi.waitFor(() => expect(recorders[0]?.state).toBe('recording'))
    panel().onClose()
    await finished('idle')
    expect(recorders[0].state).toBe('inactive')
    expect(streams[0].stopped).toBe(true)
    expect(harness.download).not.toHaveBeenCalled()
  })
  it.each(['shader', 'flush', 'success'])(
    'disposes transition resources after %s',
    async (outcome) => {
      harness.mode = 'transition'
      harness.shaderFails = outcome === 'shader'
      TestEncoder.failure = outcome === 'flush' ? 'flush' : ''
      panel().onExport()
      await finished(outcome === 'success' ? 'done' : 'error')
      expect(harness.renderers).toHaveLength(1)
      expect(harness.download).toHaveBeenCalledTimes(outcome === 'success' ? 1 : 0)
    },
  )
})

describe('stitch source lifetime', () => {
  const track = {
    id: 'track-a',
    clips: [{ id: 'clip', mediaId: 'video', startTime: 0, inPoint: 0, outPoint: 1 }],
  } as TimelineTrack
  const getFile = () => ({ id: 'video', type: 'video', url: 'video', name: 'video' }) as MediaFile
  it.each(['success', 'encode', 'flush'])(
    'releases a decoded stitch source after %s and permits retry',
    async (outcome) => {
      harness.stitchReady = true
      TestEncoder.failure = outcome === 'success' ? '' : outcome
      const settings = {
        trackId: 'track-a',
        format: 'mp4',
        resolution: '720p',
        quality: 'low',
        fps: 30,
        includeAudio: false,
      } as const
      const result = await exportStitchedVideo(track, getFile, settings, () => {}).catch(
        (error: unknown) => error,
      )
      expect(result instanceof Blob).toBe(outcome === 'success')
      expect(ownedVideo!.src).toBe('')
      expect(encoders[0].state).toBe('closed')
      expect(frames.every((frame) => frame.closed)).toBe(true)
      TestEncoder.failure = ''
      const retry = await exportStitchedVideo(track, getFile, settings, () => {})
      expect(retry?.type).toBe('video/mp4')
      expect(await retry?.text()).toBe('encoded-mp4')
      expect(ownedVideo!.src).toBe('')
      expect(encoders[1].state).toBe('closed')
    },
  )
  it.each(['error', 'cancel'])('detaches a source when loading ends in %s', async (outcome) => {
    const controller = new AbortController()
    const pending = exportStitchedVideo(
      track,
      getFile,
      {
        trackId: 'track-a',
        format: 'mp4',
        resolution: '720p',
        quality: 'low',
        fps: 30,
        includeAudio: false,
      },
      vi.fn<() => void>(),
      controller.signal,
    )
    const settled = pending.catch((error: unknown) => error)
    await vi.waitFor(() => expect(ownedVideo).not.toBeNull())
    if (outcome === 'cancel') controller.abort()
    else ownedVideo!.dispatchEvent(new Event('error'))
    await expect(settled).resolves.toBeInstanceOf(Error)
    expect(ownedVideo!.src).toBe('')
    expect(ownedVideo!.paused).toBe(true)
    expect(encoders[0].state).toBe('closed')
    expect(harness.disposedMuxers[0]).toHaveBeenCalledTimes(1)
  })
})
