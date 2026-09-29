import { describe, expect, it } from 'vitest'

import { calculateCommonAnalysisDimensions } from './geometry'

describe('calculateCommonAnalysisDimensions', () => {
  it('uses the smaller common frame without upscaling', () => {
    expect(
      calculateCommonAnalysisDimensions(
        { width: 3840, height: 2160 },
        { width: 1920, height: 1080 },
        { maxLongEdge: 1920, maxPixels: 12_000_000 },
      ),
    ).toEqual({
      ok: true,
      width: 1920,
      height: 1080,
      aspectRatio: 16 / 9,
    })
  })

  it('downscales playback analysis while preserving aspect ratio', () => {
    expect(
      calculateCommonAnalysisDimensions(
        { width: 1920, height: 1080 },
        { width: 1920, height: 1080 },
        { maxLongEdge: 960, maxPixels: 12_000_000 },
      ),
    ).toEqual({
      ok: true,
      width: 960,
      height: 540,
      aspectRatio: 16 / 9,
    })
  })

  it('rejects mismatched aspect ratios', () => {
    expect(
      calculateCommonAnalysisDimensions(
        { width: 1920, height: 1080 },
        { width: 1080, height: 1080 },
        { maxLongEdge: 1920, maxPixels: 12_000_000 },
      ),
    ).toEqual({ ok: false, reason: 'aspect-mismatch' })
  })

  it('rejects full-resolution frames above the pixel safety limit', () => {
    expect(
      calculateCommonAnalysisDimensions(
        { width: 7680, height: 4320 },
        { width: 7680, height: 4320 },
        { maxLongEdge: Number.POSITIVE_INFINITY, maxPixels: 12_000_000 },
      ),
    ).toEqual({ ok: false, reason: 'too-large' })
  })
})
