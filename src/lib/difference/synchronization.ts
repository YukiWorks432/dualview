export function areFrameTimesSynchronized(
  frameTimes: readonly (number | null)[],
  expectedTime: number,
  toleranceSeconds: number,
): boolean {
  if (
    !Number.isFinite(expectedTime) ||
    !Number.isFinite(toleranceSeconds) ||
    toleranceSeconds < 0
  ) {
    return false
  }

  const observedTimes = frameTimes.filter((time): time is number => time !== null)
  if (observedTimes.some((time) => !Number.isFinite(time))) return false
  if (observedTimes.length === 0) return true

  const earliestTime = Math.min(...observedTimes)
  const latestTime = Math.max(...observedTimes)

  return (
    observedTimes.every((time) => Math.abs(time - expectedTime) <= toleranceSeconds) &&
    latestTime - earliestTime <= toleranceSeconds
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
