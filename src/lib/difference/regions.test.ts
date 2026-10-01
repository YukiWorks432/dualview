import { describe, expect, it } from 'vitest'

import { extractDifferenceRegions } from './regions'

function createMask(
  width: number,
  height: number,
  points: Array<[number, number]>,
): Uint8ClampedArray {
  const mask = new Uint8ClampedArray(width * height * 4)
  for (const [x, y] of points) {
    mask[(y * width + x) * 4 + 3] = 255
  }
  return mask
}

describe('extractDifferenceRegions', () => {
  it('keeps separated changes as separate regions', () => {
    const regions = extractDifferenceRegions(
      createMask(10, 10, [
        [1, 1],
        [1, 2],
        [8, 8],
        [8, 9],
      ]),
      10,
      10,
      { minPixels: 1, mergeGap: 0, padding: 0, maxRegions: 10 },
    )

    expect(regions).toHaveLength(2)
    expect(regions.map((region) => region.pixelCount).sort((a, b) => a - b)).toEqual([2, 2])
  })

  it('filters tiny regions by changed-pixel count', () => {
    const regions = extractDifferenceRegions(
      createMask(10, 10, [
        [1, 1],
        [5, 5],
        [5, 6],
        [6, 5],
      ]),
      10,
      10,
      { minPixels: 2, mergeGap: 0, padding: 0, maxRegions: 10 },
    )

    expect(regions).toHaveLength(1)
    expect(regions[0].pixelCount).toBe(3)
  })

  it('merges nearby components without joining distant regions', () => {
    const regions = extractDifferenceRegions(
      createMask(12, 6, [
        [1, 1],
        [3, 1],
        [10, 4],
      ]),
      12,
      6,
      { minPixels: 1, mergeGap: 1, padding: 0, maxRegions: 10 },
    )

    expect(regions).toHaveLength(2)
    expect(regions.some((region) => region.pixelCount === 2)).toBe(true)
  })
})
