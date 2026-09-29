import { describe, expect, it } from 'vitest'

import type { TimelineClip } from '../../types'
import {
  appendTimelineDiffSegments,
  buildTimelineDiffSegments,
  calculatePixelDifferenceRate,
  collectTimelineDiffEventTimes,
  findFrameAtMediaTime,
  findNextTimelineDiffSegment,
  findTimelineDiffFrameAtTime,
  findTimelineDiffSegmentAtTime,
  mapTimelineDiffIntervalToRaster,
  mapFrameIntervalToTimeline,
  mergeTimelineDiffRasterInterval,
  type TimelineDiffFrameScore,
} from './timelineDiff'

function clip(overrides: Partial<TimelineClip> = {}): TimelineClip {
  return {
    id: 'clip',
    mediaId: 'media',
    trackId: 'track-a',
    startTime: 0,
    endTime: 2,
    inPoint: 10,
    outPoint: 14,
    ...overrides,
  }
}

function score(overrides: Partial<TimelineDiffFrameScore> = {}): TimelineDiffFrameScore {
  return {
    startTime: 0,
    endTime: 0.5,
    sampleTime: 0.25,
    differenceRate: 0.3,
    status: 'compared',
    clipAId: 'a',
    clipBId: 'b',
    ...overrides,
  }
}

describe('timeline difference frame mapping', () => {
  it('maps trimmed and sped-up source frame intervals to timeline time', () => {
    expect(
      mapFrameIntervalToTimeline({ timestamp: 10.5, duration: 1 }, clip({ speed: 2 })),
    ).toEqual({
      startTime: 0.25,
      endTime: 0.75,
    })
  })

  it('maps reverse-playback frame intervals in presentation order', () => {
    expect(
      mapFrameIntervalToTimeline(
        { timestamp: 11, duration: 1 },
        clip({ reverse: true, outPoint: 12 }),
      ),
    ).toEqual({ startTime: 0, endTime: 1 })
    expect(
      mapFrameIntervalToTimeline(
        { timestamp: 10, duration: 1 },
        clip({ reverse: true, outPoint: 12 }),
      ),
    ).toEqual({ startTime: 1, endTime: 2 })
  })

  it('clips frame intervals to the selected in/out range', () => {
    expect(mapFrameIntervalToTimeline({ timestamp: 9, duration: 2 }, clip())).toEqual({
      startTime: 0,
      endTime: 1,
    })
    expect(mapFrameIntervalToTimeline({ timestamp: 14, duration: 1 }, clip())).toBeNull()
  })

  it('uses variable frame durations to find the displayed frame at a timestamp', () => {
    const frames = [
      { timestamp: 0, duration: 0.2 },
      { timestamp: 0.2, duration: 0.55 },
      { timestamp: 0.75, duration: 0.25 },
    ]
    expect(findFrameAtMediaTime(frames, 0.7)).toBe(frames[1])
    expect(findFrameAtMediaTime(frames, 0.75)).toBe(frames[2])
    expect(findFrameAtMediaTime(frames, 1)).toBeNull()
  })

  it('collects clip and variable-frame boundaries without losing close frame changes', () => {
    const times = collectTimelineDiffEventTimes(
      2,
      [clip()],
      [clip({ id: 'b', trackId: 'track-b', endTime: 1 })],
      new Map([
        [
          'media',
          [
            { timestamp: 10, duration: 0.5 },
            { timestamp: 10.5, duration: 0.5 },
            { timestamp: 11, duration: 0.5 },
          ],
        ],
      ]),
    )
    expect(times).toEqual([0, 0.5, 1, 1.5, 2])
  })
})

describe('pixel difference rate', () => {
  it('returns the fraction of pixels that exceed the color threshold', () => {
    const blackAndWhite = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255])
    const changed = new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255])
    expect(calculatePixelDifferenceRate(blackAndWhite, changed, 2, 1, 0.1)).toBe(0.5)
  })

  it('ignores hidden RGB under full transparency while counting visible alpha changes', () => {
    const transparentBlack = new Uint8ClampedArray([0, 0, 0, 0])
    const transparentRed = new Uint8ClampedArray([255, 0, 0, 0])
    const visibleBlack = new Uint8ClampedArray([0, 0, 0, 255])
    expect(calculatePixelDifferenceRate(transparentBlack, transparentRed, 1, 1, 0.1)).toBe(0)
    expect(calculatePixelDifferenceRate(transparentBlack, visibleBlack, 1, 1, 0.1)).toBe(1)
  })

  it('counts alpha-only changes even when the visible RGB values match', () => {
    const transparentGray = new Uint8ClampedArray([48, 48, 48, 0])
    const opaqueGray = new Uint8ClampedArray([48, 48, 48, 255])
    expect(calculatePixelDifferenceRate(transparentGray, opaqueGray, 1, 1, 0.1)).toBe(1)
  })

  it('rejects image buffers whose length does not match the comparison dimensions', () => {
    expect(() =>
      calculatePixelDifferenceRate(new Uint8Array(3), new Uint8Array(4), 1, 1, 0.1),
    ).toThrow('one RGBA value per pixel')
  })
})

