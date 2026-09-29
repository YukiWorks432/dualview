import type { EaseCurve } from '../../types'

// Built-in presets
export const EASE_PRESETS: EaseCurve[] = [
  { id: 'linear', name: 'Linear', x1: 0, y1: 0, x2: 1, y2: 1 },
  { id: 'ease', name: 'Ease', x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  { id: 'ease-in', name: 'Ease In', x1: 0.42, y1: 0, x2: 1, y2: 1 },
  { id: 'ease-out', name: 'Ease Out', x1: 0, y1: 0, x2: 0.58, y2: 1 },
  { id: 'ease-in-out', name: 'Ease In Out', x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  { id: 'ease-in-quad', name: 'Ease In Quad', x1: 0.55, y1: 0.085, x2: 0.68, y2: 0.53 },
  { id: 'ease-out-quad', name: 'Ease Out Quad', x1: 0.25, y1: 0.46, x2: 0.45, y2: 0.94 },
  { id: 'ease-in-cubic', name: 'Ease In Cubic', x1: 0.55, y1: 0.055, x2: 0.675, y2: 0.19 },
  { id: 'ease-out-cubic', name: 'Ease Out Cubic', x1: 0.215, y1: 0.61, x2: 0.355, y2: 1 },
  { id: 'ease-in-expo', name: 'Ease In Expo', x1: 0.95, y1: 0.05, x2: 0.795, y2: 0.035 },
  { id: 'ease-out-expo', name: 'Ease Out Expo', x1: 0.19, y1: 1, x2: 0.22, y2: 1 },
  { id: 'ease-in-back', name: 'Ease In Back', x1: 0.6, y1: -0.28, x2: 0.735, y2: 0.045 },
  { id: 'ease-out-back', name: 'Ease Out Back', x1: 0.175, y1: 0.885, x2: 0.32, y2: 1.275 },
]

// Calculate cubic bezier value at t
export function cubicBezier(t: number, p1: number, p2: number): number {
  // Cubic bezier formula: (1-t)^3*0 + 3*(1-t)^2*t*p1 + 3*(1-t)*t^2*p2 + t^3*1
  const oneMinusT = 1 - t
  return 3 * oneMinusT * oneMinusT * t * p1 + 3 * oneMinusT * t * t * p2 + t * t * t
}

// Sample the bezier curve for rendering
export function sampleBezierCurve(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  samples: number = 100,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const x = cubicBezier(t, x1, x2)
    const y = cubicBezier(t, y1, y2)
    points.push({ x, y })
  }
  return points
}

// Utility function to evaluate ease curve at a given t (0-1)
export function evaluateEaseCurve(curve: EaseCurve, t: number): number {
  return cubicBezier(t, curve.y1, curve.y2)
}
