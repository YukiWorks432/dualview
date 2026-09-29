import { describe, expect, it } from 'vitest'

import { createDifferenceMask } from './pixelmatchAdapter'

describe('createDifferenceMask', () => {
  it('ignores hidden RGB differences when both pixels are fully transparent', () => {
    const a = new Uint8ClampedArray([255, 0, 0, 0])
    const b = new Uint8ClampedArray([0, 255, 0, 0])

    expect(createDifferenceMask(a, b, 1, 1, 0.1).diffPixelCount).toBe(0)
  })

  it('detects alpha differences', () => {
    const a = new Uint8ClampedArray([255, 255, 255, 255])
    const b = new Uint8ClampedArray([255, 255, 255, 0])

    const result = createDifferenceMask(a, b, 1, 1, 0.1)

    expect(result.diffPixelCount).toBe(1)
    expect(result.mask[3]).toBe(255)
  })

  it('detects alpha differences when the composited colors match the checkerboard', () => {
    const a = new Uint8ClampedArray([48, 48, 48, 255])
    const b = new Uint8ClampedArray([0, 0, 0, 0])

    const result = createDifferenceMask(a, b, 1, 1, 0.02)

    expect(result.diffPixelCount).toBe(1)
    expect(result.mask[3]).toBe(255)
  })

  it('counts a pixel with both color and alpha differences only once', () => {
    const a = new Uint8ClampedArray([255, 0, 0, 255])
    const b = new Uint8ClampedArray([0, 0, 255, 0])

    expect(createDifferenceMask(a, b, 1, 1, 0.02).diffPixelCount).toBe(1)
  })
})
