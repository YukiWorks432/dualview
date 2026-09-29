import type { TimelineFrameRange } from '../media/timeline'

const SAME_FRAME_RANGE_TOLERANCE_SECONDS = 0.000001

export type FrameTimeObservation =
  | { kind: 'unknown' }
  | { kind: 'point'; time: number }
  | { kind: 'interval'; range: TimelineFrameRange }
  | { kind: 'paused-video'; presentedTime: number; currentTime: number }

export function getFrameObservationAnchor(
  observations: readonly FrameTimeObservation[],
  fallbackTime: number,
): number {
  const intervalRanges = observations.flatMap((observation) =>
    observation.kind === 'interval' ? [observation.range] : [],
  )
  if (intervalRanges.length > 1) {
    const commonStart = Math.max(...intervalRanges.map(({ startTime }) => startTime))
    const commonEnd = Math.min(...intervalRanges.map(({ endTime }) => endTime))
    if (commonEnd > commonStart) {
      if (fallbackTime >= commonStart && fallbackTime < commonEnd) return fallbackTime
      return (commonStart + commonEnd) / 2
    }
  }

  const observation = observations.find(({ kind }) => kind !== 'unknown')
  if (!observation) return fallbackTime

  switch (observation.kind) {
    case 'unknown':
      return fallbackTime
    case 'point':
      return observation.time
    case 'interval':
      return (observation.range.startTime + observation.range.endTime) / 2
    case 'paused-video':
      return observation.currentTime
  }
}

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

function intervalsDescribeSameFrame(ranges: readonly TimelineFrameRange[]): boolean {
  if (ranges.length < 2) return false

  const firstRange = ranges[0]
  const commonStart = Math.max(...ranges.map(({ startTime }) => startTime))
  const commonEnd = Math.min(...ranges.map(({ endTime }) => endTime))
  return (
    commonEnd > commonStart &&
    ranges.every(
      ({ startTime, endTime }) =>
        Math.abs(startTime - firstRange.startTime) <= SAME_FRAME_RANGE_TOLERANCE_SECONDS &&
        Math.abs(endTime - firstRange.endTime) <= SAME_FRAME_RANGE_TOLERANCE_SECONDS,
    )
  )
}

function arePointsSynchronized(
  times: readonly number[],
  expectedTime: number,
  expectedToleranceSeconds: number,
  maximumGapSeconds: number,
): boolean {
  if (times.length === 0) return true

  const pointStart = Math.min(...times)
  const pointEnd = Math.max(...times)
  return (
    pointEnd - pointStart <= maximumGapSeconds &&
    Math.abs((pointStart + pointEnd) / 2 - expectedTime) <= expectedToleranceSeconds
  )
}

