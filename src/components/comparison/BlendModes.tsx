import { useRef, useEffect, useCallback, useMemo, useState } from 'react'

import { useSyncedZoom } from '../../hooks/useSyncedZoom'
import { isVisualFrameReady, type VisualFrameElement } from '../../lib/media/frameSource'
import { useMediaStore } from '../../stores/mediaStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useProjectStore } from '../../stores/projectStore'
import { useTimelineStore } from '../../stores/timelineStore'
import type { BlendMode } from '../../types'
import { VisualSurface } from '../media/VisualSurface'

const blendModeMap: Record<BlendMode, GlobalCompositeOperation> = {
  difference: 'difference',
  overlay: 'overlay',
  multiply: 'multiply',
  screen: 'screen',
}

export function BlendModes() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mediaARef = useRef<VisualFrameElement>(null)
  const mediaBRef = useRef<VisualFrameElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const [frameRevision, setFrameRevision] = useState(0)

  const { blendMode } = useProjectStore()
  const { tracks } = useTimelineStore()
  const { currentTime, isPlaying } = usePlaybackStore()
  const { getFile } = useMediaStore()
  const { zoom, panX, panY, resetZoom, containerProps } = useSyncedZoom()

  // Get tracks
  const trackA = tracks.find((t) => t.type === 'a')
  const trackB = tracks.find((t) => t.type === 'b')

  // Get first clip for display
  const firstClipA = trackA?.clips[0] || null
  const firstClipB = trackB?.clips[0] || null

  // Find clip that contains current time
  const activeClipA = useMemo(() => {
    if (!trackA) return null
    return trackA.clips.find((c) => currentTime >= c.startTime && currentTime < c.endTime) || null
  }, [trackA, currentTime])

  const activeClipB = useMemo(() => {
    if (!trackB) return null
    return trackB.clips.find((c) => currentTime >= c.startTime && currentTime < c.endTime) || null
  }, [trackB, currentTime])

  // Use active clip's media for display (clip at current time), fallback to first clip
  const displayClipA = activeClipA || firstClipA
  const displayClipB = activeClipB || firstClipB
  const rawMediaA = displayClipA ? getFile(displayClipA.mediaId) : null
  const rawMediaB = displayClipB ? getFile(displayClipB.mediaId) : null
  const mediaA = rawMediaA?.type === 'video' || rawMediaA?.type === 'image' ? rawMediaA : null
  const mediaB = rawMediaB?.type === 'video' || rawMediaB?.type === 'image' ? rawMediaB : null

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const sourceA = mediaARef.current
    const sourceB = mediaBRef.current

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const sourceAReady = !mediaA || isVisualFrameReady(sourceA)
    const sourceBReady = !mediaB || isVisualFrameReady(sourceB)
    if (!sourceAReady || !sourceBReady) {
      if (isPlaying) {
        animationRef.current = requestAnimationFrame(renderFrame)
      }
      return
    }

    // Apply zoom and pan transforms (IMG-002)
    ctx.save()
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    ctx.translate(centerX + panX, centerY + panY)
    ctx.scale(zoom, zoom)
    ctx.translate(-centerX, -centerY)

    // Draw B first (base layer), then A with the selected blend mode.
    if (isVisualFrameReady(sourceB) && mediaB) {
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(sourceB, 0, 0, canvas.width, canvas.height)
    }

    if (isVisualFrameReady(sourceA) && mediaA) {
      ctx.globalCompositeOperation = blendModeMap[blendMode]
      ctx.drawImage(sourceA, 0, 0, canvas.width, canvas.height)
    }

    // Reset composite operation and restore transform
    ctx.globalCompositeOperation = 'source-over'
    ctx.restore()

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(renderFrame)
    }
  }, [blendMode, isPlaying, mediaA, mediaB, zoom, panX, panY])

  const handleFrameReady = useCallback(() => {
    setFrameRevision((revision) => revision + 1)
  }, [])

  // Start render loop
  useEffect(() => {
    renderFrame()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [renderFrame, frameRevision])

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const parent = canvas.parentElement
      if (parent) {
        canvas.width = parent.clientWidth
        canvas.height = parent.clientHeight
        renderFrame()
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [renderFrame])

  return (
    <div className="relative w-full h-full bg-black" {...containerProps}>
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Zoom indicator (IMG-002) */}
      {zoom > 1 && (
        <div className="absolute top-4 right-4 z-20 bg-black/70 backdrop-blur-sm px-3 py-1 flex items-center gap-2">
          <span className="text-xs text-text-primary font-medium">{Math.round(zoom * 100)}%</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              resetZoom()
            }}
            className="text-[10px] text-text-muted hover:text-text-primary"
          >
            Reset
          </button>
        </div>
      )}

      {/* Hidden visual surfaces for canvas drawing */}
      {mediaA && (
        <VisualSurface
          ref={mediaARef}
          media={mediaA}
          clip={activeClipA || firstClipA}
          className="hidden"
          dataTrack="a"
          alt="Track A"
          onFrameReady={handleFrameReady}
        />
      )}
      {mediaB && (
        <VisualSurface
          ref={mediaBRef}
          media={mediaB}
          clip={activeClipB || firstClipB}
          className="hidden"
          dataTrack="b"
          alt="Track B"
          onFrameReady={handleFrameReady}
        />
      )}

      {/* Placeholder when no media */}
      {!mediaA && !mediaB && (
        <div className="absolute inset-0 flex items-center justify-center text-text-muted">
          <span>Drop videos to compare with blend modes</span>
        </div>
      )}

      {/* Blend mode label */}
      <div className="absolute top-4 left-4 bg-black/60 px-2 py-1 text-xs text-white capitalize">
        {blendMode}
      </div>
    </div>
  )
}
