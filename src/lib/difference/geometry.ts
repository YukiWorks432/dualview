export interface FrameDimensions {
  width: number
  height: number
}

export type AnalysisDimensionsResult =
  | {
      ok: true
      width: number
      height: number
      aspectRatio: number
    }
  | {
      ok: false
      reason: 'invalid-dimensions' | 'aspect-mismatch' | 'too-large'
    }

interface AnalysisDimensionsOptions {
  maxLongEdge: number
  maxPixels: number
  aspectTolerance?: number
}

export function calculateCommonAnalysisDimensions(
  a: FrameDimensions,
  b: FrameDimensions,
  options: AnalysisDimensionsOptions,
): AnalysisDimensionsResult {
  if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) {
    return { ok: false, reason: 'invalid-dimensions' }
  }

  const aspectA = a.width / a.height
  const aspectB = b.width / b.height
  const aspectTolerance = options.aspectTolerance ?? 0.005
  const relativeAspectDifference = Math.abs(aspectA - aspectB) / Math.max(aspectA, aspectB)

  if (relativeAspectDifference > aspectTolerance) {
    return { ok: false, reason: 'aspect-mismatch' }
  }

  const base = a.width * a.height <= b.width * b.height ? a : b
  let width = base.width
  let height = base.height
  const longEdge = Math.max(width, height)

  if (Number.isFinite(options.maxLongEdge) && longEdge > options.maxLongEdge) {
    const scale = options.maxLongEdge / longEdge
    width = Math.max(1, Math.round(width * scale))
    height = Math.max(1, Math.round(height * scale))
  }

  if (width * height > options.maxPixels) {
    return { ok: false, reason: 'too-large' }
  }

  return {
    ok: true,
    width,
    height,
    aspectRatio: width / height,
  }
}
