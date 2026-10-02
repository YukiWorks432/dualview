import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ExportResources,
  preserveVideoPositions,
  seekVideoAndWait,
  waitForMedia,
} from './exportResources'
import { WebGLTransitionRenderer } from './webgl/WebGLTransitionRenderer'

class PendingMedia extends EventTarget {
  currentTime = 0
  duration = 1
  seeking = false
  listeners = new Set<EventListenerOrEventListenerObject | null>()
  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ) {
    this.listeners.add(listener)
    super.addEventListener(type, listener, options)
  }
  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ) {
    this.listeners.delete(listener)
    super.removeEventListener(type, listener, options)
  }
}
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('export media waits', () => {
  it.each(['canplay', 'load', 'seeked'] as const)(
    'rejects a missing %s event and releases listeners and timers',
    async (event) => {
      vi.useFakeTimers()
      const media = new PendingMedia()
      const pending = waitForMedia(media as unknown as HTMLVideoElement, event, () => {})
      const result = pending.catch((error: unknown) => error)
      await vi.advanceTimersByTimeAsync(10_000)
      await expect(result).resolves.toMatchObject({ message: `Export media ${event} timeout` })
      expect(media.listeners.size).toBe(0)
      expect(vi.getTimerCount()).toBe(0)
    },
  )
  it('does not wait for a new seek event when clamping resolves to the current frame', async () => {
    const media = new PendingMedia()
    media.currentTime = 0.999
    await seekVideoAndWait(media as unknown as HTMLVideoElement, 10)
    expect(media.listeners.size).toBe(0)
  })
  it('removes a pending seek on abort and can immediately seek the same element again', async () => {
    vi.useFakeTimers()
    const media = new PendingMedia()
    const controller = new AbortController()
    const pending = seekVideoAndWait(media as unknown as HTMLVideoElement, 0.5, controller.signal)
    const result = pending.catch((error: unknown) => error)
    controller.abort()
    await expect(result).resolves.toMatchObject({ name: 'AbortError' })
    expect(media.listeners.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    const retry = seekVideoAndWait(media as unknown as HTMLVideoElement, 0.75)
    media.dispatchEvent(new Event('seeked'))
    await retry
    expect(media.currentTime).toBe(0.75)
    expect(media.listeners.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})

it('releases temporary WebGL support-check contexts on repeated checks', () => {
  const loseContext = vi.fn<() => void>()
  vi.stubGlobal('document', {
    createElement: () => ({ getContext: () => ({ getExtension: () => ({ loseContext }) }) }),
  })
  expect(WebGLTransitionRenderer.isSupported()).toBe(true)
  expect(WebGLTransitionRenderer.isSupported()).toBe(true)
  expect(loseContext).toHaveBeenCalledTimes(2)
})

it('does not invalidate an unchanged borrowed preview frame by seeking it again', async () => {
  const seek = vi.fn<(time: number) => void>()
  const video = {
    get currentTime() {
      return 0.25
    },
    set currentTime(time: number) {
      seek(time)
    },
    pause() {},
  }
  const resources = new ExportResources()
  preserveVideoPositions(resources, [video as HTMLVideoElement])
  await resources.dispose()
  expect(seek).not.toHaveBeenCalled()
})

it('keeps cleanup pending until the restored seek and preview presentation both finish', async () => {
  let notify: () => void = () => {}
  const disconnect = vi.fn<() => void>()
  vi.stubGlobal(
    'MutationObserver',
    class {
      constructor(callback: () => void) {
        notify = callback
      }
      observe() {}
      disconnect = disconnect
    },
  )
  const video = Object.assign(new PendingMedia(), {
    src: 'borrowed-video',
    isConnected: true,
    dataset: { frameReady: 'true' },
    pause() {},
  })
  video.currentTime = 0.25
  const resources = new ExportResources()
  preserveVideoPositions(resources, [video as unknown as HTMLVideoElement])
  video.currentTime = 0.75
  video.dataset.frameReady = 'false'
  let disposed = false
  const disposal = resources.dispose().then(() => {
    disposed = true
  })
  expect(video.currentTime).toBe(0.25)
  expect(disposed).toBe(false)
  video.dispatchEvent(new Event('seeked'))
  await Promise.resolve()
  await Promise.resolve()
  expect(disposed).toBe(false)
  video.dataset.frameReady = 'true'
  notify()
  await disposal
  expect(disposed).toBe(true)
  expect(disconnect).toHaveBeenCalledTimes(1)
  expect(video.listeners.size).toBe(0)
})

it.each(['error', 'timeout'])(
  'releases the restoration observer and timer after %s',
  async (outcome) => {
    vi.useFakeTimers()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const disconnect = vi.fn<() => void>()
    vi.stubGlobal(
      'MutationObserver',
      class {
        observe() {}
        disconnect = disconnect
      },
    )
    const video = Object.assign(new PendingMedia(), {
      src: 'borrowed-video',
      dataset: { frameReady: 'false' },
      pause() {},
    })
    const resources = new ExportResources()
    preserveVideoPositions(resources, [video as unknown as HTMLVideoElement])
    const pending = resources.dispose()
    await Promise.resolve()
    await Promise.resolve()
    if (outcome === 'error') video.dispatchEvent(new Event('error'))
    else await vi.advanceTimersByTimeAsync(10_000)
    await pending
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    expect(video.listeners.size).toBe(0)
    expect(log).toHaveBeenCalledTimes(1)
    log.mockRestore()
  },
)
