import { describe, expect, it } from 'vitest'

import {
  areFrameObservationsSynchronized,
  getConsecutivePresentedFrameRange,
  getFrameObservationAnchor,
  getPausedVideoFrameRange,
  getPlaybackDifferenceExpiryDelay,
  getStablePausedVideoFrameTime,
  isPlaybackDifferenceResultFresh,
} from './synchronization'

const unknownObservation = { kind: 'unknown' } as const
const pointObservation = (time: number) => ({ kind: 'point', time }) as const
const intervalObservation = (startTime: number, endTime: number) =>
  ({ kind: 'interval', range: { startTime, endTime } }) as const
const pausedVideoObservation = (presentedTime: number, currentTime: number) =>
  ({ kind: 'paused-video', presentedTime, currentTime }) as const

describe('consecutive presented frame ranges', () => {
  it('uses only adjacent presented frames to infer a displayed interval', () => {
    expect(
      getConsecutivePresentedFrameRange(
        { timelineTime: 5.0667, presentedFrames: 12 },
        { timelineTime: 5.1, presentedFrames: 13 },
      ),
    ).toEqual({ startTime: 5.0667, endTime: 5.1 })

    expect(
      getConsecutivePresentedFrameRange(
        { timelineTime: 5.0333, presentedFrames: 12 },
        { timelineTime: 5.1, presentedFrames: 14 },
      ),
    ).toBeNull()
  })

  it('does not infer a positive interval from invalid or repeated metadata', () => {
    expect(
      getConsecutivePresentedFrameRange(
        { timelineTime: 5, presentedFrames: 12 },
        { timelineTime: 5, presentedFrames: 13 },
      ),
    ).toBeNull()
    expect(
      getConsecutivePresentedFrameRange(
        { timelineTime: 5, presentedFrames: Number.NaN },
        { timelineTime: 5.0333, presentedFrames: 13 },
      ),
    ).toBeNull()
  })
})

