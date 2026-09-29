import { describe, expect, it } from 'vitest'

import type { TimelineClip } from '../../types'
import {
  appendRegions,
  comparisonBoundaries,
  comparisonSize,
  findSample,
  frameAt,
  normalizeFrameTimings,
  pairWindows,
  rasterizeDifference,
  regionAt,
  regionIndexAfter,
  regionIndexBefore,
  sourceTimestamps,
} from './model'
import type { DifferenceBatch, DifferenceSample } from './model'
const clip = (overrides: Partial<TimelineClip> = {}): TimelineClip => ({
  id: 'a',
  mediaId: 'media-a',
  trackId: 'track-a',
  startTime: 0,
  endTime: 1,
  inPoint: 0,
  outPoint: 1,
  ...overrides,
})
const sample = (start: number, end: number, ratio: number | null): DifferenceSample => ({
  start,
  end,
  ratio,
  state: ratio === null ? 'error' : 'compared',
})
describe('timeline difference timing', () => {
  it('uses both variable-frame-rate presentation timelines, not a fixed sample interval', () => {
    const window = pairWindows(
      [clip({ endTime: 0.11, outPoint: 0.11 })],
      [clip({ id: 'b', endTime: 0.11, outPoint: 0.11 })],
      0.11,
    )[0]
    const a = [
      { timestamp: 0, duration: 0.04 },
      { timestamp: 0.04, duration: 0.07 },
    ]
    const b = [
      { timestamp: 0, duration: 0.025 },
      { timestamp: 0.025, duration: 0.06 },
      { timestamp: 0.085, duration: 0.025 },
    ]
    const boundaries = comparisonBoundaries(window, a, b)
    expect(boundaries).toHaveLength(5)
    for (const expected of [0, 0.025, 0.04, 0.085, 0.11])
      expect(boundaries.some((time) => Math.abs(time - expected) < 1e-12)).toBe(true)
  })
  it('maps trims, placement, speed and reverse using interval midpoints', () => {
    const reversed = clip({
      startTime: 5,
      endTime: 6,
      inPoint: 1,
      outPoint: 3,
      speed: 2,
      reverse: true,
    })
    const window = pairWindows([reversed], [], 6).find((item) => item.a !== null)!
    const times = comparisonBoundaries(
      window,
      [
        { timestamp: 1, duration: 0.5 },
        { timestamp: 1.5, duration: 0.75 },
        { timestamp: 2.25, duration: 0.75 },
      ],
      [],
    )
    expect(times).toEqual([5, 5.375, 5.75, 6])
    expect([...sourceTimestamps(times, reversed)]).toEqual([2.625, 1.875, 1.25])
  })
  it('keeps source gaps and absent comparison clips distinct from a displayed fallback', () => {
    const windows = pairWindows(
      [clip({ startTime: 1, endTime: 2 })],
      [clip({ endTime: 3, outPoint: 3 })],
      3,
    )
    expect(windows.map((window) => Boolean(window.a))).toEqual([false, true, false])
    const frames = normalizeFrameTimings(
      [
        { timestamp: 0.5, duration: 0.1 },
        { timestamp: 0, duration: 0.1 },
      ],
      0.6,
    )
    expect(frameAt(frames, 0.2)).toBeNull()
    expect(frameAt(frames, 0.55)?.timestamp).toBe(0.5)
    expect(frameAt(frames, 0.6)).toBeNull()
  })
  it('does not create artificial intervals from floating point roundoff', () => {
    const frames = normalizeFrameTimings(
      [
        { timestamp: 0, duration: 0.1 },
        { timestamp: 0.1, duration: 0.2 },
        { timestamp: 0.3, duration: 0.7 },
      ],
      1,
    )
    const window = pairWindows([clip()], [clip()], 1)[0]
    expect(comparisonBoundaries(window, frames, frames)).toEqual([0, 0.1, 0.3, 1])
  })
  it('rejects invalid timing rather than inventing a nominal frame rate', () => {
    expect(() => pairWindows([clip({ speed: 0 })], [], 1)).toThrow('Invalid timing for clip')
    expect(() => normalizeFrameTimings([], 1)).toThrow('No usable video frame timestamps')
    expect(() =>
      normalizeFrameTimings(
        [
          { timestamp: 0, duration: 1 },
          { timestamp: 0, duration: 1 },
        ],
        1,
      ),
    ).toThrow('Ambiguous or invalid video frame timestamps')
  })
})
describe('difference intervals and viewport', () => {
  const samples = [
    sample(0, 0.1, 0),
    sample(0.1, 0.11, 1),
    sample(0.11, 0.2, 0),
    sample(0.2, 0.3, 0.5),
    sample(0.3, 0.4, 0.8),
    sample(0.4, 0.5, null),
    sample(0.5, 0.6, 0.5),
  ]
  it('retains one-frame spikes and flat plateaus without bridging an unavailable range', () => {
    const regions = appendRegions([], samples, 0.1)
    expect(regions).toHaveLength(3)
    expect(regions[0]).toEqual({ start: 0.1, end: 0.11, maxRatio: 1, peakTime: 0.1 })
    expect(regions[1]).toEqual({ start: 0.2, end: 0.4, maxRatio: 0.8, peakTime: 0.3 })
  })
  it('produces the same intervals across progress batches and does not mutate older results', () => {
    const prefix = appendRegions([], samples.slice(0, 4), 0.1)
    const copy = structuredClone(prefix)
    expect(appendRegions(prefix, samples.slice(4), 0.1)).toEqual(appendRegions([], samples, 0.1))
    expect(prefix).toEqual(copy)
  })
  it('pools maxima so a sub-pixel difference cannot be erased by matching neighbours', () => {
    const batches: DifferenceBatch[] = [
      {
        samples: [sample(0, 0.499, 0), sample(0.499, 0.501, 0.01), sample(0.501, 1, 0)],
        processedUntil: 1,
      },
    ]
    const { scores } = rasterizeDifference(batches, 0, 1, 1)
    expect(scores[0]).toBe(0.01)
    expect(scores[0] >= 0.01).toBe(true)
    expect(rasterizeDifference(batches, 2, 1, 1).flags[0]).toBe(0)
  })
  it('finds exact half-open samples and navigates without wrapping', () => {
    const batches = [
      { samples: samples.slice(0, 3), processedUntil: 0.2 },
      { samples: samples.slice(3), processedUntil: 0.6 },
    ]
    expect(findSample(batches, 0.2)?.start).toBe(0.2)
    expect(findSample(batches, 0.6)).toBeNull()
    const regions = appendRegions([], samples, 0.1)
    expect(regionIndexBefore(regions, 0.25)).toBe(1)
    expect(regionIndexAfter(regions, 0.25)).toBe(2)
    expect(regionIndexAfter(regions, 0.6)).toBe(-1)
    expect(regionIndexBefore(regions, 0)).toBe(-1)
    expect(regionAt(regions, 0.2)?.end).toBe(0.4)
    expect(regionAt(regions, 0.4)).toBeNull()
  })
  it('never upscales and bounds the standard comparison dimensions', () => {
    expect(
      comparisonSize({ width: 1920, height: 1080 }, { width: 1280, height: 720 }, 'standard'),
    ).toEqual({ width: 640, height: 360 })
    expect(
      comparisonSize({ width: 100, height: 100 }, { width: 200, height: 100 }, 'full'),
    ).toEqual({ width: 100, height: 100 })
  })
})
