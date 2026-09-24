import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePlaybackStore } from './playbackStore'
import { useTimelineStore } from './timelineStore'

class TestCustomEvent<T> {
  type: string
  detail: T

  constructor(type: string, init: { detail: T }) {
    this.type = type
    this.detail = init.detail
  }
}

describe('playback loop synchronization', () => {
  let frameCallback: FrameRequestCallback | null = null
  const dispatchEvent = vi.fn<(event: unknown) => boolean>(() => true)

  beforeEach(() => {
    frameCallback = null
    dispatchEvent.mockClear()

    vi.stubGlobal('CustomEvent', TestCustomEvent)
    vi.stubGlobal('window', { dispatchEvent })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frameCallback = callback
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    useTimelineStore.setState({
      currentTime: 1.95,
      duration: 10,
      frameRate: 30,
      loopRegion: { inPoint: 1, outPoint: 2 },
      isPlaying: false,
    })
    usePlaybackStore.setState({
      currentTime: 1.95,
      isPlaying: false,
      playbackSpeed: 1,
      _animationFrameId: null,
      _lastUpdateTime: null,
    })
  })

  afterEach(() => {
    usePlaybackStore.getState().pause()
    vi.unstubAllGlobals()
  })

  it('dispatches a seek event when playback wraps to the loop in point', () => {
    usePlaybackStore.getState().play()
    expect(frameCallback).not.toBeNull()

    frameCallback?.(1000)
    expect(frameCallback).not.toBeNull()

    frameCallback?.(1100)

    const seekEvent = dispatchEvent.mock.calls
      .map(([event]) => event as TestCustomEvent<{ time: number }>)
      .find((event) => event.type === 'playback-seek')

    expect(seekEvent?.detail.time).toBe(1)
  })
})