export function areFrameObservationsSynchronized(
  observations: readonly FrameTimeObservation[],
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

  const pointTimes: number[] = []
  const intervalRanges: TimelineFrameRange[] = []
  const pausedVideoObservations: Extract<FrameTimeObservation, { kind: 'paused-video' }>[] = []

  for (const observation of observations) {
    switch (observation.kind) {
      case 'unknown':
        break
      case 'point':
        if (!Number.isFinite(observation.time)) return false
        pointTimes.push(observation.time)
        break
      case 'interval': {
        const { startTime, endTime } = observation.range
        if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime > endTime) {
          return false
        }
        if (startTime === endTime) pointTimes.push(startTime)
        else intervalRanges.push(observation.range)
        break
      }
      case 'paused-video':
        if (
          !Number.isFinite(observation.presentedTime) ||
          !Number.isFinite(observation.currentTime)
        ) {
          return false
        }
        pausedVideoObservations.push(observation)
        break
    }
  }

  if (
    pausedVideoObservations.some(
      ({ currentTime }) => Math.abs(currentTime - expectedTime) > expectedToleranceSeconds,
    )
  ) {
    return false
  }

  if (intervalRanges.length === 0) {
    const pausedRanges: TimelineFrameRange[] = []
    const synchronizedPointTimes = [...pointTimes]
    for (const { presentedTime, currentTime } of pausedVideoObservations) {
      const range = {
        startTime: Math.min(presentedTime, currentTime),
        endTime: Math.max(presentedTime, currentTime),
      }
      if (range.startTime < range.endTime) pausedRanges.push(range)
      else synchronizedPointTimes.push(presentedTime)
    }
    const observedRanges = pausedRanges
    if (observedRanges.length === 0) {
      return arePointsSynchronized(
        synchronizedPointTimes,
        expectedTime,
        expectedToleranceSeconds,
        maximumGapSeconds,
      )
    }

    const commonStart = Math.max(...observedRanges.map(({ startTime }) => startTime))
    const commonEnd = Math.min(...observedRanges.map(({ endTime }) => endTime))
    const gap = Math.max(0, commonStart - commonEnd)
    const overlap = Math.max(0, commonEnd - commonStart)
    const singleShortPausedFrame =
      synchronizedPointTimes.length === 0 &&
      observedRanges.length === 1 &&
      pausedVideoObservations.length === 1 &&
      observedRanges[0].endTime - observedRanges[0].startTime < minimumOverlapSeconds
    if (
      gap > maximumGapSeconds ||
      (overlap < minimumOverlapSeconds &&
        !intervalsDescribeSameFrame(observedRanges) &&
        !singleShortPausedFrame)
    ) {
      return false
    }

    if (synchronizedPointTimes.length > 0) {
      const pointStart = Math.min(...synchronizedPointTimes)
      const pointEnd = Math.max(...synchronizedPointTimes)
      if (
        pointEnd - pointStart > maximumGapSeconds ||
        pointStart < commonStart - SAME_FRAME_RANGE_TOLERANCE_SECONDS ||
        pointEnd > commonEnd + SAME_FRAME_RANGE_TOLERANCE_SECONDS
      ) {
        return false
      }

      return arePointsSynchronized(
        synchronizedPointTimes,
        expectedTime,
        expectedToleranceSeconds,
        maximumGapSeconds,
      )
    }

    const nearestCommonTime =
      gap > 0
        ? (commonStart + commonEnd) / 2
        : Math.min(commonEnd, Math.max(commonStart, expectedTime))
    return Math.abs(nearestCommonTime - expectedTime) <= expectedToleranceSeconds
  }

  const commonStart = Math.max(...intervalRanges.map(({ startTime }) => startTime))
  const commonEnd = Math.min(...intervalRanges.map(({ endTime }) => endTime))
  const gap = Math.max(0, commonStart - commonEnd)
  const overlap = Math.max(0, commonEnd - commonStart)
  if (
    gap > maximumGapSeconds ||
    (overlap < minimumOverlapSeconds && !intervalsDescribeSameFrame(intervalRanges))
  ) {
    return false
  }

  if (
    pausedVideoObservations.some(
      ({ presentedTime }) =>
        presentedTime < commonStart - SAME_FRAME_RANGE_TOLERANCE_SECONDS ||
        presentedTime >= commonEnd,
    )
  ) {
    return false
  }

  if (pointTimes.length > 0) {
    const pointStart = Math.min(...pointTimes)
    const pointEnd = Math.max(...pointTimes)
    if (
      pointEnd - pointStart > maximumGapSeconds ||
      pointTimes.some(
        (time) =>
          time < commonStart - SAME_FRAME_RANGE_TOLERANCE_SECONDS ||
          time >= commonEnd ||
          Math.abs(time - expectedTime) > expectedToleranceSeconds,
      )
    ) {
      return false
    }
  }

  if (pausedVideoObservations.length > 0) return true

  return (
    expectedTime >= commonStart - SAME_FRAME_RANGE_TOLERANCE_SECONDS && expectedTime < commonEnd
  )
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
