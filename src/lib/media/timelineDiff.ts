import pixelmatch from 'pixelmatch'

import type { TimelineClip } from '../../types'

export interface FrameTiming {
  timestamp: number
  duration: number
}

export type TimelineDiffFrameStatus = 'compared' | 'missing' | 'unsupported' | 'error'

export interface TimelineDiffFrameScore {
  startTime: number
  endTime: number
  sampleTime: number
  differenceRate: number | null
  status: TimelineDiffFrameStatus
  reason?: string
  clipAId?: string
  clipBId?: string
}

export interface TimelineDiffSegment {
  startTime: number
  endTime: number
  maxDifferenceRate: number
  maxDifferenceTime: number
}

export interface TimelineDiffRasterRange {
  startPixel: number
  endPixel: number
}

export function findTimelineDiffFrameAtTime(
  frames: readonly TimelineDiffFrameScore[],
  timelineTime: number,
): TimelineDiffFrameScore | null {
  let low = 0
  let high = frames.length - 1
  let candidate = -1

  while (low <= high) {
    const middle = (low + high) >>> 1
    if (frames[middle].startTime <= timelineTime) {
      candidate = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  if (candidate < 0 || timelineTime >= frames[candidate].endTime) return null
  return frames[candidate]
}

export interface TimelineDiffFrameInterval {
  startTime: number
  endTime: number
}

const TIME_EPSILON = 1e-7

/** Maps a source frame's displayed interval into a clip's timeline interval. */
export function mapFrameIntervalToTimeline(
  frame: FrameTiming,
  clip: TimelineClip,
): TimelineDiffFrameInterval | null {
  const speed = clip.speed || 1
  if (
    !Number.isFinite(frame.timestamp) ||
    !Number.isFinite(frame.duration) ||
    frame.duration <= 0 ||
    !Number.isFinite(speed) ||
    speed <= 0 ||
    clip.outPoint <= clip.inPoint
  ) {
    return null
  }

  const mediaStart = Math.max(frame.timestamp, clip.inPoint)
  const mediaEnd = Math.min(frame.timestamp + frame.duration, clip.outPoint)
  if (mediaEnd - mediaStart <= TIME_EPSILON) return null

  const timelineStart = clip.reverse
    ? clip.startTime + (clip.outPoint - mediaEnd) / speed
    : clip.startTime + (mediaStart - clip.inPoint) / speed
  const timelineEnd = clip.reverse
    ? clip.startTime + (clip.outPoint - mediaStart) / speed
    : clip.startTime + (mediaEnd - clip.inPoint) / speed

  const startTime = Math.max(timelineStart, clip.startTime)
  const endTime = Math.min(timelineEnd, clip.endTime)
  if (endTime - startTime <= TIME_EPSILON) return null

  return { startTime, endTime }
}

export function findFrameAtMediaTime(
  frames: readonly FrameTiming[],
  mediaTime: number,
): FrameTiming | null {
  let low = 0
  let high = frames.length - 1
  let candidate = -1

  while (low <= high) {
    const middle = (low + high) >>> 1
    if (frames[middle].timestamp <= mediaTime) {
      candidate = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  if (candidate < 0) return null
  const frame = frames[candidate]
  return mediaTime < frame.timestamp + frame.duration ? frame : null
}

/** Builds all boundaries where either active A/B display frame can change. */
export function collectTimelineDiffEventTimes(
  duration: number,
  clipsA: readonly TimelineClip[],
  clipsB: readonly TimelineClip[],
  frameTimingsByMediaId: ReadonlyMap<string, readonly FrameTiming[]>,
): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return []

  const times = [0, duration]
  for (const clip of [...clipsA, ...clipsB]) {
    if (clip.endTime <= clip.startTime) continue
    times.push(Math.max(0, Math.min(duration, clip.startTime)))
    times.push(Math.max(0, Math.min(duration, clip.endTime)))

    for (const frame of frameTimingsByMediaId.get(clip.mediaId) ?? []) {
      const interval = mapFrameIntervalToTimeline(frame, clip)
      if (!interval) continue
      times.push(Math.max(0, Math.min(duration, interval.startTime)))
      times.push(Math.max(0, Math.min(duration, interval.endTime)))
    }
  }

  times.sort((a, b) => a - b)
  return times.reduce<number[]>((uniqueTimes, time) => {
    const previous = uniqueTimes[uniqueTimes.length - 1]
    if (previous === undefined || time - previous > TIME_EPSILON) uniqueTimes.push(time)
    return uniqueTimes
  }, [])
}

export function calculatePixelDifferenceRate(
  imageA: Uint8Array | Uint8ClampedArray,
  imageB: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  colorThreshold: number,
): number {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new RangeError('Comparison image dimensions must be positive integers')
  }

  const expectedLength = width * height * 4
  if (imageA.length !== expectedLength || imageB.length !== expectedLength) {
    throw new RangeError('Comparison image data must contain one RGBA value per pixel')
  }

  const differenceMask = new Uint8Array(expectedLength)
  pixelmatch(imageA, imageB, differenceMask, width, height, {
    threshold: colorThreshold,
    includeAA: true,
    diffMask: true,
  })

  let differentPixels = 0
  for (let offset = 0; offset < expectedLength; offset += 4) {
    const colorChanged = differenceMask[offset + 3] !== 0
    const alphaChanged = Math.abs(imageA[offset + 3] - imageB[offset + 3]) / 255 > colorThreshold
    if (colorChanged || alphaChanged) differentPixels++
  }
  return differentPixels / (width * height)
}

/** Maps a timeline interval to the backing pixels available to the difference lane. */
export function mapTimelineDiffIntervalToRaster(
  startTime: number,
  endTime: number,
  pixelsPerSecond: number,
  canvasWidth: number,
  pixelWidth: number,
): TimelineDiffRasterRange | null {
  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    !Number.isFinite(pixelsPerSecond) ||
    !Number.isFinite(canvasWidth) ||
    !Number.isInteger(pixelWidth) ||
    pixelsPerSecond <= 0 ||
    canvasWidth <= 0 ||
    pixelWidth <= 0
  ) {
    return null
  }

  const left = Math.max(0, Math.min(canvasWidth, startTime * pixelsPerSecond))
  const right = Math.max(0, Math.min(canvasWidth, endTime * pixelsPerSecond))
  if (right <= left) return null

  const scale = pixelWidth / canvasWidth
  const startPixel = Math.max(0, Math.min(pixelWidth - 1, Math.floor(left * scale)))
  const endPixel = Math.max(startPixel + 1, Math.min(pixelWidth, Math.ceil(right * scale)))
  return { startPixel, endPixel }
}

/** Keeps the strongest frame state when multiple intervals share a backing pixel. */
export function mergeTimelineDiffRasterInterval(
  raster: Uint8Array,
  startPixel: number,
  endPixel: number,
  value: number,
): boolean {
  let changed = false
  const start = Math.max(0, Math.min(raster.length, startPixel))
  const end = Math.max(start, Math.min(raster.length, endPixel))
  for (let pixel = start; pixel < end; pixel++) {
    if (raster[pixel] >= value) continue
    raster[pixel] = value
    changed = true
  }
  return changed
}

export function buildTimelineDiffSegments(
  frames: readonly TimelineDiffFrameScore[],
  areaThreshold: number,
): TimelineDiffSegment[] {
  const segments: TimelineDiffSegment[] = []
  let current: TimelineDiffSegment | null = null
  let currentClipPair = ''

  const finishCurrent = () => {
    if (current) segments.push(current)
    current = null
    currentClipPair = ''
  }

  for (const frame of frames) {
    const isDifferent =
      frame.status === 'compared' &&
      frame.differenceRate !== null &&
      frame.differenceRate > 0 &&
      frame.differenceRate >= areaThreshold

    if (!isDifferent) {
      finishCurrent()
      continue
    }

    const clipPair = `${frame.clipAId ?? ''}\u0000${frame.clipBId ?? ''}`
    const touchesPrevious = current && Math.abs(current.endTime - frame.startTime) <= TIME_EPSILON
    if (!current || !touchesPrevious || currentClipPair !== clipPair) {
      finishCurrent()
      current = {
        startTime: frame.startTime,
        endTime: frame.endTime,
        maxDifferenceRate: frame.differenceRate as number,
        maxDifferenceTime: frame.sampleTime,
      }
      currentClipPair = clipPair
      continue
    }

    current.endTime = frame.endTime
    if ((frame.differenceRate as number) > current.maxDifferenceRate) {
      current.maxDifferenceRate = frame.differenceRate as number
      current.maxDifferenceTime = frame.sampleTime
    }
  }

  finishCurrent()
  return segments
}

export function appendTimelineDiffSegments(
  currentSegments: readonly TimelineDiffSegment[],
  previousFrames: readonly TimelineDiffFrameScore[],
  appendedFrames: readonly TimelineDiffFrameScore[],
  areaThreshold: number,
): TimelineDiffSegment[] {
  if (appendedFrames.length === 0) return currentSegments.slice()

  const lastFrame = previousFrames[previousFrames.length - 1]
  const lastSegment = currentSegments[currentSegments.length - 1]
  const lastFrameWasHighlighted =
    lastFrame?.status === 'compared' &&
    lastFrame.differenceRate !== null &&
    lastFrame.differenceRate >= areaThreshold
  const canExtendLastSegment =
    lastFrameWasHighlighted &&
    lastSegment !== undefined &&
    Math.abs(lastSegment.endTime - lastFrame.endTime) <= TIME_EPSILON

  if (!canExtendLastSegment || !lastFrame || !lastSegment) {
    return currentSegments.concat(buildTimelineDiffSegments(appendedFrames, areaThreshold))
  }

  const seed: TimelineDiffFrameScore = {
    startTime: lastSegment.startTime,
    endTime: lastSegment.endTime,
    sampleTime: lastSegment.maxDifferenceTime,
    differenceRate: lastSegment.maxDifferenceRate,
    status: 'compared',
    clipAId: lastFrame.clipAId,
    clipBId: lastFrame.clipBId,
  }
  return currentSegments
    .slice(0, -1)
    .concat(buildTimelineDiffSegments([seed, ...appendedFrames], areaThreshold))
}

export function findNextTimelineDiffSegment(
  segments: readonly TimelineDiffSegment[],
  currentTime: number,
  direction: 'previous' | 'next',
): TimelineDiffSegment | null {
  if (segments.length === 0) return null

  if (direction === 'next') {
    return segments.find((segment) => segment.startTime > currentTime + TIME_EPSILON) ?? segments[0]
  }

  for (let index = segments.length - 1; index >= 0; index--) {
    if (segments[index].endTime <= currentTime + TIME_EPSILON) return segments[index]
  }
  return segments[segments.length - 1]
}

export function findTimelineDiffSegmentAtTime(
  segments: readonly TimelineDiffSegment[],
  timelineTime: number,
): TimelineDiffSegment | null {
  let low = 0
  let high = segments.length - 1
  let candidate = -1

  while (low <= high) {
    const middle = (low + high) >>> 1
    if (segments[middle].startTime <= timelineTime) {
      candidate = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  if (candidate < 0 || timelineTime >= segments[candidate].endTime) return null
  return segments[candidate]
}
