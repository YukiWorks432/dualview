import type { TimelineClip, TimelineTrack } from '../../types'

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

  return Math.max(clip.inPoint, Math.min(clip.outPoint, calculateSourceTime(timelineTime, clip)))
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

/** 編集境界では末尾も扱う。範囲の制限は呼び出し側で行う。 */
export function calculateSourceTime(timelineTime: number, clip: TimelineClip): number {
  const progress = (timelineTime - clip.startTime) * (clip.speed || 1)
  return clip.reverse ? clip.outPoint - progress : clip.inPoint + progress
}

/** 速度・方向と、それ以外のクリップ属性を保ったまま範囲を切り出す。 */
export function sliceClip(clip: TimelineClip, startTime: number, endTime: number): TimelineClip {
  const boundary = (time: number) => {
    const source = calculateSourceTime(time, clip)
    return time >= clip.startTime && time <= clip.endTime
      ? Math.max(clip.inPoint, Math.min(clip.outPoint, source))
      : source
  }
  const start = boundary(startTime)
  const end = boundary(endTime)
  return {
    ...clip,
    startTime,
    endTime,
    inPoint: Math.min(start, end),
    outPoint: Math.max(start, end),
  }
}

export function calculateTimelineDuration(tracks: readonly TimelineTrack[]): number {
  const end = Math.max(0, ...tracks.flatMap((track) => track.clips.map((clip) => clip.endTime)))
  return end > 0 ? end : 1
}
