import { useCallback, useEffect, useRef } from 'react'

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
  const currentTime = usePlaybackStore((state) => state.currentTime)
  const seek = usePlaybackStore((state) => state.seek)
  const areaThreshold = useTimelineDiffStore((state) => state.areaThreshold)
  const status = useTimelineDiffStore((state) => state.status)
  const frames = useTimelineDiffStore((state) => state.frames)

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
      }
      const context = canvas.getContext('2d')
      if (!context) return
      context.setTransform(pixelWidth / width, 0, 0, dpr, 0, 0)

      if (needsFullDraw) {
        context.fillStyle = '#18212a'
        context.fillRect(0, 0, width, height)
      }

      const firstFrame = needsFullDraw ? 0 : previous.frameCount
      for (let index = firstFrame; index < frames.length; index++) {
        const frame = frames[index]
        const left = Math.max(0, frame.startTime * pixelsPerSecond)
        const right = Math.min(width, frame.endTime * pixelsPerSecond)
        if (right <= left) continue

        context.globalAlpha = 0.95
        if (frame.status === 'compared') {
          const rate = frame.differenceRate ?? 0
          context.fillStyle =
            rate > 0 && rate >= areaThreshold
              ? rate >= Math.max(areaThreshold * 3, 0.2)
                ? '#f04452'
                : '#bc3944'
              : '#35434d'
        } else {
          context.fillStyle = STATUS_COLORS[frame.status]
        }
        context.fillRect(left, 0, Math.max(1, right - left), height)
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
        context.fillText(emptyMessage, width / 2, 21)
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
        role="img"
        aria-label="Read-only A/B difference lane. Click to seek the shared timeline."
      />
      <div
        className="absolute top-0 bottom-0 z-10 w-px bg-white pointer-events-none"
        style={{ left: currentTime * pixelsPerSecond }}
        aria-hidden="true"
      />
    </div>
  )
}
