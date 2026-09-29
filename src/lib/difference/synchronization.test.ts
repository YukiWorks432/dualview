import { describe, expect, it } from 'vitest'

import { areFrameRangesSynchronized, getPlaybackDifferenceExpiryDelay } from './synchronization'

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

  it('allows a small timestamp gap between paused frames', () => {
    expect(
      areFrameRangesSynchronized(
        [
          { startTime: 5, endTime: 5 },
          { startTime: 5.015, endTime: 5.015 },
        ],
        5.0075,
        0.02,
        0.02,
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

describe('playback difference result expiry', () => {
  it('expires preview regions after their allowed display age', () => {
    expect(getPlaybackDifferenceExpiryDelay(1_000, 1_000, 500)).toBe(500)
    expect(getPlaybackDifferenceExpiryDelay(1_499, 1_000, 500)).toBe(1)
    expect(getPlaybackDifferenceExpiryDelay(1_501, 1_000, 500)).toBe(0)
  })
})
