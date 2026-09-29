import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { findSample, rasterizeDifference, regionAt } from '../../lib/difference/model'
import { useDifferenceStore } from '../../stores/differenceStore'
import { usePlaybackStore } from '../../stores/playbackStore'

export function DifferencePlot({ duration, pixelsPerSecond, containerRef, graph = false }: { duration: number; pixelsPerSecond?: number; containerRef?: RefObject<HTMLDivElement | null>; graph?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const warningRef = useRef<HTMLSpanElement>(null)
  const errorRef = useRef<HTMLSpanElement>(null)
  const mutedRef = useRef<HTMLSpanElement>(null)
  const [hoveredTime, setHoveredTime] = useState<number | null>(null)
  const batches = useDifferenceStore((state) => state.batches)
  const threshold = useDifferenceStore((state) => state.areaThreshold)
  const regions = useDifferenceStore((state) => state.regions)
  const height = graph ? 112 : 20
  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    const viewport = containerRef?.current ?? root
    if (!root || !canvas || !viewport) return
    let requestId = 0
    const draw = () => {
      requestId = 0
      const width = Math.max(1, Math.ceil(viewport.clientWidth))
      const scroll = graph ? 0 : viewport.scrollLeft
      const pps = graph ? width / Math.max(duration, 0.001) : pixelsPerSecond ?? 1
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.ceil(width * dpr)
      canvas.height = Math.ceil(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      canvas.style.left = `${scroll}px`
      const ctx = canvas.getContext('2d')
      if (!ctx || !warningRef.current || !errorRef.current || !mutedRef.current) return
      ctx.scale(dpr, dpr)
      const warning = getComputedStyle(warningRef.current).color
      const error = getComputedStyle(errorRef.current).color
      const muted = getComputedStyle(mutedRef.current).color
      const { scores, flags } = rasterizeDifference(batches, scroll / pps, pps, width)
      for (let x = 0; x < width; x++) {
        if (scroll + x >= duration * pps) continue
        if (scores[x] >= threshold) {
          ctx.fillStyle = warning
          const barHeight = graph ? Math.max(1, scores[x] * (height - 2)) : height - 4
          ctx.fillRect(x, height - 2 - barHeight, 1, barHeight)
        } else if (flags[x] & 2) {
          ctx.fillStyle = error
          ctx.globalAlpha = 0.6
          ctx.fillRect(x, 2, 1, height - 4)
          ctx.globalAlpha = 1
        } else if (flags[x] & 1) {
          if (graph && scores[x] > 0) {
            ctx.fillStyle = muted
            ctx.fillRect(x, height - 2 - scores[x] * (height - 2), 1, Math.max(1, scores[x] * (height - 2)))
          }
        } else if ((x + Math.floor(scroll)) % 8 < 2) {
          ctx.fillStyle = muted
          ctx.globalAlpha = 0.3
          ctx.fillRect(x, 2, 1, height - 4)
          ctx.globalAlpha = 1
        }
      }
      if (graph) {
        ctx.strokeStyle = warning
        ctx.setLineDash([4, 4])
        const y = (height - 2) * (1 - threshold)
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
      }
    }
    const schedule = () => { if (!requestId) requestId = requestAnimationFrame(draw) }
    const observer = new ResizeObserver(schedule)
    observer.observe(viewport)
    viewport.addEventListener('scroll', schedule, { passive: true })
    draw()
    return () => { observer.disconnect(); viewport.removeEventListener('scroll', schedule); cancelAnimationFrame(requestId) }
  }, [batches, threshold, duration, pixelsPerSecond, containerRef, graph, height])
  const timeAt = (clientX: number) => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return 0
    const pps = graph ? rect.width / Math.max(duration, 0.001) : pixelsPerSecond ?? 1
    return Math.max(0, Math.min(duration, (clientX - rect.left) / pps))
  }
  const sample = hoveredTime === null ? null : findSample(batches, hoveredTime)
  const region = hoveredTime === null ? null : regionAt(regions, hoveredTime)
  const title = region
    ? `${region.start.toFixed(6)}–${region.end.toFixed(6)}s: maximum ${(region.maxRatio * 100).toFixed(2)}% changed (peak at ${region.peakTime.toFixed(6)}s)`
    : sample
      ? `${sample.start.toFixed(6)}–${sample.end.toFixed(6)}s: ${sample.ratio === null ? sample.state : `${(sample.ratio * 100).toFixed(2)}% changed`}${sample.message ? ` — ${sample.message}` : ''}`
      : 'Not analyzed. Stripes: not analyzed; red: unavailable; amber: difference.'
  return (
    <div ref={rootRef} className="relative overflow-hidden border-b border-border bg-background" style={{ height }} data-testid={graph ? 'difference-graph' : 'difference-lane'} role="img" aria-label="Timeline differences. Use Previous difference and Next difference to navigate." title={title}
      onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}
      onMouseMove={(event) => setHoveredTime(timeAt(event.clientX))} onMouseLeave={() => setHoveredTime(null)}
      onClick={(event) => { event.stopPropagation(); usePlaybackStore.getState().seek(timeAt(event.clientX)) }}>
      <canvas ref={canvasRef} className="pointer-events-none absolute top-0" aria-hidden="true" />
      <span ref={warningRef} className="hidden text-warning" />
      <span ref={errorRef} className="hidden text-error" />
      <span ref={mutedRef} className="hidden text-text-muted" />
    </div>
  )
}
