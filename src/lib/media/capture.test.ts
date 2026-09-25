import { describe, expect, it } from 'vitest'

import {
  calculateCaptureTransform,
  calculateObjectContainRect,
  calculateSourceCrop,
  intersectCaptureRects,
} from './capture'

describe('capture geometry', () => {
  it('fits source content without stretching its aspect ratio', () => {
    expect(
      calculateObjectContainRect({ left: 0, top: 0, width: 200, height: 100 }, 100, 100),
    ).toEqual({
      left: 50,
      top: 0,
      width: 100,
      height: 100,
    })
  })

  it('intersects an overflow-clipped media rectangle', () => {
    expect(
      intersectCaptureRects(
        { left: 20, top: 10, width: 100, height: 80 },
        { left: 60, top: 0, width: 100, height: 100 },
      ),
    ).toEqual({
      left: 60,
      top: 10,
      width: 60,
      height: 80,
    })
  })

  it('maps a clipped visible region back into source pixels', () => {
    expect(
      calculateSourceCrop(
        { left: 50, top: 0, width: 100, height: 100 },
        { left: 50, top: 0, width: 40, height: 100 },
        1920,
        1080,
      ),
    ).toEqual({
      sx: 0,
      sy: 0,
      sw: 768,
      sh: 1080,
    })
  })

  it('preserves preview aspect ratio inside a differently shaped output', () => {
    expect(calculateCaptureTransform(1200, 800, 1920, 1080)).toEqual({
      scale: 1.35,
      offsetX: 150,
      offsetY: 0,
    })
  })
})
