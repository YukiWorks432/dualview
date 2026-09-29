import { describe, expect, it } from 'vitest'

import { PixelComparator } from './compare'
const pixels = (...values: number[]) => new Uint8ClampedArray(values)
describe('visible colour and alpha comparison', () => {
  it('ignores hidden RGB under complete transparency', () => {
    expect(
      new PixelComparator(1, 1).compare(pixels(255, 0, 0, 0), pixels(0, 255, 255, 0), 0.1),
    ).toBe(0)
  })
  it('detects alpha-only changes even over black', () => {
    expect(new PixelComparator(1, 1).compare(pixels(0, 0, 0, 0), pixels(0, 0, 0, 255), 0.1)).toBe(1)
  })
  it('counts visible colour and alpha changes only once per pixel', () => {
    expect(
      new PixelComparator(2, 1).compare(
        pixels(0, 0, 0, 0, 0, 0, 0, 255),
        pixels(255, 255, 255, 255, 0, 0, 0, 255),
        0.1,
      ),
    ).toBe(0.5)
  })
  it('reuses masks safely and separates pixel tolerance from changed area', () => {
    const comparator = new PixelComparator(1, 1)
    const black = pixels(0, 0, 0, 255)
    expect(comparator.compare(black, pixels(255, 255, 255, 255), 0.1)).toBe(1)
    expect(comparator.compare(black, pixels(2, 2, 2, 255), 0.1)).toBe(0)
    expect(comparator.compare(black, black, 0)).toBe(0)
  })
})
