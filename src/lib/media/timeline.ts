import type { TimelineClip } from '../../types'

export interface TimelineFrameRange {
  startTime: number
  endTime: number
}

export function findActiveClip(
  clips: readonly TimelineClip[],
  timelineTime: number,
): TimelineClip | null {
  return clips.find((clip) => timelineTime >= clip.startTime && timelineTime < clip.endTime) ?? null
}

export function findDisplayedClip(
  clips: readonly TimelineClip[],
  timelineTime: number,
): TimelineClip | null {
  return findActiveClip(clips, timelineTime) ?? clips[0] ?? null
}

/**
 * Convert a timeline position into the source-media position represented by a clip.
 */
export function calculateMediaTime(timelineTime: number, clip: TimelineClip): number | null {
  if (timelineTime < clip.startTime || timelineTime >= clip.endTime) {
    return null
  }

  const relativeTime = timelineTime - clip.startTime
  const speed = clip.speed || 1
  let mediaTime = clip.inPoint + relativeTime * speed

  mediaTime = Math.min(mediaTime, clip.outPoint)
  mediaTime = Math.max(mediaTime, clip.inPoint)

  if (clip.reverse) {
    mediaTime = clip.outPoint - (mediaTime - clip.inPoint)
  }

  return mediaTime
}

/**
 * Convert a source-media position back to the timeline position represented by a clip.
 */
export function calculateTimelineTime(mediaTime: number, clip: TimelineClip): number | null {
  if (mediaTime < clip.inPoint || mediaTime > clip.outPoint) {
    return null
  }

  const speed = clip.speed || 1
  if (speed <= 0) return null

  const mediaProgress = clip.reverse ? clip.outPoint - mediaTime : mediaTime - clip.inPoint
  const timelineTime = clip.startTime + mediaProgress / speed

  if (timelineTime < clip.startTime || timelineTime > clip.endTime) {
    return null
  }

  return timelineTime
}

/**
 * Map a decoded media-frame interval to the timeline interval where that frame is shown.
 */
export function calculateTimelineFrameRange(
  mediaTimestamp: number,
  mediaDuration: number,
  clip: TimelineClip,
): TimelineFrameRange | null {
  if (!Number.isFinite(mediaTimestamp) || !Number.isFinite(mediaDuration) || mediaDuration <= 0) {
    return null
  }

  const mediaStart = Math.max(mediaTimestamp, clip.inPoint)
  const mediaEnd = Math.min(mediaTimestamp + mediaDuration, clip.outPoint)
  if (mediaStart >= mediaEnd) return null

  const timelineStart = calculateTimelineTime(mediaStart, clip)
  const timelineEnd = calculateTimelineTime(mediaEnd, clip)
  if (timelineStart === null || timelineEnd === null) return null

  return {
    startTime: Math.min(timelineStart, timelineEnd),
    endTime: Math.max(timelineStart, timelineEnd),
  }
}
