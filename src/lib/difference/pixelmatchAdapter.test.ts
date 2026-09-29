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

    expect(createDifferenceMask(a, b, 1, 1, 0.1).diffPixelCount).toBe(1)
  })
})
