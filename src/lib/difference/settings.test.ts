import { describe, expect, it } from 'vitest'

import {
  getBaseMinimumRegionPixels,
  scaleMinimumRegionPixels,
  sensitivityToColorThreshold,
} from './settings'

describe('difference settings', () => {
  it('maps higher sensitivity to a lower color threshold', () => {
    expect(sensitivityToColorThreshold(80)).toBeLessThan(sensitivityToColorThreshold(20))
  })

  it('keeps the off filter at one changed pixel', () => {
    expect(getBaseMinimumRegionPixels('off')).toBe(1)
    expect(scaleMinimumRegionPixels(getBaseMinimumRegionPixels('off'), 1920, 1080)).toBe(1)
  })

  it('scales region filtering with analysis area', () => {
    expect(scaleMinimumRegionPixels(4, 1920, 1080)).toBeGreaterThan(
      scaleMinimumRegionPixels(4, 960, 540),
    )
  })
})
