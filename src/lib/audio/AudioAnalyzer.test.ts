import { describe, expect, it } from 'vitest'

import { generateWaveformPeaks, LOUDNESS_TARGETS } from './AudioAnalyzer'

describe('generateWaveformPeaks', () => {
  it('preserves anti-phase stereo energy', () => {
    const left = new Float32Array([1, -0.5, 0.25, -0.125])
    const right = new Float32Array([-1, 0.5, -0.25, 0.125])

    const peaks = generateWaveformPeaks([left, right], 2)

    expect(Array.from(peaks)).toEqual([1, 0.25])
  })

  it('handles fewer samples than output peaks', () => {
    const peaks = generateWaveformPeaks([new Float32Array([0.75])], 3)

    expect(peaks[0]).toBeCloseTo(0.75)
  })

  it('keeps EBU R128 and ATSC A/85 reference targets distinct', () => {
    expect(LOUDNESS_TARGETS.ebuR128).toBe(-23)
    expect(LOUDNESS_TARGETS.atscA85).toBe(-24)
  })
})
