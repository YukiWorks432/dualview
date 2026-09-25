import { describe, expect, it } from 'vitest'

import { calculateAverageRgbaDifference } from './pixelDifference'

describe('calculateAverageRgbaDifference', () => {
  it('detects alpha-only differences', () => {
    const a = new Uint8ClampedArray([64, 128, 192, 255])
    const b = new Uint8ClampedArray([64, 128, 192, 0])

    expect(calculateAverageRgbaDifference(a, b, 0)).toBeCloseTo(63.75)
  })

  it('returns zero for identical pixels', () => {
    const pixel = new Uint8ClampedArray([10, 20, 30, 40])

    expect(calculateAverageRgbaDifference(pixel, pixel, 0)).toBe(0)
  })
})
