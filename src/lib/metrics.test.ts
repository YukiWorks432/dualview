import { describe, expect, it } from 'vitest'

import { calculatePSNR, calculateSSIM } from './metrics'

function rgba(...pixels: Array<[number, number, number, number]>): Uint8ClampedArray {
  return new Uint8ClampedArray(pixels.flat())
}

describe('quality metrics', () => {
  it('treats identical frames as a perfect match', () => {
    const frame = rgba([12, 34, 56, 255], [200, 150, 100, 255])

    expect(calculatePSNR(frame, frame)).toBe(Infinity)
    expect(calculateSSIM(frame, frame)).toBeCloseTo(1, 12)
  })

  it('ignores alpha when comparing RGB image quality', () => {
    const opaque = rgba([64, 128, 192, 255])
    const transparent = rgba([64, 128, 192, 0])

    expect(calculatePSNR(opaque, transparent)).toBe(Infinity)
    expect(calculateSSIM(opaque, transparent)).toBeCloseTo(1, 12)
  })

  it('returns zero PSNR for the maximum RGB difference', () => {
    const black = rgba([0, 0, 0, 255])
    const white = rgba([255, 255, 255, 255])

    expect(calculatePSNR(black, white)).toBeCloseTo(0, 12)
    expect(calculateSSIM(black, white)).toBeLessThan(0.001)
  })

  it('rejects frames with different dimensions', () => {
    const onePixel = rgba([0, 0, 0, 255])
    const twoPixels = rgba([0, 0, 0, 255], [0, 0, 0, 255])

    expect(calculatePSNR(onePixel, twoPixels)).toBe(0)
    expect(calculateSSIM(onePixel, twoPixels)).toBe(0)
  })
})
