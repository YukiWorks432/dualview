import { Upload } from 'lucide-react'
import { useRef, useEffect, useMemo } from 'react'

import { useDropZone } from '../../hooks/useDropZone'
import { usePixelInspector } from '../../hooks/usePixelInspector'
import { useSyncedZoom } from '../../hooks/useSyncedZoom'
import { SUPPORTED_MEDIA_ACCEPT } from '../../lib/media/fileTypes'
import type { VideoFrameElement } from '../../lib/media/frameSource'
import { calculateVideoMetrics } from '../../lib/metrics'
import { cn } from '../../lib/utils'
import { useMediaStore } from '../../stores/mediaStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useProjectStore } from '../../stores/projectStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { VideoSurface } from '../media/VideoSurface'
import { MagnifierLoupe, useMagnifier } from './MagnifierLoupe'
import { MetricsOverlay } from './MetricsOverlay'
import { PixelInspector } from './PixelInspector'

export function SideBySide() {
  const videoARef = useRef<VideoFrameElement>(null)
  const videoBRef = useRef<VideoFrameElement>(null)
  const imgARef = useRef<HTMLImageElement>(null)
  const imgBRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { tracks } = useTimelineStore()
  const { currentTime } = usePlaybackStore()
  const { getFile } = useMediaStore()
  const { showMetrics, setMetrics } = useProjectStore()
  const { zoom, resetZoom, getTransformStyle, containerProps } = useSyncedZoom()
  const { pixelInspectorEnabled, handlePixelClick } = usePixelInspector()
  const magnifier = useMagnifier()
  const dropZoneA = useDropZone({ trackType: 'a' })
  const dropZoneB = useDropZone({ trackType: 'b' })

  // Get tracks
  const trackA = tracks.find((t) => t.type === 'a')
  const trackB = tracks.find((t) => t.type === 'b')

  // Get first clip for display (always show something)
  const firstClipA = trackA?.clips[0] || null
  const firstClipB = trackB?.clips[0] || null

  // Find clip that contains current time for proper sync
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

  // Calculate quality metrics (VID-004)
  useEffect(() => {
    if (!showMetrics) return

    const videoA = videoARef.current
    const videoB = videoBRef.current
    if (!videoA || !videoB) return

    const updateMetrics = () => {
      const metrics = calculateVideoMetrics(videoA, videoB)
      if (metrics) {
        setMetrics(metrics.ssim, metrics.psnr)
      }
    }

    // Update metrics periodically
    const interval = setInterval(updateMetrics, 500)
    updateMetrics()

    return () => clearInterval(interval)
  }, [showMetrics, setMetrics])

  const transformStyle = getTransformStyle()

  // Refs for magnifier
  const sourceARef = mediaA?.type === 'video' ? videoARef : imgARef
  const sourceBRef = mediaB?.type === 'video' ? videoBRef : imgBRef

  return (
    <div ref={containerRef} className="w-full h-full flex bg-black relative" {...containerProps}>
      {/* Hidden file inputs for click-to-upload */}
      <input
        ref={dropZoneA.fileInputRef}
        type="file"
        accept={SUPPORTED_MEDIA_ACCEPT}
        className="hidden"
        onChange={dropZoneA.handleFileInputChange}
      />
      <input
        ref={dropZoneB.fileInputRef}
        type="file"
        accept={SUPPORTED_MEDIA_ACCEPT}
        className="hidden"
        onChange={dropZoneB.handleFileInputChange}
      />

      {/* Quality Metrics Overlay */}
      <MetricsOverlay />

      {/* Pixel Inspector */}
      <PixelInspector />

      {/* Magnifier Loupe */}
      <MagnifierLoupe
        sourceARef={sourceARef}
        sourceBRef={sourceBRef}
        containerRef={containerRef}
        isEnabled={magnifier.isEnabled}
        onToggle={magnifier.toggle}
      />

      {/* Zoom indicator */}
      {zoom > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 ui-radius-md bg-black/70 backdrop-blur-sm px-3 py-1 flex items-center gap-2">
          <span className="text-xs text-foreground font-medium">{Math.round(zoom * 100)}%</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              resetZoom()
            }}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        </div>
      )}

      {/* Video A */}
      <div
        className={cn(
          'flex-1 relative border-r border-border overflow-hidden transition-all duration-200',
          dropZoneA.isDragOver && 'ring-2 ring-inset ring-compare-a bg-compare-a/10',
        )}
        {...dropZoneA.dropZoneProps}
      >
        <div className="w-full h-full" style={transformStyle}>
          {mediaA ? (
            mediaA.type === 'video' ? (
              <VideoSurface
                ref={videoARef}
                media={mediaA}
                clip={activeClipA || firstClipA}
                className="w-full h-full object-contain"
                dataTrack="a"
                style={pixelInspectorEnabled ? { cursor: 'crosshair' } : undefined}
                onClick={(e) => handlePixelClick(e, videoARef.current, 'a')}
              />
            ) : (
              <img
                ref={imgARef}
                src={mediaA.url}
                className="w-full h-full object-contain"
                alt="A"
                data-track="a"
                draggable={false}
                style={pixelInspectorEnabled ? { cursor: 'crosshair' } : undefined}
                onClick={(e) => handlePixelClick(e, imgARef.current, 'a')}
              />
            )
          ) : (
            <div
              className={cn(
                'w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-surface gap-3 transition-colors',
                dropZoneA.isDragOver && 'bg-compare-a/20 text-compare-a',
              )}
            >
              <button
                onClick={() => dropZoneA.openFileDialog()}
                className="surface-control surface-control-elevation ui-radius-lg border-2 border-dashed border-current p-4 transition-colors hover:bg-compare-a/10"
              >
                <Upload className={cn('w-8 h-8', dropZoneA.isDragOver && 'animate-bounce')} />
              </button>
              <span className="text-sm">Click or drop Media A</span>
            </div>
          )}
        </div>
        {/* A badge - always visible when media loaded */}
        {mediaA && (
          <div className="absolute bottom-3 left-3 z-20 ui-radius-sm px-2 py-0.5 bg-compare-a/80 text-compare-a-foreground text-xs font-semibold">
            A
          </div>
        )}
        {/* Upload button when has media */}
        {mediaA && !dropZoneA.isDragOver && (
          <button
            onClick={() => dropZoneA.openFileDialog()}
            className="surface-control ui-radius-lg absolute top-2 left-2 z-20 border p-2 text-compare-a-foreground transition-colors group hover:bg-compare-a/80"
            title="Replace Media A"
          >
            <Upload className="w-4 h-4 text-compare-a-foreground group-hover:scale-110 transition-transform" />
          </button>
        )}
        {/* Drop overlay when has media */}
        {mediaA && dropZoneA.isDragOver && (
          <div className="absolute inset-0 bg-compare-a/20 flex items-center justify-center z-10 pointer-events-none">
            <div className="bg-black/80 px-4 py-2 rounded-lg flex items-center gap-2">
              <Upload className="w-5 h-5 text-compare-a" />
              <span className="text-compare-a font-medium">Replace Media A</span>
            </div>
          </div>
        )}
      </div>

      {/* Video B */}
      <div
        className={cn(
          'flex-1 relative overflow-hidden transition-all duration-200',
          dropZoneB.isDragOver && 'ring-2 ring-inset ring-compare-b bg-compare-b/10',
        )}
        {...dropZoneB.dropZoneProps}
      >
        <div className="w-full h-full" style={transformStyle}>
          {mediaB ? (
            mediaB.type === 'video' ? (
              <VideoSurface
                ref={videoBRef}
                media={mediaB}
                clip={activeClipB || firstClipB}
                className="w-full h-full object-contain"
                dataTrack="b"
                style={pixelInspectorEnabled ? { cursor: 'crosshair' } : undefined}
                onClick={(e) => handlePixelClick(e, videoBRef.current, 'b')}
              />
            ) : (
              <img
                ref={imgBRef}
                src={mediaB.url}
                className="w-full h-full object-contain"
                alt="B"
                data-track="b"
                draggable={false}
                style={pixelInspectorEnabled ? { cursor: 'crosshair' } : undefined}
                onClick={(e) => handlePixelClick(e, imgBRef.current, 'b')}
              />
            )
          ) : (
            <div
              className={cn(
                'w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-surface gap-3 transition-colors',
                dropZoneB.isDragOver && 'bg-compare-b/20 text-compare-b',
              )}
            >
              <button
                onClick={() => dropZoneB.openFileDialog()}
                className="surface-control surface-control-elevation ui-radius-lg border-2 border-dashed border-current p-4 transition-colors hover:bg-compare-b/10"
              >
                <Upload className={cn('w-8 h-8', dropZoneB.isDragOver && 'animate-bounce')} />
              </button>
              <span className="text-sm">Click or drop Media B</span>
            </div>
          )}
        </div>
        {/* B badge - always visible when media loaded */}
        {mediaB && (
          <div className="absolute bottom-3 right-3 z-20 ui-radius-sm px-2 py-0.5 bg-compare-b/80 text-compare-b-foreground text-xs font-semibold">
            B
          </div>
        )}
        {/* Upload button when has media */}
        {mediaB && !dropZoneB.isDragOver && (
          <button
            onClick={() => dropZoneB.openFileDialog()}
            className="surface-control ui-radius-lg absolute top-2 right-2 z-20 border p-2 text-compare-b-foreground transition-colors group hover:bg-compare-b/80"
            title="Replace Media B"
          >
            <Upload className="w-4 h-4 text-compare-b-foreground group-hover:scale-110 transition-transform" />
          </button>
        )}
        {/* Drop overlay when has media */}
        {mediaB && dropZoneB.isDragOver && (
          <div className="absolute inset-0 bg-compare-b/20 flex items-center justify-center z-10 pointer-events-none">
            <div className="bg-black/80 px-4 py-2 rounded-lg flex items-center gap-2">
              <Upload className="w-5 h-5 text-compare-b" />
              <span className="text-compare-b font-medium">Replace Media B</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
