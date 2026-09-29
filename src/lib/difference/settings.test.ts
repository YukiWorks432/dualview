import { describe, expect, it } from 'vitest'

import {
  getBaseMinimumRegionPixels,
  scaleMinimumRegionPixels,
  sensitivityToPixelmatchThreshold,
} from './settings'

describe('difference settings', () => {
  it('maps higher sensitivity to a lower pixelmatch threshold', () => {
    expect(sensitivityToPixelmatchThreshold(80)).toBeLessThan(sensitivityToPixelmatchThreshold(20))
  })

  it('keeps the off filter at one changed pixel', () => {
    expect(getBaseMinimumRegionPixels('off')).toBe(1)
  })

  it('scales region filtering with analysis area', () => {
    expect(scaleMinimumRegionPixels(4, 1920, 1080)).toBeGreaterThan(
      scaleMinimumRegionPixels(4, 960, 540),
    )
  })
})
