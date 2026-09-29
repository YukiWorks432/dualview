import type { DifferenceNoiseFilter } from '../../stores/differenceHighlightStore'

export function sensitivityToPixelmatchThreshold(sensitivity: number): number {
  const normalized = Math.max(0, Math.min(100, sensitivity)) / 100
  return 0.3 - normalized * 0.28
}

export function getBaseMinimumRegionPixels(noiseFilter: DifferenceNoiseFilter): number {
  switch (noiseFilter) {
    case 'off':
      return 1
    case 'low':
      return 4
    case 'medium':
      return 12
    case 'high':
      return 32
  }
}

export function scaleMinimumRegionPixels(
  basePixels: number,
  width: number,
  height: number,
): number {
  const referencePixels = 960 * 540
  const scale = Math.max(0.25, (width * height) / referencePixels)
  return Math.max(1, Math.round(basePixels * scale))
}
