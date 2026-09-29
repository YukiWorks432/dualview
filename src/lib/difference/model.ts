import type { TimelineClip } from '../../types'
import { calculateMediaTime, calculateTimelineTime, findActiveClip } from '../media/timeline'

export interface DifferenceOptions {
  pixelThreshold: number
  resolution: 'standard' | 'full'
}
export const DEFAULT_DIFFERENCE_OPTIONS: DifferenceOptions = { pixelThreshold: 0.1, resolution: 'standard' }
export type DifferenceState = 'compared' | 'missing-a' | 'missing-b' | 'empty' | 'unsupported' | 'error'
export interface DifferenceSample {
  start: number
  end: number
  state: DifferenceState
  ratio: number | null
  message?: string
}
export interface DifferenceRegion { start: number; end: number; maxRatio: number; peakTime: number }
export interface FrameTiming { timestamp: number; duration: number }
export interface DifferenceMedia { id: string; name: string; type: 'video' | 'image'; file: File }
export interface DifferenceRequest {
  key: string
  duration: number
  clipsA: TimelineClip[]
  clipsB: TimelineClip[]
  media: DifferenceMedia[]
  options: DifferenceOptions
}
export interface PairWindow { start: number; end: number; a: TimelineClip | null; b: TimelineClip | null }
export interface DifferenceBatch { samples: DifferenceSample[]; processedUntil: number }
export type DifferenceWorkerMessage =
  | { type: 'progress'; jobId: number; batch: DifferenceBatch }
  | { type: 'metadata'; jobId: number; descriptions: string[] }
  | { type: 'complete'; jobId: number }
  | { type: 'error'; jobId: number; message: string }

