import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  findTimelineDiffFrameAtTime,
  findTimelineDiffSegmentAtTime,
  mapTimelineDiffIntervalToRaster,
  mergeTimelineDiffRasterInterval,
  type TimelineDiffFrameScore,
} from '../../lib/media/timelineDiff'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useTimelineDiffStore } from '../../stores/timelineDiffStore'

interface TimelineDiffLaneProps {
  duration: number
  pixelsPerSecond: number
}

const STATUS_COLORS = {
  missing: '#e6a23c',
  unsupported: '#a78bfa',
  error: '#f87171',
} as const

const RASTER_COLORS = [
  '#35434d',
  '#bc3944',
  '#f04452',
  STATUS_COLORS.missing,
  STATUS_COLORS.unsupported,
  STATUS_COLORS.error,
] as const

function frameRasterValue(frame: TimelineDiffFrameScore, areaThreshold: number): number {
  if (frame.status === 'compared') {
    const rate = frame.differenceRate ?? 0
    if (rate <= 0 || rate < areaThreshold) return 0
    return rate >= Math.max(areaThreshold * 3, 0.2) ? 2 : 1
  }

  switch (frame.status) {
    case 'missing':
      return 3
    case 'unsupported':
      return 4
    case 'error':
      return 5
  }
  return 0
}

function statusLabel(status: string): string {
  switch (status) {
    case 'analyzing':
      return 'Analyzing'
    case 'cancelling':
      return 'Stopping'
    case 'complete':
      return 'Complete'
    case 'partial':
      return 'Partial results'
    case 'stale':
      return 'Outdated'
    case 'unsupported':
      return 'Unsupported'
    case 'error':
      return 'Failed'
    default:
      return 'Not analyzed'
  }
}

export function TimelineDiffLane({ duration, pixelsPerSecond }: TimelineDiffLaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lastDrawRef = useRef({ key: '', frameCount: 0 })
  const pixelKindsRef = useRef(new Uint8Array(0))
  const currentTime = usePlaybackStore((state) => state.currentTime)
  const seek = usePlaybackStore((state) => state.seek)
  const [hoveredTime, setHoveredTime] = useState<number | null>(null)
  const areaThreshold = useTimelineDiffStore((state) => state.areaThreshold)
  const status = useTimelineDiffStore((state) => state.status)
  const frames = useTimelineDiffStore((state) => state.frames)
  const segments = useTimelineDiffStore((state) => state.segments)
  const hoveredFrame = useMemo(
    () => (hoveredTime === null ? null : findTimelineDiffFrameAtTime(frames, hoveredTime)),
    [frames, hoveredTime],
  )
  const hoveredSegment = useMemo(
    () => (hoveredTime === null ? null : findTimelineDiffSegmentAtTime(segments, hoveredTime)),
    [hoveredTime, segments],
  )

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (pixelsPerSecond <= 0) return
      const rect = event.currentTarget.getBoundingClientRect()
      const time = (event.clientX - rect.left) / pixelsPerSecond
      setHoveredTime(time >= 0 && time < duration ? time : null)
    },
    [duration, pixelsPerSecond],
  )

  const seekFromCanvas = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      event.stopPropagation()
      if (duration <= 0 || pixelsPerSecond <= 0) return
      const rect = event.currentTarget.getBoundingClientRect()
      const time = (event.clientX - rect.left) / pixelsPerSecond
      seek(Math.max(0, Math.min(duration, time)))
    },
    [duration, pixelsPerSecond, seek],
  )

  const hoverTitle = hoveredFrame
    ? [
        `${hoveredFrame.startTime.toFixed(3)}–${hoveredFrame.endTime.toFixed(3)}s`,
        hoveredFrame.status === 'compared'
          ? `Frame difference: ${((hoveredFrame.differenceRate ?? 0) * 100).toFixed(2)}%`
          : `${hoveredFrame.status}: ${hoveredFrame.reason ?? 'Frame unavailable'}`,
        hoveredSegment
          ? `Highlight peak: ${(hoveredSegment.maxDifferenceRate * 100).toFixed(2)}% at ${hoveredSegment.maxDifferenceTime.toFixed(3)}s`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Hover for frame interval details. Click to seek.'

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    if (!canvas || !container) return

    const draw = () => {
      const { width } = container.getBoundingClientRect()
      if (width <= 0) return
      const height = 34
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pixelWidth = Math.max(1, Math.min(32768, Math.ceil(width * dpr)))
      const key = [width, dpr, duration, pixelsPerSecond, areaThreshold, status].join(':')
      const previous = lastDrawRef.current
      const needsFullDraw = previous.key !== key || frames.length < previous.frameCount

      if (needsFullDraw) {
        canvas.width = pixelWidth
        canvas.height = Math.ceil(height * dpr)
        pixelKindsRef.current = new Uint8Array(pixelWidth)
      }
      const context = canvas.getContext('2d')
      if (!context) return
      context.setTransform(1, 0, 0, dpr, 0, 0)

      if (needsFullDraw) {
        context.fillStyle = frames.length > 0 ? RASTER_COLORS[0] : '#18212a'
        context.fillRect(0, 0, pixelWidth, height)
      }

      const firstFrame = needsFullDraw ? 0 : previous.frameCount
      const pixelKinds = pixelKindsRef.current
      for (let index = firstFrame; index < frames.length; index++) {
        const frame = frames[index]
        const range = mapTimelineDiffIntervalToRaster(
          frame.startTime,
          frame.endTime,
          pixelsPerSecond,
          width,
          pixelWidth,
        )
        if (!range) continue

        const value = frameRasterValue(frame, areaThreshold)
        if (!mergeTimelineDiffRasterInterval(pixelKinds, range.startPixel, range.endPixel, value)) {
          continue
        }

        context.globalAlpha = 0.95
        let runStart = range.startPixel
        let runValue = pixelKinds[runStart]
        for (let pixel = range.startPixel + 1; pixel <= range.endPixel; pixel++) {
          const nextValue = pixel < range.endPixel ? pixelKinds[pixel] : -1
          if (nextValue === runValue) continue
          context.fillStyle = RASTER_COLORS[runValue] ?? RASTER_COLORS[0]
          context.fillRect(runStart, 0, pixel - runStart, height)
          runStart = pixel
          runValue = nextValue
        }
      }
      context.globalAlpha = 1

      if (needsFullDraw && frames.length === 0) {
        context.fillStyle = '#84909b'
        context.font = '11px system-ui'
        context.textAlign = 'center'
        const emptyMessage =
          status === 'idle'
            ? 'Run A/B analysis to mark differences, gaps, and unsupported intervals'
            : statusLabel(status)
        context.fillText(emptyMessage, pixelWidth / 2, 21)
      }

      lastDrawRef.current = { key, frameCount: frames.length }
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(container)
    return () => observer.disconnect()
  }, [areaThreshold, duration, frames, pixelsPerSecond, status])

  return (
    <div
      data-marquee-ignore
      className="relative border-b border-border"
      style={{ width: duration * pixelsPerSecond, minWidth: '100%' }}
      onClick={(event) => event.stopPropagation()}
    >
      <canvas
        ref={canvasRef}
        className="block h-[34px] w-full cursor-crosshair"
        onClick={seekFromCanvas}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredTime(null)}
        role="img"
        aria-label="Read-only A/B difference lane. Click to seek the shared timeline."
        title={hoverTitle}
      />
      <div
        className="absolute top-0 bottom-0 z-10 w-px bg-white pointer-events-none"
        style={{ left: currentTime * pixelsPerSecond }}
        aria-hidden="true"
      />
    </div>
  )
}
