import type { TimelineClip } from '../../types'

export function findActiveClip(
  clips: readonly TimelineClip[],
  timelineTime: number,
): TimelineClip | null {
  return clips.find((clip) => timelineTime >= clip.startTime && timelineTime < clip.endTime) ?? null
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