export function validateOptions(options: DifferenceOptions): void {
  if (!Number.isFinite(options.pixelThreshold) || options.pixelThreshold < 0 || options.pixelThreshold > 1 || !['standard', 'full'].includes(options.resolution)) {
    throw new Error('Invalid difference analysis settings')
  }
}
export function validateClip(clip: TimelineClip): void {
  const values = [clip.startTime, clip.endTime, clip.inPoint, clip.outPoint, clip.speed ?? 1]
  if (!values.every(Number.isFinite) || clip.endTime <= clip.startTime || clip.inPoint < 0 || clip.outPoint <= clip.inPoint || (clip.speed ?? 1) <= 0) {
    throw new Error(`Invalid timing for clip ${clip.id}`)
  }
}
export function pairWindows(clipsA: readonly TimelineClip[], clipsB: readonly TimelineClip[], duration: number): PairWindow[] {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Invalid timeline duration')
  const edges = new Set([0, duration])
  for (const clip of [...clipsA, ...clipsB]) {
    validateClip(clip)
    edges.add(Math.max(0, Math.min(duration, clip.startTime)))
    edges.add(Math.max(0, Math.min(duration, clip.endTime)))
  }
  const times = [...edges].sort((a, b) => a - b)
  return times.slice(0, -1).map((start, index) => {
    const end = times[index + 1]
    const midpoint = start + (end - start) / 2
    return { start, end, a: findActiveClip(clipsA, midpoint), b: findActiveClip(clipsB, midpoint) }
  })
}
/** Packet order can differ from presentation order (for example, B-frames). */
export function normalizeFrameTimings(frames: readonly FrameTiming[], trackEnd: number): FrameTiming[] {
  const sorted = [...frames].sort((a, b) => a.timestamp - b.timestamp)
  if (!Number.isFinite(trackEnd) || sorted.length === 0) throw new Error('No usable video frame timestamps')
  return sorted.map((frame, index) => {
    const next = sorted[index + 1]?.timestamp ?? trackEnd
    if (!Number.isFinite(frame.timestamp) || !Number.isFinite(frame.duration) || frame.duration < 0 || next <= frame.timestamp) {
      throw new Error('Ambiguous or invalid video frame timestamps')
    }
    const declaredEnd = frame.timestamp + frame.duration
    const end = frame.duration === 0 || Math.abs(declaredEnd - next) < 1e-9 ? next : Math.min(declaredEnd, next)
    return { timestamp: frame.timestamp, duration: end - frame.timestamp }
  })
}
/** The union of both presentation timelines, never a nominal-FPS sampling grid. */
export function comparisonBoundaries(window: PairWindow, framesA: readonly FrameTiming[], framesB: readonly FrameTiming[]): number[] {
  const times = new Set([window.start, window.end])
  for (const [clip, frames] of [[window.a, framesA], [window.b, framesB]] as const) {
    if (!clip) continue
    for (const frame of frames) {
      for (const mediaTime of [frame.timestamp, frame.timestamp + frame.duration]) {
        const time = calculateTimelineTime(mediaTime, clip)
        if (time !== null && time > window.start && time < window.end) times.add(time)
      }
    }
  }
  // Coalesce only floating-point roundoff, not real frame intervals or gaps.
  const sorted = [...times].sort((a, b) => a - b)
  const result: number[] = []
  for (const time of sorted) {
    if (!result.length || time - result[result.length - 1] > 1e-9) result.push(time)
    else if (time === window.end) result[result.length - 1] = time
  }
  return result
}
export function* sourceTimestamps(times: readonly number[], clip: TimelineClip): Generator<number> {
  for (let index = 0; index < times.length - 1; index++) {
    // The midpoint avoids selecting the next frame at a reverse-playback boundary.
    const time = times[index] + (times[index + 1] - times[index]) / 2
    const source = calculateMediaTime(time, clip)
    if (source === null) throw new Error('Comparison time is outside the active clip')
    yield source
  }
}
export function frameAt(frames: readonly FrameTiming[], time: number): FrameTiming | null {
  let low = 0
  let high = frames.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (frames[mid].timestamp <= time) low = mid + 1
    else high = mid
  }
  const frame = frames[low - 1]
  return frame && time < frame.timestamp + frame.duration ? frame : null
}
/** Append without smoothing away short differences or bridging unavailable samples. */
export function appendRegions(previous: readonly DifferenceRegion[], samples: readonly DifferenceSample[], areaThreshold: number): DifferenceRegion[] {
  if (!Number.isFinite(areaThreshold) || areaThreshold <= 0 || areaThreshold > 1) throw new Error('Difference area must be greater than 0 and at most 100%')
  const regions = previous.map((region) => ({ ...region }))
  for (const sample of samples) {
    if (sample.state !== 'compared' || sample.ratio === null || sample.ratio < areaThreshold) continue
    const last = regions.at(-1)
    if (last && last.end === sample.start) {
      last.end = sample.end
      if (sample.ratio > last.maxRatio) { last.maxRatio = sample.ratio; last.peakTime = sample.start }
    } else regions.push({ start: sample.start, end: sample.end, maxRatio: sample.ratio, peakTime: sample.start })
  }
  return regions
}
export function regionsFromBatches(batches: readonly DifferenceBatch[], areaThreshold: number): DifferenceRegion[] {
  return appendRegions([], batches.flatMap((batch) => batch.samples), areaThreshold)
}
export function findSample(batches: readonly DifferenceBatch[], time: number): DifferenceSample | null {
  let low = 0
  let high = batches.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (batches[mid].processedUntil <= time) low = mid + 1
    else high = mid
  }
  const samples = batches[low]?.samples ?? []
  low = 0
  high = samples.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (samples[mid].end <= time) low = mid + 1
    else high = mid
  }
  const sample = samples[low]
  return sample && sample.start <= time && time < sample.end ? sample : null
}
export function comparisonSize(a: { width: number; height: number }, b: { width: number; height: number }, resolution: DifferenceOptions['resolution']): { width: number; height: number } {
  let width = Math.min(a.width, b.width)
  let height = Math.min(a.height, b.height)
  if (![width, height].every((value) => Number.isFinite(value) && value > 0)) throw new Error('Invalid display dimensions')
  const scale = resolution === 'standard' ? Math.min(1, 640 / Math.max(width, height)) : 1
  width = Math.max(1, Math.floor(width * scale))
  height = Math.max(1, Math.floor(height * scale))
  return { width, height }
}
export function regionIndexBefore(regions: readonly DifferenceRegion[], time: number): number {
  let low = 0
  let high = regions.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (regions[mid].start < time) low = mid + 1
    else high = mid
  }
  return low - 1
}
export function regionIndexAfter(regions: readonly DifferenceRegion[], time: number): number {
  let low = 0
  let high = regions.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (regions[mid].start <= time) low = mid + 1
    else high = mid
  }
  return low < regions.length ? low : -1
}
/** One bucket per CSS pixel; max pooling preserves even sub-pixel difference intervals. */
export function rasterizeDifference(batches: readonly DifferenceBatch[], start: number, pixelsPerSecond: number, width: number): { scores: Float64Array; flags: Uint8Array } {
  const scores = new Float64Array(width)
  const flags = new Uint8Array(width)
  const end = start + width / pixelsPerSecond
  for (const batch of batches) {
    if (batch.processedUntil <= start) continue
    if (batch.samples[0]?.start >= end) break
    for (const sample of batch.samples) {
      if (sample.end <= start) continue
      if (sample.start >= end) break
      const left = Math.max(0, Math.floor((sample.start - start) * pixelsPerSecond))
      const right = Math.min(width, Math.max(left + 1, Math.ceil((sample.end - start) * pixelsPerSecond)))
      for (let x = left; x < right; x++) {
        if (sample.state === 'compared' && sample.ratio !== null) { scores[x] = Math.max(scores[x], sample.ratio); flags[x] |= 1 }
        else flags[x] |= 2
      }
    }
  }
  return { scores, flags }
}
export function regionAt(regions: readonly DifferenceRegion[], time: number): DifferenceRegion | null {
  const after = regionIndexAfter(regions, time)
  const region = regions[after < 0 ? regions.length - 1 : after - 1]
  return region && time >= region.start && time < region.end ? region : null
}
