import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MediaFile, TimelineClip } from '../types'

const runtime = vi.hoisted(() => ({
  cleanups: [] as (() => void)[],
  getCanvas: vi.fn<
    (time: number) => Promise<{
      timestamp: number
      duration: number
      canvas: { width: number; height: number }
    }>
  >(),
  dispose: vi.fn<() => void>(),
}))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useEffect: (effect: () => () => void) => runtime.cleanups.push(effect()),
}))
vi.mock('../lib/media/prores', () => ({ ensureProResDecoder: async () => {} }))
vi.mock('mediabunny', () => ({
  ALL_FORMATS: [],
  BlobSource: class {},
  Input: class {
    getPrimaryVideoTrack = async () => ({})
    dispose = runtime.dispose
  },
  CanvasSink: class {
    getCanvas = runtime.getCanvas
  },
}))

import { usePlaybackStore as playback } from '../stores/playbackStore'
import { useTimelineStore as timeline } from '../stores/timelineStore'
import { useProResClipSync } from './useProResClipSync'

function deferredFrame(timestamp: number) {
  let resolve!: (frame: {
    timestamp: number
    duration: number
    canvas: { width: number; height: number }
  }) => void
  const promise = new Promise<Parameters<typeof resolve>[0]>((done) => {
    resolve = done
  })
  return {
    promise,
    resolve: () => resolve({ timestamp, duration: 1 / 30, canvas: { width: 64, height: 64 } }),
  }
}
const clip: TimelineClip = {
  id: 'clip',
  trackId: 'a',
  mediaId: 'media',
  startTime: 0,
  endTime: 10,
  inPoint: 0,
  outPoint: 10,
}
const media = {
  id: 'media',
  file: new File([], 'test.mov'),
  playbackBackend: 'mediabunny',
} as MediaFile
function ProResHarness(targetClip = clip) {
  const context = { clearRect: vi.fn<() => void>(), drawImage: vi.fn<() => void>() }
  const canvas = {
    dataset: {} as Record<string, string>,
    width: 64,
    height: 64,
    getContext: () => context,
  }
  useProResClipSync({ current: canvas as unknown as HTMLCanvasElement }, media, targetClip)
  return { canvas, context }
}

beforeEach(() => {
  runtime.cleanups.length = 0
  runtime.getCanvas.mockReset()
  runtime.dispose.mockClear()
  vi.stubGlobal('window', { dispatchEvent: vi.fn<(event: Event) => void>() })
  timeline.setState(timeline.getInitialState())
  playback.setState(playback.getInitialState())
})
afterEach(() => {
  runtime.cleanups.forEach((cleanup) => cleanup?.())
  vi.unstubAllGlobals()
})

describe('ProRes seek request lifetime', () => {
  it('presents only the latest frame after rapid paused seeks resolve out of date', async () => {
    const first = deferredFrame(0)
    const last = deferredFrame(3)
    runtime.getCanvas.mockReturnValueOnce(first.promise).mockReturnValueOnce(last.promise)
    const { canvas, context } = ProResHarness()
    await vi.waitFor(() => expect(runtime.getCanvas).toHaveBeenCalledWith(0))
    playback.getState().seek(1)
    playback.getState().seek(3)
    first.resolve()
    await vi.waitFor(() => expect(runtime.getCanvas).toHaveBeenLastCalledWith(3))
    expect(context.drawImage).not.toHaveBeenCalled()
    expect(canvas.dataset.frameReady).toBe('false')
    last.resolve()
    await vi.waitFor(() => expect(canvas.dataset.frameRequestedMediaTime).toBe('3'))
    expect(canvas.dataset.framePresentedGeneration).toBe(canvas.dataset.frameSeekGeneration)
    expect(canvas.dataset.frameClipId).toBe('clip')
    expect(context.drawImage).toHaveBeenCalledOnce()
  })

  it('invalidates a pending frame even when the adopted project seeks to the same time', async () => {
    const old = deferredFrame(0)
    const fresh = deferredFrame(0)
    runtime.getCanvas.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise)
    const { canvas, context } = ProResHarness()
    await vi.waitFor(() => expect(runtime.getCanvas).toHaveBeenCalledOnce())
    playback.getState().seek(0)
    old.resolve()
    await vi.waitFor(() => expect(runtime.getCanvas).toHaveBeenCalledTimes(2))
    expect(context.drawImage).not.toHaveBeenCalled()
    fresh.resolve()
    await vi.waitFor(() => expect(canvas.dataset.frameReady).toBe('true'))
    expect(context.drawImage).toHaveBeenCalledOnce()
  })

  it('does not present a late response from the previous clip after remounting', async () => {
    const old = deferredFrame(0)
    const fresh = deferredFrame(2)
    runtime.getCanvas.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise)
    const previous = ProResHarness()
    await vi.waitFor(() => expect(runtime.getCanvas).toHaveBeenCalledOnce())
    runtime.cleanups.pop()?.()
    const current = ProResHarness({ ...clip, id: 'next', inPoint: 2 })
    await vi.waitFor(() => expect(runtime.getCanvas).toHaveBeenCalledTimes(2))
    fresh.resolve()
    await vi.waitFor(() => expect(current.canvas.dataset.frameClipId).toBe('next'))
    old.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(previous.context.drawImage).not.toHaveBeenCalled()
    expect(current.canvas.dataset.frameRequestedMediaTime).toBe('2')
    expect(runtime.dispose).toHaveBeenCalledOnce()
  })
})
