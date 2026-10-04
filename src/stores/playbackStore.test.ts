import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePlaybackStore as playback } from './playbackStore'
import { useTimelineStore as timeline } from './timelineStore'

describe('shared playback transport', () => {
  let now: number
  let nextId: number
  const callbacks = new Map<number, FrameRequestCallback>()
  const events: { type: string; detail: { time: number; isPlaying?: boolean } }[] = []

  function advanceBy(ms: number) {
    now += ms
    const pending = [...callbacks.values()]
    callbacks.clear()
    pending.forEach((callback) => callback(now))
  }

  function expectProjection() {
    const state = playback.getState()
    expect(timeline.getState()).toMatchObject({
      currentTime: state.currentTime,
      isPlaying: state.isPlaying,
      playbackSpeed: state.playbackSpeed,
      shuttleSpeed:
        state.isPlaying && state.isShuttling ? state.playbackDirection * state.playbackSpeed : 0,
    })
  }

  beforeEach(() => {
    now = 0
    nextId = 0
    callbacks.clear()
    events.length = 0
    vi.stubGlobal('performance', { now: () => now })
    vi.stubGlobal('window', {
      dispatchEvent: (event: (typeof events)[number]) => events.push(event),
    })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callbacks.set(++nextId, callback)
      return nextId
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id))
    timeline.setState({ ...timeline.getInitialState(), duration: 10, frameRate: 30 })
    playback.setState(playback.getInitialState())
  })

  afterEach(() => {
    playback.getState().pause()
    vi.unstubAllGlobals()
  })

  it('runs J backwards from the first elapsed frame, matching the displayed shuttle rate', () => {
    timeline.getState().seek(5)
    timeline.getState().shuttleBackward()
    advanceBy(100)
    expect(playback.getState().currentTime).toBeCloseTo(4.9)
    expectProjection()
    expect(timeline.getState().shuttleSpeed).toBe(-1)
    timeline.getState().shuttleBackward()
    advanceBy(100)
    expect(playback.getState().currentTime).toBeCloseTo(4.7)
    expect(timeline.getState().shuttleSpeed).toBe(-2)
    expectProjection()
  })

  it('applies L acceleration and speed selection to the same clock without starting extra loops', () => {
    timeline.getState().shuttleForward()
    advanceBy(100)
    timeline.getState().shuttleForward()
    advanceBy(100)
    expect(playback.getState().currentTime).toBeCloseTo(0.3)
    expect(timeline.getState().shuttleSpeed).toBe(2)
    timeline.getState().shuttleForward()
    timeline.getState().shuttleForward()
    timeline.getState().shuttleForward()
    expect(playback.getState().playbackSpeed).toBe(8)
    expect(callbacks.size).toBe(1)
    timeline.getState().setPlaybackSpeed(0.5)
    advanceBy(100)
    expect(playback.getState().currentTime).toBeCloseTo(0.35)
    expect(timeline.getState().shuttleSpeed).toBe(0)
    expectProjection()
  })

  it('accounts for elapsed time at the old rate before changing direction or speed', () => {
    playback.getState().seek(5)
    playback.getState().play()
    now += 50
    playback.getState().setSpeed(2)
    expect(playback.getState().currentTime).toBeCloseTo(5.05)
    advanceBy(50)
    expect(playback.getState().currentTime).toBeCloseTo(5.15)
    timeline.getState().shuttleBackward()
    advanceBy(100)
    expect(playback.getState().currentTime).toBeCloseTo(5.05)
  })

  it('does not count command-time progress twice when a queued frame has an older timestamp', () => {
    playback.getState().seek(1)
    playback.getState().play()
    now = 100
    playback.getState().setSpeed(2)
    expect(playback.getState().currentTime).toBeCloseTo(1.1)
    const pending = [...callbacks.values()]
    callbacks.clear()
    // A frame timestamp is captured before callbacks run; a transport command
    // can already have advanced the clock beyond it in the same rendering turn.
    pending.forEach((callback) => callback(80))
    advanceBy(100)
    playback.getState().pause()
    expect(playback.getState().currentTime).toBeCloseTo(1.3)
    expectProjection()
  })

  it('pauses and resumes reverse playback, while K resets the next playback to normal speed', () => {
    playback.getState().seek(5)
    timeline.getState().shuttleBackward()
    advanceBy(100)
    timeline.getState().togglePlay()
    advanceBy(1000)
    expect(playback.getState().currentTime).toBeCloseTo(4.9)
    expect(callbacks.size).toBe(0)
    playback.getState().togglePlay()
    advanceBy(100)
    expect(playback.getState().currentTime).toBeCloseTo(4.8)
    timeline.getState().shuttleStop()
    expect(playback.getState()).toMatchObject({
      isPlaying: false,
      playbackSpeed: 1,
      playbackDirection: 1,
    })
    expectProjection()
  })

  it('notifies paused marker jumps, repeated seeks, and frame steps through one seek path', () => {
    timeline.getState().seek(3)
    const marker = timeline.getState().addMarker('Review')
    playback.getState().seek(1)
    events.length = 0
    const revision = playback.getState().seekRevision
    timeline.getState().jumpToMarker(marker.id)
    timeline.getState().jumpToMarker(marker.id)
    timeline.getState().stepFrame(1)
    expect(
      events.filter((event) => event.type === 'playback-seek').map((event) => event.detail.time),
    ).toEqual([3, 3, 3 + 1 / 30])
    expect(playback.getState().seekRevision).toBe(revision + 3)
    expect(playback.getState().getCurrentFrame()).toBe(91)
    expectProjection()
  })

  it.each([1, -1] as const)(
    'wraps the loop in direction %s and notifies a discontinuity',
    (direction) => {
      timeline.setState({ loopRegion: { inPoint: 1, outPoint: 2 } })
      playback.getState().seek(direction > 0 ? 1.9 : 1.1)
      if (direction > 0) timeline.getState().shuttleForward()
      else timeline.getState().shuttleBackward()
      events.length = 0
      const revision = playback.getState().seekRevision
      advanceBy(200)
      expect(playback.getState().currentTime).toBeCloseTo(direction > 0 ? 1.1 : 1.9)
      expect(playback.getState().seekRevision).toBe(revision + 1)
      expect(events.filter((event) => event.type === 'playback-seek')).toHaveLength(1)
      expectProjection()
    },
  )

  it('wraps a loop ending at the content boundary instead of sticking on the last frame', () => {
    timeline.setState({ duration: 10, loopRegion: { inPoint: 9, outPoint: 10 } })
    playback.getState().seek(9.9)
    playback.getState().play()
    for (let frame = 0; frame < 12; frame += 1) advanceBy(1000 / 60)
    expect(playback.getState().currentTime).toBeCloseTo(9.1)
    expect(playback.getState().isPlaying).toBe(true)
  })

  it('stops on valid first/last frames, synchronizes the terminal time, and restarts at the opposite edge', () => {
    playback.getState().seek(9.9)
    playback.getState().play()
    advanceBy(100)
    expect(playback.getState()).toMatchObject({ currentTime: 10 - 1 / 30, isPlaying: false })
    expectProjection()
    expect(callbacks.size).toBe(0)
    playback.getState().play()
    expect(playback.getState().currentTime).toBe(0)
    timeline.getState().shuttleStop()
    timeline.getState().shuttleBackward()
    expect(playback.getState().currentTime).toBe(10 - 1 / 30)
    playback.getState().seek(0.1)
    advanceBy(200)
    expect(playback.getState()).toMatchObject({ currentTime: 0, isPlaying: false })
    expectProjection()
    playback.getState().seek(100)
    expect(playback.getState().currentTime).toBe(10 - 1 / 30)
  })

  it('keeps End, reverse start and terminal playback inside a sub-second clip', () => {
    timeline.getState().addClip('track-a', 'short-video', 0, 0.5)
    expect(playback.getState().getEffectiveDuration()).toBe(0.5)
    playback.getState().seek(timeline.getState().duration)
    expect(playback.getState().currentTime).toBe(14 / 30)
    timeline.getState().stepFrame(1)
    expect(playback.getState().currentTime).toBe(14 / 30)
    playback.getState().seek(0)
    timeline.getState().shuttleBackward()
    expect(playback.getState().currentTime).toBe(14 / 30)
    advanceBy(100)
    expect(playback.getState().currentTime).toBeCloseTo(11 / 30)
    timeline.getState().shuttleStop()
    playback.getState().seek(0.4)
    playback.getState().play()
    advanceBy(100)
    expect(playback.getState()).toMatchObject({ currentTime: 14 / 30, isPlaying: false })
    expectProjection()
  })

  it('uses the longest positive timeline/content duration and falls back only when empty', () => {
    timeline.setState({ duration: 0 })
    expect(playback.getState().getEffectiveDuration()).toBe(1)
    timeline.getState().addClip('track-a', 'short-video', 0, 0.5)
    timeline.setState({ duration: 0.2 })
    expect(playback.getState().getEffectiveDuration()).toBe(0.5)
    timeline.setState({ duration: 0.75 })
    expect(playback.getState().getEffectiveDuration()).toBe(0.75)
  })

  it('resets the elapsed baseline on a playing seek and respects export ownership', () => {
    playback.getState().play()
    now += 500
    playback.getState().seek(5)
    advanceBy(100)
    expect(playback.getState().currentTime).toBeCloseTo(5.1)
    playback.getState().setExporting(true)
    playback.getState().play()
    expect(callbacks.size).toBe(0)
    expect(playback.getState().isPlaying).toBe(false)
  })
})
