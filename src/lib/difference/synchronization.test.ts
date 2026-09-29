import { describe, expect, it } from 'vitest'

import {
  areFrameRangesSynchronized,
  getConsecutivePresentedFrameRange,
  getPausedVideoFrameRange,
  getPlaybackDifferenceExpiryDelay,
  getStablePausedVideoFrameTime,
  isPlaybackDifferenceResultFresh,
} from './synchronization'

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
  it('accepts overlapping frames from different frame rates at the requested time', () => {
    expect(
      areFrameRangesSynchronized(
        [
          { startTime: 5, endTime: 5.0417 },
          { startTime: 5.0333, endTime: 5.0667 },
        ],
        5.037,
        0.02,
        0,
        0.001,
      ),
    ).toBe(true)
  })

  it('accepts a video timestamp that falls inside a decoded frame interval', () => {
    expect(
      areFrameRangesSynchronized(
        [
          { startTime: 5.0333, endTime: 5.0333 },
          { startTime: 5.02, endTime: 5.0533 },
        ],
        5.0333,
        0.08,
        1 / 240,
        0.001,
      ),
    ).toBe(true)
  })

  it('rejects video frames with distinct presentation timestamps during playback', () => {
    expect(
      areFrameRangesSynchronized(
        [
          { startTime: 5, endTime: 5 },
          { startTime: 5.0667, endTime: 5.0667 },
        ],
        5.0333,
        0.08,
        1 / 240,
      ),
    ).toBe(false)
  })

  it('rejects adjacent 30fps frames even when both starts are near the request time', () => {
    expect(
      areFrameRangesSynchronized(
        [
          { startTime: 5, endTime: 5.0333 },
          { startTime: 5.0667, endTime: 5.1 },
        ],
        5.0333,
        0.08,
        0,
        0.001,
      ),
    ).toBe(false)
  })

  it('rejects distinct paused presentation timestamps even when both are near the requested time', () => {
    expect(
      areFrameRangesSynchronized(
        [
          { startTime: 5.015, endTime: 5.015 },
          { startTime: 5.03, endTime: 5.03 },
        ],
        5.022,
        0.02,
        0.001,
      ),
    ).toBe(false)
  })

  it('accepts paused frames with the same presentation timestamp', () => {
    expect(
      areFrameRangesSynchronized(
        [
          { startTime: 5.015, endTime: 5.015 },
          { startTime: 5.015, endTime: 5.015 },
        ],
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
      areFrameRangesSynchronized(
        [presentedFrame, { startTime: 5.03, endTime: 5.03 }],
        5.03,
        0.05,
        0.001,
        0.001,
      ),
    ).toBe(true)
  })

  it('accepts the same very short held frame range at a 30fps frame boundary', () => {
    const frameRange = { startTime: 0.033333, endTime: 1 / 30 }

    expect(areFrameRangesSynchronized([frameRange, frameRange], 1 / 30, 0.05, 0.001, 0.001)).toBe(
      true,
    )
  })

  it('rejects a sub-millisecond overlap between distinct frame ranges', () => {
    expect(
      areFrameRangesSynchronized(
        [
          { startTime: 0, endTime: 1 / 30 },
          { startTime: 1 / 30 - 0.0000005, endTime: 2 / 30 - 0.0000005 },
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
      areFrameRangesSynchronized(
        [{ startTime: 0.033333, endTime: 1 / 30 }, null],
        1 / 30,
        0.05,
        0.001,
        0.001,
      ),
    ).toBe(false)
  })

  it('rejects adjacent paused frame intervals that only touch', () => {
    expect(
      areFrameRangesSynchronized(
        [
          { startTime: 5, endTime: 5.03 },
          { startTime: 5.03, endTime: 5.06 },
        ],
        5.03,
        0.05,
        0.001,
        0.001,
      ),
    ).toBe(false)
  })

  it('accepts the same presented frame at the end of its hold interval', () => {
    expect(
      areFrameRangesSynchronized(
        [
          { startTime: 5.9333, endTime: 5.9333 },
          { startTime: 5.9333, endTime: 5.9333 },
        ],
        5.9666,
        0.05,
        0.001,
      ),
    ).toBe(true)
  })

  it('allows image sources without a changing frame timestamp', () => {
    expect(
      areFrameRangesSynchronized([null, { startTime: 5.01, endTime: 5.03 }], 5.02, 0.02, 0),
    ).toBe(true)
    expect(areFrameRangesSynchronized([null, null], 5.02, 0.02, 0)).toBe(true)
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
