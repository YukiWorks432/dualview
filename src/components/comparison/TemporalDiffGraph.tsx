import { BarChart2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { usePlaybackStore } from '../../stores/playbackStore'
import { useTimelineDiffStore } from '../../stores/timelineDiffStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { ElevatedSurface } from '../ui'

interface TemporalDiffGraphProps {
  isVisible: boolean
}

interface GraphPoint {
  time: number
  rate: number | null
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

export function TemporalDiffGraph({ isVisible }: TemporalDiffGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredTime, setHoveredTime] = useState<number | null>(null)
  const currentTime = usePlaybackStore((state) => state.currentTime)
  const seek = usePlaybackStore((state) => state.seek)
  const duration = useTimelineStore((state) => state.duration)
  const status = useTimelineDiffStore((state) => state.status)
  const message = useTimelineDiffStore((state) => state.message)
  const progress = useTimelineDiffStore((state) => state.progress)
  const frames = useTimelineDiffStore((state) => state.frames)
  const segments = useTimelineDiffStore((state) => state.segments)

  const points = useMemo<GraphPoint[]>(() => {
    const step = Math.max(1, Math.ceil(frames.length / 1200))
    const result: GraphPoint[] = []
    for (let index = 0; index < frames.length; index += step) {
      const group = frames.slice(index, index + step)
      const compared = group.filter(
        (frame) => frame.status === 'compared' && frame.differenceRate !== null,
      )
      if (compared.length === 0) {
        const frame = group[0]
        result.push({ time: (frame.startTime + frame.endTime) / 2, rate: null })
        continue
      }
      const peak = compared.reduce((best, frame) =>
        (frame.differenceRate ?? 0) > (best.differenceRate ?? 0) ? frame : best,
      )
      result.push({ time: peak.sampleTime, rate: peak.differenceRate })
    }
    return result
  }, [frames])

  const peakCount = segments.length

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !isVisible) return

    const draw = () => {
      const rect = container.getBoundingClientRect()
      const width = rect.width
      const height = rect.height
      if (width <= 0 || height <= 0) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.ceil(width * dpr)
      canvas.height = Math.ceil(height * dpr)
      const context = canvas.getContext('2d')
      if (!context) return
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.fillStyle = '#1a1a1a'
      context.fillRect(0, 0, width, height)

      const padding = { top: 14, right: 16, bottom: 24, left: 42 }
      const graphWidth = width - padding.left - padding.right
      const graphHeight = height - padding.top - padding.bottom

      context.strokeStyle = '#333333'
      context.lineWidth = 1
      for (let index = 0; index <= 4; index++) {
        const y = padding.top + (graphHeight * index) / 4
        context.beginPath()
        context.moveTo(padding.left, y)
        context.lineTo(width - padding.right, y)
        context.stroke()
      }

      if (duration > 0) {
        context.fillStyle = 'rgba(240, 68, 82, 0.22)'
        for (const segment of segments) {
          const left = padding.left + (segment.startTime / duration) * graphWidth
          const right = padding.left + (segment.endTime / duration) * graphWidth
          context.fillRect(left, padding.top, Math.max(1, right - left), graphHeight)
        }

        const maxRate = Math.max(...points.map((point) => point.rate ?? 0), 0.01)
        context.fillStyle = '#858585'
        context.font = '9px monospace'
        context.textAlign = 'right'
        for (let index = 0; index <= 4; index++) {
          const value = maxRate * (1 - index / 4) * 100
          const y = padding.top + (graphHeight * index) / 4
          context.fillText(value.toFixed(1) + '%', padding.left - 4, y + 3)
        }

        context.strokeStyle = '#ff6974'
        context.lineWidth = 1.5
        context.beginPath()
        let started = false
        for (const point of points) {
          if (point.rate === null) {
            started = false
            continue
          }
          const x = padding.left + (point.time / duration) * graphWidth
          const y = padding.top + graphHeight - (point.rate / maxRate) * graphHeight
          if (!started) {
            context.moveTo(x, y)
            started = true
          } else {
            context.lineTo(x, y)
          }
        }
        context.stroke()

        if (currentTime >= 0) {
          const playheadX = padding.left + (currentTime / duration) * graphWidth
          context.strokeStyle = '#cddc39'
          context.lineWidth = 1
          context.beginPath()
          context.moveTo(playheadX, padding.top)
          context.lineTo(playheadX, height - padding.bottom)
          context.stroke()
        }

        if (hoveredTime !== null) {
          const hoverX = padding.left + (hoveredTime / duration) * graphWidth
          context.strokeStyle = '#ffffff'
          context.setLineDash([3, 3])
          context.beginPath()
          context.moveTo(hoverX, padding.top)
          context.lineTo(hoverX, height - padding.bottom)
          context.stroke()
          context.setLineDash([])
          context.fillStyle = '#ffffff'
          context.font = '10px monospace'
          context.textAlign = 'left'
          context.fillText(
            hoveredTime.toFixed(2) + ' s',
            Math.min(hoverX + 6, width - 58),
            padding.top + 10,
          )
        }

        context.fillStyle = '#888888'
        context.font = '9px monospace'
        context.textAlign = 'left'
        context.fillText('0 s', padding.left, height - 7)
        context.textAlign = 'right'
        context.fillText(duration.toFixed(1) + ' s', width - padding.right, height - 7)
      } else {
        context.fillStyle = '#888888'
        context.font = '12px system-ui'
        context.textAlign = 'center'
        context.fillText('Timeline has no duration', width / 2, height / 2)
      }
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(container)
    return () => observer.disconnect()
  }, [currentTime, duration, frames, hoveredTime, isVisible, points, segments])

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const container = containerRef.current
      if (!container || duration <= 0) return
      const rect = container.getBoundingClientRect()
      const padding = { left: 42, right: 16 }
      const graphWidth = rect.width - padding.left - padding.right
      const x = event.clientX - rect.left - padding.left
      if (x >= 0 && x <= graphWidth) seek((x / graphWidth) * duration)
    },
    [duration, seek],
  )

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const container = containerRef.current
      if (!container || duration <= 0) return
      const rect = container.getBoundingClientRect()
      const padding = { left: 42, right: 16 }
      const graphWidth = rect.width - padding.left - padding.right
      const x = event.clientX - rect.left - padding.left
      setHoveredTime(x >= 0 && x <= graphWidth ? (x / graphWidth) * duration : null)
    },
    [duration],
  )

  if (!isVisible) return null

  return (
    <ElevatedSurface offset={1} shadowLevel={null} className="border-t border-border">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <BarChart2 size={16} className="text-accent" />
          <span className="text-sm text-text-secondary font-medium">
            Temporal Difference Analysis
          </span>
        </div>
        <span className="text-xs text-text-muted" title={message ?? undefined}>
          {statusLabel(status)}
          {status === 'analyzing' ? ' ' + progress.toFixed(0) + '%' : ''}
          {frames.length > 0 ? ' · ' + peakCount + ' highlighted intervals' : ''}
        </span>
      </div>
      <div ref={containerRef} className="h-32 relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredTime(null)}
          role="img"
          aria-label="Temporal A/B frame difference graph. Click to seek."
        />
        {frames.length === 0 && status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-text-muted">
            Run analysis from the timeline controls to view results.
          </div>
        )}
      </div>
    </ElevatedSurface>
  )
}
