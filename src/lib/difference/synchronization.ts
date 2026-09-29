import type { TimelineFrameRange } from '../media/timeline'

interface PausedVideoFrameState {
  currentTime: number
  paused: boolean
  seeking: boolean
}

export function getStablePausedVideoFrameTime(
  before: PausedVideoFrameState,
  after: PausedVideoFrameState,
): number | null {
  if (
    !before.paused ||
    !after.paused ||
    before.seeking ||
    after.seeking ||
    !Number.isFinite(before.currentTime) ||
    before.currentTime !== after.currentTime
  ) {
    return null
  }

  return before.currentTime
}

export function getPausedVideoFrameRange(
  presentedTimelineTime: number,
  pausedTimelineTime: number,
  maximumFrameLagSeconds: number,
): TimelineFrameRange | null {
  if (
    !Number.isFinite(presentedTimelineTime) ||
    !Number.isFinite(pausedTimelineTime) ||
    !Number.isFinite(maximumFrameLagSeconds) ||
    maximumFrameLagSeconds < 0 ||
    Math.abs(presentedTimelineTime - pausedTimelineTime) > maximumFrameLagSeconds
  ) {
    return null
  }

  return {
    startTime: Math.min(presentedTimelineTime, pausedTimelineTime),
    endTime: Math.max(presentedTimelineTime, pausedTimelineTime),
  }
}

export function getConsecutivePresentedFrameRange(
  previous: { timelineTime: number; presentedFrames: number },
  next: { timelineTime: number; presentedFrames: number },
): TimelineFrameRange | null {
  if (
    !Number.isFinite(previous.timelineTime) ||
    !Number.isFinite(next.timelineTime) ||
    !Number.isSafeInteger(previous.presentedFrames) ||
    !Number.isSafeInteger(next.presentedFrames) ||
    next.presentedFrames !== previous.presentedFrames + 1 ||
    next.timelineTime === previous.timelineTime
  ) {
    return null
  }

  return {
    startTime: Math.min(previous.timelineTime, next.timelineTime),
    endTime: Math.max(previous.timelineTime, next.timelineTime),
  }
}

export function areFrameRangesSynchronized(
  frameRanges: readonly (TimelineFrameRange | null)[],
  expectedTime: number,
  expectedToleranceSeconds: number,
  maximumGapSeconds: number,
  minimumOverlapSeconds = 0,
): boolean {
  if (
    !Number.isFinite(expectedTime) ||
    !Number.isFinite(expectedToleranceSeconds) ||
    expectedToleranceSeconds < 0 ||
    !Number.isFinite(maximumGapSeconds) ||
    maximumGapSeconds < 0 ||
    !Number.isFinite(minimumOverlapSeconds) ||
    minimumOverlapSeconds < 0
  ) {
    return false
  }

  const observedRanges = frameRanges.filter((range): range is TimelineFrameRange => range !== null)
  if (
    observedRanges.some(
      ({ startTime, endTime }) =>
        !Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime > endTime,
    )
  ) {
    return false
  }
  if (observedRanges.length === 0) return true

  const pointRanges = observedRanges.filter(({ startTime, endTime }) => startTime === endTime)
  const intervalRanges = observedRanges.filter(({ startTime, endTime }) => startTime < endTime)

  if (intervalRanges.length === 0) {
    const pointStart = Math.min(...pointRanges.map(({ startTime }) => startTime))
    const pointEnd = Math.max(...pointRanges.map(({ endTime }) => endTime))
    return (
      pointEnd - pointStart <= maximumGapSeconds &&
      Math.abs((pointStart + pointEnd) / 2 - expectedTime) <= expectedToleranceSeconds
    )
  }

  const commonStart = Math.max(...intervalRanges.map(({ startTime }) => startTime))
  const commonEnd = Math.min(...intervalRanges.map(({ endTime }) => endTime))
  const gap = Math.max(0, commonStart - commonEnd)
  const overlap = Math.max(0, commonEnd - commonStart)
  if (gap > maximumGapSeconds || overlap < minimumOverlapSeconds) return false

  if (pointRanges.length > 0) {
    const pointStart = Math.min(...pointRanges.map(({ startTime }) => startTime))
    const pointEnd = Math.max(...pointRanges.map(({ endTime }) => endTime))
    if (
      pointEnd - pointStart > maximumGapSeconds ||
      pointStart < commonStart - maximumGapSeconds ||
      pointEnd > commonEnd + maximumGapSeconds
    ) {
      return false
    }

    return Math.abs((pointStart + pointEnd) / 2 - expectedTime) <= expectedToleranceSeconds
  }

  const nearestCommonTime =
    gap > 0
      ? (commonStart + commonEnd) / 2
      : Math.min(commonEnd, Math.max(commonStart, expectedTime))

  return Math.abs(nearestCommonTime - expectedTime) <= expectedToleranceSeconds
}

export function getPlaybackDifferenceExpiryDelay(
  now: number,
  capturedAt: number,
  maxAge: number,
): number {
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(capturedAt) ||
    !Number.isFinite(maxAge) ||
    maxAge < 0 ||
    now < capturedAt
  ) {
    return 0
  }

  return Math.max(0, capturedAt + maxAge - now)
}

export function isPlaybackDifferenceResultFresh(
  now: number,
  capturedAt: number,
  maxAge: number,
): boolean {
  return getPlaybackDifferenceExpiryDelay(now, capturedAt, maxAge) > 0
}
