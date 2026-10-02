import { afterEach, describe, expect, it, vi } from 'vitest'

import { seekVideoAndWait, waitForMedia } from './exportResources'
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
