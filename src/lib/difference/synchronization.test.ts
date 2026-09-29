import { describe, expect, it } from 'vitest'

import { areFrameTimesSynchronized, getPlaybackDifferenceExpiryDelay } from './synchronization'

describe('difference frame synchronization', () => {
  it('accepts frames captured near the same timeline position', () => {
    expect(areFrameTimesSynchronized([5.03, 5.05], 5.04, 0.08)).toBe(true)
  })

  it('rejects two frames that each pass individually but differ from each other', () => {
    expect(areFrameTimesSynchronized([4.93, 5.07], 5, 0.08)).toBe(false)
  })

  it('allows image sources without a changing frame timestamp', () => {
    expect(areFrameTimesSynchronized([null, 5.02], 5, 0.08)).toBe(true)
    expect(areFrameTimesSynchronized([null, null], 5, 0.08)).toBe(true)
  })
})

describe('playback difference result expiry', () => {
  it('expires preview regions after their allowed display age', () => {
    expect(getPlaybackDifferenceExpiryDelay(1_000, 1_000, 500)).toBe(500)
    expect(getPlaybackDifferenceExpiryDelay(1_499, 1_000, 500)).toBe(1)
    expect(getPlaybackDifferenceExpiryDelay(1_501, 1_000, 500)).toBe(0)
  })
})
