import type { SpeedRamp } from '../../types'
import { EASE_PRESETS, evaluateEaseCurve } from './easeCurve'

// Default speed ramp (no ramping)
export const DEFAULT_SPEED_RAMP: SpeedRamp = {
  enabled: false,
  keyframes: [
    { id: 'start', time: 0, speed: 1, easeCurve: EASE_PRESETS[4] },
    { id: 'end', time: 1, speed: 1, easeCurve: EASE_PRESETS[4] },
  ],
  reverse: false,
}

export function getSpeedAtTime(speedRamp: SpeedRamp, normalizedTime: number): number {
  if (!speedRamp.enabled || speedRamp.keyframes.length < 2) return 1

  const sortedKeyframes = [...speedRamp.keyframes].sort((a, b) => a.time - b.time)

  // Find surrounding keyframes
  let prevKf = sortedKeyframes[0]
  let nextKf = sortedKeyframes[sortedKeyframes.length - 1]

  for (let i = 0; i < sortedKeyframes.length - 1; i++) {
    if (
      sortedKeyframes[i].time <= normalizedTime &&
      sortedKeyframes[i + 1].time >= normalizedTime
    ) {
      prevKf = sortedKeyframes[i]
      nextKf = sortedKeyframes[i + 1]
      break
    }
  }

  // Calculate interpolation factor
  const range = nextKf.time - prevKf.time
  if (range <= 0) return prevKf.speed

  const localT = (normalizedTime - prevKf.time) / range
  const easedT = evaluateEaseCurve(prevKf.easeCurve, localT)

  // Interpolate speed
  return prevKf.speed + (nextKf.speed - prevKf.speed) * easedT
}

// Export utility function for calculating effective duration with speed ramp
export function calculateEffectiveDuration(originalDuration: number, speedRamp: SpeedRamp): number {
  if (!speedRamp.enabled) return originalDuration

  // Integrate speed curve to get effective duration
  const samples = 100
  let effectiveDuration = 0

  for (let i = 0; i < samples; i++) {
    const t = i / samples
    const speed = getSpeedAtTime(speedRamp, t)
    effectiveDuration += originalDuration / samples / speed
  }

  return effectiveDuration
}