describe('highlighted interval grouping', () => {
  it('looks up half-open frame and highlight intervals at hover time', () => {
    const first = score()
    const second = score({ startTime: 0.5, endTime: 1, sampleTime: 0.75 })
    const frames = [first, second]
    const segments = buildTimelineDiffSegments(frames, 0.1)

    expect(findTimelineDiffFrameAtTime(frames, 0.5)).toBe(second)
    expect(findTimelineDiffFrameAtTime(frames, 1)).toBeNull()
    expect(findTimelineDiffSegmentAtTime(segments, 0.5)).toBe(segments[0])
    expect(findTimelineDiffSegmentAtTime(segments, 1)).toBeNull()
  })

  it('joins adjacent changed frames and starts a new segment after gaps and clip changes', () => {
    const segments = buildTimelineDiffSegments(
      [
        score(),
        score({ startTime: 0.5, endTime: 1, sampleTime: 0.75, differenceRate: 0.2 }),
        score({
          startTime: 1,
          endTime: 1.5,
          sampleTime: 1.25,
          status: 'missing',
          differenceRate: null,
        }),
        score({ startTime: 1.5, endTime: 2, sampleTime: 1.75, differenceRate: 0.5 }),
        score({ startTime: 2, endTime: 2.5, sampleTime: 2.25, clipBId: 'different-b' }),
        score({
          startTime: 2.5,
          endTime: 3,
          sampleTime: 2.75,
          status: 'error',
          differenceRate: null,
        }),
      ],
      0.1,
    )

    expect(segments).toEqual([
      { startTime: 0, endTime: 1, maxDifferenceRate: 0.3, maxDifferenceTime: 0.25 },
      { startTime: 1.5, endTime: 2, maxDifferenceRate: 0.5, maxDifferenceTime: 1.75 },
      { startTime: 2, endTime: 2.5, maxDifferenceRate: 0.3, maxDifferenceTime: 2.25 },
    ])
  })

  it('skips the active interval and wraps previous and next navigation', () => {
    const segments = buildTimelineDiffSegments(
      [score(), score({ startTime: 2, endTime: 2.5, sampleTime: 2.25 })],
      0.1,
    )
    expect(findNextTimelineDiffSegment(segments, 0.25, 'previous')?.startTime).toBe(2)
    expect(findNextTimelineDiffSegment(segments, 2.25, 'previous')?.startTime).toBe(0)
    expect(findNextTimelineDiffSegment(segments, 0, 'previous')?.startTime).toBe(2)
    expect(findNextTimelineDiffSegment(segments, 0.5, 'next')?.startTime).toBe(2)
    expect(findNextTimelineDiffSegment(segments, 2.5, 'next')?.startTime).toBe(0)
  })

  it('does not mark identical frames when the area threshold is zero', () => {
    const segments = buildTimelineDiffSegments(
      [
        score({ differenceRate: 0 }),
        score({ startTime: 0.5, endTime: 1, sampleTime: 0.75, differenceRate: 0.01 }),
      ],
      0,
    )

    expect(segments).toEqual([
      { startTime: 0.5, endTime: 1, maxDifferenceRate: 0.01, maxDifferenceTime: 0.75 },
    ])
  })

  it('matches a full rebuild when score batches extend a highlighted run', () => {
    const frames = [
      score(),
      score({ startTime: 0.5, endTime: 1, sampleTime: 0.75, differenceRate: 0.4 }),
      score({
        startTime: 1,
        endTime: 1.5,
        sampleTime: 1.25,
        status: 'missing',
        differenceRate: null,
      }),
      score({ startTime: 1.5, endTime: 2, sampleTime: 1.75, differenceRate: 0.5 }),
    ]
    const firstBatch = frames.slice(0, 2)
    const firstSegments = buildTimelineDiffSegments(firstBatch, 0.1)
    const appendedSegments = appendTimelineDiffSegments(
      firstSegments,
      firstBatch,
      frames.slice(2),
      0.1,
    )

    expect(appendedSegments).toEqual(buildTimelineDiffSegments(frames, 0.1))
  })
})

describe('difference lane rasterization', () => {
  it('maps short intervals to the available backing pixel on a long timeline', () => {
    const first = mapTimelineDiffIntervalToRaster(4, 4.01, 1, 100_000, 32_768)
    const second = mapTimelineDiffIntervalToRaster(4.02, 4.03, 1, 100_000, 32_768)
    expect(first).toEqual({ startPixel: 1, endPixel: 2 })
    expect(second).toEqual(first)
    if (!first || !second) throw new Error('Expected both intervals to map to a backing pixel')

    const raster = new Uint8Array(32_768)
    expect(mergeTimelineDiffRasterInterval(raster, first.startPixel, first.endPixel, 2)).toBe(true)
    expect(mergeTimelineDiffRasterInterval(raster, second.startPixel, second.endPixel, 0)).toBe(
      false,
    )
    expect(raster[1]).toBe(2)
  })
})
