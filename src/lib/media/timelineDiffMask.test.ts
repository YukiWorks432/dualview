import { describe, expect, it } from 'vitest'

import { createPixelDifferenceMask } from './timelineDiff'

describe('createPixelDifferenceMask', () => {
  it('returns the same changed-pixel semantics used by timeline analysis', () => {
    const a = new Uint8ClampedArray([
      0, 0, 0, 255,
      255, 255, 255, 255,
    ])
    const b = new Uint8ClampedArray([
      255, 255, 255, 255,
      255, 255, 255, 255,
    ])

    const result = createPixelDifferenceMask(a, b, 2, 1, 0.1)

    expect(result.differentPixels).toBe(1)
    expect(result.mask[3]).toBeGreaterThan(0)
    expect(result.mask[7]).toBe(0)
  })

  it('ignores hidden RGB but marks alpha-only changes in the mask', () => {
    const transparentBlack = new Uint8ClampedArray([0, 0, 0, 0])
    const transparentRed = new Uint8ClampedArray([255, 0, 0, 0])
    const visibleBlack = new Uint8ClampedArray([0, 0, 0, 255])

    expect(createPixelDifferenceMask(transparentBlack, transparentRed, 1, 1, 0.1)).toMatchObject({
      differentPixels: 0,
    })

    const alphaChange = createPixelDifferenceMask(transparentBlack, visibleBlack, 1, 1, 0.1)
    expect(alphaChange.differentPixels).toBe(1)
    expect(alphaChange.mask[3]).toBe(255)
  })
})
