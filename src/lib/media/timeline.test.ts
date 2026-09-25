import { describe, expect, it } from 'vitest'

import type { TimelineClip } from '../../types'
import {
  calculateMediaTime,
  calculateTimelineTime,
  findActiveClip,
  findDisplayedClip,
} from './timeline'

function clip(overrides: Partial<TimelineClip> = {}): TimelineClip {
  return {
    id: 'clip',
    mediaId: 'media',
    trackId: 'track-a',
    startTime: 5,
    endTime: 15,
    inPoint: 10,
    outPoint: 30,
    ...overrides,
  }
}

describe('timeline media mapping', () => {
  it('maps positioned and trimmed clips to source time', () => {
    expect(calculateMediaTime(7, clip())).toBe(12)
  })

  it('applies clip playback speed', () => {
    expect(calculateMediaTime(7, clip({ speed: 2 }))).toBe(14)
  })

  it('maps reverse clips inside their in/out range', () => {
    expect(calculateMediaTime(7, clip({ reverse: true }))).toBe(28)
  })

  it('maps source time back to the positioned timeline clip', () => {
    expect(calculateTimelineTime(12, clip())).toBe(7)
    expect(calculateTimelineTime(14, clip({ speed: 2 }))).toBe(7)
    expect(calculateTimelineTime(28, clip({ reverse: true }))).toBe(7)
  })

  it('returns null outside the clip and finds the active clip', () => {
    const clips = [clip(), clip({ id: 'later', startTime: 20, endTime: 25 })]

    expect(calculateMediaTime(4.9, clips[0])).toBeNull()
    expect(calculateTimelineTime(9.9, clips[0])).toBeNull()
    expect(findActiveClip(clips, 21)?.id).toBe('later')
    expect(findActiveClip(clips, 18)).toBeNull()
  })

  it('uses the active clip for display and otherwise falls back to the first clip', () => {
    const clips = [clip(), clip({ id: 'later', startTime: 20, endTime: 25 })]

    expect(findDisplayedClip(clips, 21)?.id).toBe('later')
    expect(findDisplayedClip(clips, 18)?.id).toBe('clip')
    expect(findDisplayedClip([], 18)).toBeNull()
  })
})