describe('difference frame synchronization', () => {
  it('anchors playback synchronization to the observed side when the other side is an image', () => {
    const playbackFrame = intervalObservation(1.033333, 1.066667)

    for (const observations of [
      [unknownObservation, playbackFrame],
      [playbackFrame, unknownObservation],
    ]) {
      const anchor = getFrameObservationAnchor(observations, 1)

      expect(anchor).toBeCloseTo(1.05)
      expect(areFrameObservationsSynchronized(observations, anchor, 0.2, 0.001, 0.001)).toBe(true)
    }

    expect(getFrameObservationAnchor([unknownObservation, unknownObservation], 1)).toBe(1)
  })

  it('accepts overlapping frames from different frame rates at the requested time', () => {
    const observations = [
      intervalObservation(5, 5.0417),
      intervalObservation(5.0333, 5.0667),
    ] as const

    for (const pair of [observations, [...observations].reverse()]) {
      const anchor = getFrameObservationAnchor(pair, 5.037)

      expect(anchor).toBe(5.037)
      expect(areFrameObservationsSynchronized(pair, anchor, 0.02, 0, 0.001)).toBe(true)
    }
  })

  it('accepts a video timestamp that falls inside a decoded frame interval', () => {
    expect(
      areFrameObservationsSynchronized(
        [pointObservation(5.0333), intervalObservation(5.02, 5.0533)],
        5.0333,
        0.08,
        1 / 240,
        0.001,
      ),
    ).toBe(true)
  })

  it('rejects video frames with distinct presentation timestamps during playback', () => {
    expect(
      areFrameObservationsSynchronized(
        [pointObservation(5), pointObservation(5.0667)],
        5.0333,
        0.08,
        1 / 240,
      ),
    ).toBe(false)
  })

  it('rejects adjacent 30fps frames even when both starts are near the request time', () => {
    expect(
      areFrameObservationsSynchronized(
        [intervalObservation(5, 5.0333), intervalObservation(5.0667, 5.1)],
        5.0333,
        0.08,
        0,
        0.001,
      ),
    ).toBe(false)
  })

  it('rejects distinct paused presentation timestamps even when both are near the requested time', () => {
    expect(
      areFrameObservationsSynchronized(
        [pointObservation(5.015), pointObservation(5.03)],
        5.022,
        0.02,
        0.001,
      ),
    ).toBe(false)
  })

  it('accepts paused frames with the same presentation timestamp', () => {
    expect(
      areFrameObservationsSynchronized(
        [pointObservation(5.015), pointObservation(5.015)],
        5.015,
        0.02,
        0.001,
      ),
    ).toBe(true)
  })

  it('matches a held paused video frame with a stable current-time fallback', () => {
    const presentedFrame = getPausedVideoFrameRange(5.015, 5.03, 0.05)

    expect(presentedFrame).toEqual({ startTime: 5.015, endTime: 5.03 })
    expect(
      areFrameObservationsSynchronized(
        [pausedVideoObservation(5.015, 5.03), pointObservation(5.03)],
        5.03,
        0.05,
        0.001,
        0.001,
      ),
    ).toBe(true)
  })

  it('accepts the same very short held video frame at a 30fps frame boundary', () => {
    expect(
      areFrameObservationsSynchronized(
        [pausedVideoObservation(0.033333, 1 / 30), pausedVideoObservation(0.033333, 1 / 30)],
        1 / 30,
        0.05,
        0.001,
        0.001,
      ),
    ).toBe(true)
  })

  it('matches an image to a single short paused video observation', () => {
    expect(
      areFrameObservationsSynchronized(
        [pausedVideoObservation(0.033333, 1 / 30), unknownObservation],
        1 / 30,
        0.05,
        0.001,
        0.001,
      ),
    ).toBe(true)
  })

  it('rejects a sub-millisecond overlap between distinct frame ranges', () => {
    expect(
      areFrameObservationsSynchronized(
        [
          intervalObservation(0, 1 / 30),
          intervalObservation(1 / 30 - 0.0000005, 2 / 30 - 0.0000005),
        ],
        1 / 30,
        0.05,
        0.001,
        0.001,
      ),
    ).toBe(false)
  })

  it('still requires enough evidence when only one short frame range is observed', () => {
    expect(
      areFrameObservationsSynchronized(
        [intervalObservation(0.033333, 1 / 30), unknownObservation],
        1 / 30,
        0.05,
        0.001,
        0.001,
      ),
    ).toBe(false)
  })

  it('rejects adjacent paused frame intervals that only touch', () => {
    expect(
      areFrameObservationsSynchronized(
        [intervalObservation(5, 5.03), intervalObservation(5.03, 5.06)],
        5.03,
        0.05,
        0.001,
        0.001,
      ),
    ).toBe(false)
  })

  it('accepts the same presented frame at the end of its hold interval', () => {
    expect(
      areFrameObservationsSynchronized(
        [pointObservation(5.9333), pointObservation(5.9333)],
        5.9666,
        0.05,
        0.001,
      ),
    ).toBe(true)
  })

  it('allows image sources without a changing frame timestamp', () => {
    expect(
      areFrameObservationsSynchronized(
        [unknownObservation, intervalObservation(5.01, 5.03)],
        5.02,
        0.02,
        0,
      ),
    ).toBe(true)
    expect(
      areFrameObservationsSynchronized([unknownObservation, unknownObservation], 5.02, 0.02, 0),
    ).toBe(true)
  })

  it('matches paused video, ProRes, and timestamp-free image observations at a frame boundary', () => {
    expect(
      areFrameObservationsSynchronized(
        [
          pausedVideoObservation(0.033333, 1 / 30),
          unknownObservation,
          intervalObservation(0.033333, 0.066667),
          pointObservation(1 / 30),
        ],
        1 / 30,
        0.05,
        0.001,
        0.001,
      ),
    ).toBe(true)
  })

  it('rejects a frame timestamp at the exclusive end of a different decoded frame', () => {
    expect(
      areFrameObservationsSynchronized(
        [pointObservation(1 / 30), intervalObservation(0, 1 / 30)],
        1 / 30,
        0.05,
        0.001,
        0.001,
      ),
    ).toBe(false)
  })

  it('rejects a paused video that still shows the previous frame at a ProRes frame boundary', () => {
    expect(
      areFrameObservationsSynchronized(
        [
          pausedVideoObservation(0, 1 / 30),
          unknownObservation,
          intervalObservation(1 / 30, 2 / 30),
          pointObservation(1 / 30),
        ],
        1 / 30,
        0.05,
        0.001,
        0.001,
      ),
    ).toBe(false)
  })
})

describe('paused video frame capture', () => {
  it('uses a steady paused video time when presented-frame metadata is unavailable', () => {
    expect(
      getStablePausedVideoFrameTime(
        { currentTime: 5.015, paused: true, seeking: false },
        { currentTime: 5.015, paused: true, seeking: false },
      ),
    ).toBe(5.015)
  })

  it('rejects a capture when playback, seeking, or the video time changes', () => {
    const before = { currentTime: 5.015, paused: true, seeking: false }

    expect(
      getStablePausedVideoFrameTime(before, {
        currentTime: 5.016,
        paused: true,
        seeking: false,
      }),
    ).toBeNull()
    expect(
      getStablePausedVideoFrameTime(before, {
        currentTime: 5.015,
        paused: true,
        seeking: true,
      }),
    ).toBeNull()
    expect(
      getStablePausedVideoFrameTime(before, {
        currentTime: 5.015,
        paused: false,
        seeking: false,
      }),
    ).toBeNull()
  })
})

describe('playback difference result expiry', () => {
  it('expires preview regions after their allowed display age', () => {
    expect(getPlaybackDifferenceExpiryDelay(1_000, 1_000, 500)).toBe(500)
    expect(getPlaybackDifferenceExpiryDelay(1_499, 1_000, 500)).toBe(1)
    expect(getPlaybackDifferenceExpiryDelay(1_501, 1_000, 500)).toBe(0)
  })

  it('rejects worker results that arrive at or after their capture-time expiry', () => {
    expect(isPlaybackDifferenceResultFresh(1_499, 1_000, 500)).toBe(true)
    expect(isPlaybackDifferenceResultFresh(1_500, 1_000, 500)).toBe(false)
    expect(isPlaybackDifferenceResultFresh(1_501, 1_000, 500)).toBe(false)
  })
})
