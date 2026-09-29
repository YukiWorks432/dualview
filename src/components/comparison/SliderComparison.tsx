import { Upload } from 'lucide-react'
import { useRef, useState, useCallback, useEffect, useMemo } from 'react'

import { useDropZone } from '../../hooks/useDropZone'
import { useSyncedZoom } from '../../hooks/useSyncedZoom'
import { SUPPORTED_MEDIA_ACCEPT } from '../../lib/media/fileTypes'
import type { VideoFrameElement } from '../../lib/media/frameSource'
import { cn } from '../../lib/utils'
import { useMediaStore } from '../../stores/mediaStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useProjectStore } from '../../stores/projectStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { VideoSurface } from '../media/VideoSurface'

interface VideoBounds {
  left: number
  top: number
  width: number
  height: number
}

/**
 * SliderComparison - Performant video comparison slider
 *
 * Uses overflow:hidden technique instead of clipPath for better performance.
 * Based on: https://gist.github.com/CodeMyUI/34f82e50cde3c10fbf09e37a6fbf2fa5
 */
export function SliderComparison() {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoARef = useRef<VideoFrameElement>(null)
  const videoBRef = useRef<VideoFrameElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [videoBounds, setVideoBounds] = useState<VideoBounds | null>(null)

  const { sliderPosition, setSliderPosition, sliderOrientation, hideSlider, toggleHideSlider } =
    useProjectStore()
  const { tracks } = useTimelineStore()
  const { currentTime } = usePlaybackStore()
  const { getFile } = useMediaStore()
  const { zoom, resetZoom, getTransformStyle, containerProps } = useSyncedZoom()
  const {
    isDragOver: isDragOverA,
    fileInputRef: fileInputRefA,
    openFileDialog: openFileDialogA,
    handleFileInputChange: handleFileInputChangeA,
    dropZoneProps: dropZonePropsA,
  } = useDropZone({ trackType: 'a' })
  const {
    isDragOver: isDragOverB,
    fileInputRef: fileInputRefB,
    openFileDialog: openFileDialogB,
    handleFileInputChange: handleFileInputChangeB,
    dropZoneProps: dropZonePropsB,
  } = useDropZone({ trackType: 'b' })

  const imgARef = useRef<HTMLImageElement>(null)
  const imgBRef = useRef<HTMLImageElement>(null)

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
  const mediaAWidth = mediaA?.width
  const mediaAHeight = mediaA?.height
  const mediaBWidth = mediaB?.width
  const mediaBHeight = mediaB?.height

  // Calculate video bounds within container (accounting for object-contain)
  const calculateVideoBounds = useCallback(() => {
    const container = containerRef.current

    if (!container) return

    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    // Get video dimensions - prefer actual video element dimensions, then media metadata
    // Use whichever video/media is available (A takes priority)
    let videoWidth = 0
    let videoHeight = 0

    // Import probing provides display dimensions for both native video and ProRes.
    if (mediaAWidth && mediaAHeight) {
      videoWidth = mediaAWidth
      videoHeight = mediaAHeight
    } else if (mediaBWidth && mediaBHeight) {
      videoWidth = mediaBWidth
      videoHeight = mediaBHeight
    }

    // If still no dimensions, use container aspect (neutral fallback)
    if (videoWidth === 0 || videoHeight === 0) {
      videoWidth = containerWidth
      videoHeight = containerHeight
    }

    const containerAspect = containerWidth / containerHeight
    const videoAspect = videoWidth / videoHeight

    let renderedWidth: number
    let renderedHeight: number

    if (videoAspect > containerAspect) {
      // Video is wider - letterbox top/bottom
      renderedWidth = containerWidth
      renderedHeight = containerWidth / videoAspect
    } else {
      // Video is taller - letterbox left/right
      renderedHeight = containerHeight
      renderedWidth = containerHeight * videoAspect
    }

    const left = (containerWidth - renderedWidth) / 2
    const top = (containerHeight - renderedHeight) / 2

    setVideoBounds({ left, top, width: renderedWidth, height: renderedHeight })
  }, [mediaAWidth, mediaAHeight, mediaBWidth, mediaBHeight])

  // Recalculate bounds on resize and when video loads
  useEffect(() => {
    calculateVideoBounds()

    // Use ResizeObserver for container size changes (timeline/sidebar toggle)
    const container = containerRef.current
    if (container) {
      const resizeObserver = new ResizeObserver(() => {
        calculateVideoBounds()
      })
      resizeObserver.observe(container)
      return () => resizeObserver.disconnect()
    }
  }, [calculateVideoBounds])

  // Handle touch events for mobile support
  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!containerRef.current || !videoBounds) return
      e.preventDefault()

      const touch = e.touches[0]
      const rect = containerRef.current.getBoundingClientRect()
      let position: number

      if (sliderOrientation === 'vertical') {
        const x = touch.clientX - rect.left
        const relativeX = (x - videoBounds.left) / videoBounds.width
        position = relativeX * 100
      } else {
        const y = touch.clientY - rect.top
        const relativeY = (y - videoBounds.top) / videoBounds.height
        position = relativeY * 100
      }

      setSliderPosition(Math.max(0, Math.min(100, position)))
    },
    [sliderOrientation, setSliderPosition, videoBounds],
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!containerRef.current || !videoBounds) return

      const rect = containerRef.current.getBoundingClientRect()
      let position: number

      if (sliderOrientation === 'vertical') {
        // Constrain to video bounds horizontally
        const x = e.clientX - rect.left
        const relativeX = (x - videoBounds.left) / videoBounds.width
        position = relativeX * 100
      } else {
        // Constrain to video bounds vertically
        const y = e.clientY - rect.top
        const relativeY = (y - videoBounds.top) / videoBounds.height
        position = relativeY * 100
      }

      setSliderPosition(Math.max(0, Math.min(100, position)))
    },
    [sliderOrientation, setSliderPosition, videoBounds],
  )

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false)
    const handleTouchEnd = () => setIsDragging(false)
    const handleMove = (e: MouseEvent) => {
      if (isDragging) handleMouseMove(e)
    }
    const handleTouch = (e: TouchEvent) => {
      if (isDragging) handleTouchMove(e)
    }

    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('touchmove', handleTouch, { passive: false })

    return () => {
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchmove', handleTouch)
    }
  }, [isDragging, handleMouseMove, handleTouchMove])

  const isVertical = sliderOrientation === 'vertical'
  const transformStyle = getTransformStyle()

  // Keyboard shortcut to toggle slider visibility (H key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault()
        toggleHideSlider()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleHideSlider])

  // Calculate clipper dimensions based on slider position
  const clipperStyle = useMemo(() => {
    if (!videoBounds) return {}

    if (isVertical) {
      // Horizontal slider - clip from left
      return {
        position: 'absolute' as const,
        left: videoBounds.left,
        top: videoBounds.top,
        width: (sliderPosition / 100) * videoBounds.width,
        height: videoBounds.height,
        overflow: 'hidden' as const,
      }
    } else {
      // Vertical slider - clip from top
      return {
        position: 'absolute' as const,
        left: videoBounds.left,
        top: videoBounds.top,
        width: videoBounds.width,
        height: (sliderPosition / 100) * videoBounds.height,
        overflow: 'hidden' as const,
      }
    }
  }, [videoBounds, sliderPosition, isVertical])

  // Style for the media inside the clipper - needs to match the background position
  const clippedMediaStyle = useMemo(() => {
    if (!videoBounds) return {}

    return {
      position: 'absolute' as const,
      left: 0,
      top: 0,
      width: videoBounds.width,
      height: videoBounds.height,
    }
  }, [videoBounds])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black overflow-hidden select-none"
      onWheel={containerProps.onWheel}
    >
      {/* Zoom indicator (IMG-002) */}
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

      {/* Video B (background layer) - full size */}
      {/* Show mediaB, or mediaA with low opacity if only A is uploaded */}
      {videoBounds && (
        <div
          className="absolute"
          style={{
            ...transformStyle,
            left: videoBounds.left,
            top: videoBounds.top,
            width: videoBounds.width,
            height: videoBounds.height,
            opacity: mediaB ? 1 : mediaA ? 0.3 : 1,
          }}
        >
          {mediaB || mediaA ? (
            (mediaB || mediaA)!.type === 'video' ? (
              <VideoSurface
                ref={videoBRef}
                media={(mediaB || mediaA)!}
                clip={mediaB ? activeClipB || firstClipB : activeClipA || firstClipA}
                className="w-full h-full object-contain"
                dataTrack="b"
              />
            ) : (
              <img
                ref={imgBRef}
                src={(mediaB || mediaA)!.url}
                className="w-full h-full object-contain"
                alt="B"
                data-track="b"
                draggable={false}
              />
            )
          ) : null}
        </div>
      )}

      {/* Video A (clipped layer) - uses overflow:hidden for performance */}
      {/* Show mediaA, or mediaB with low opacity if only B is uploaded */}
      {videoBounds && (
        <div
          style={{
            ...clipperStyle,
            ...transformStyle,
            opacity: mediaA ? 1 : mediaB ? 0.3 : 1,
          }}
        >
          <div style={clippedMediaStyle}>
            {mediaA || mediaB ? (
              (mediaA || mediaB)!.type === 'video' ? (
                <VideoSurface
                  ref={videoARef}
                  media={(mediaA || mediaB)!}
                  clip={mediaA ? activeClipA || firstClipA : activeClipB || firstClipB}
                  className="w-full h-full object-contain"
                  dataTrack="a"
                />
              ) : (
                <img
                  ref={imgARef}
                  src={(mediaA || mediaB)!.url}
                  className="w-full h-full object-contain"
                  alt="A"
                  data-track="a"
                  draggable={false}
                />
              )
            ) : null}
          </div>
        </div>
      )}

      {/* Hidden file inputs for click-to-upload (supports multiple files) */}
      <input
        ref={fileInputRefA}
        type="file"
        accept={SUPPORTED_MEDIA_ACCEPT}
        multiple
        className="hidden"
        onChange={handleFileInputChangeA}
      />
      <input
        ref={fileInputRefB}
        type="file"
        accept={SUPPORTED_MEDIA_ACCEPT}
        multiple
        className="hidden"
        onChange={handleFileInputChangeB}
      />

      {/* Drop zones - shown when no media or dragging */}
      {(!mediaA || !mediaB || isDragOverA || isDragOverB) && (
        <div className="absolute inset-0 flex z-30 pointer-events-none">
          {/* Drop zone A (left half) - Bold empty state */}
          <div
            className={cn(
              'flex-1 flex flex-col items-center justify-center transition-all duration-300 pointer-events-auto relative overflow-hidden',
              !mediaA && 'bg-surface',
              isDragOverA && 'bg-compare-a/15 ring-2 ring-inset ring-compare-a',
            )}
            {...dropZonePropsA}
          >
            {(!mediaA || isDragOverA) && (
              <div
                className={cn(
                  'flex flex-col items-center gap-4 text-center relative z-10',
                  isDragOverA ? 'text-compare-a scale-105' : 'text-muted-foreground',
                )}
              >
                {/* Large A badge */}
                <div
                  className={cn(
                    'w-16 h-16 ui-radius-lg flex items-center justify-center transition-all duration-300',
                    isDragOverA
                      ? 'bg-compare-a text-compare-a-foreground'
                      : 'bg-compare-a/10 border border-compare-a/20',
                  )}
                >
                  <span
                    className={cn(
                      'text-2xl font-bold',
                      isDragOverA ? 'text-compare-a-foreground' : 'text-compare-a',
                    )}
                  >
                    A
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    openFileDialogA()
                  }}
                  className={cn(
                    'surface-control surface-control-elevation ui-radius-lg border border-dashed p-4 transition-all duration-200 group',
                    isDragOverA
                      ? 'border-compare-a bg-compare-a/10'
                      : 'border-muted-foreground/20 hover:border-compare-a/50',
                  )}
                >
                  <Upload
                    className={cn(
                      'w-8 h-8 transition-transform',
                      isDragOverA ? 'animate-bounce text-compare-a' : 'group-hover:scale-105',
                    )}
                  />
                </button>
                <div className="space-y-1">
                  <span className="text-base font-semibold block">
                    {mediaA ? 'Replace Media A' : 'Drop Media A'}
                  </span>
                  {!mediaA && (
                    <span className="text-sm text-muted-foreground/60 block">
                      Before / Original
                    </span>
                  )}
                  {!mediaA && (
                    <span className="text-xs text-muted-foreground/40 block mt-2">
                      Video, Image, or Audio
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Divider line */}
          {!mediaA && !mediaB && (
            <div className="w-px bg-border/50 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center">
                <span className="text-xs text-muted-foreground">VS</span>
              </div>
            </div>
          )}

          {/* Drop zone B (right half) - Bold empty state */}
          <div
            className={cn(
              'flex-1 flex flex-col items-center justify-center transition-all duration-300 pointer-events-auto relative overflow-hidden',
              !mediaB && 'bg-surface/90',
              isDragOverB && 'bg-compare-b/15 ring-2 ring-inset ring-compare-b',
            )}
            {...dropZonePropsB}
          >
            {(!mediaB || isDragOverB) && (
              <div
                className={cn(
                  'flex flex-col items-center gap-4 text-center relative z-10',
                  isDragOverB ? 'text-compare-b scale-105' : 'text-muted-foreground',
                )}
              >
                {/* Large B badge */}
                <div
                  className={cn(
                    'w-16 h-16 ui-radius-lg flex items-center justify-center transition-all duration-300',
                    isDragOverB
                      ? 'bg-compare-b text-compare-b-foreground'
                      : 'bg-compare-b/10 border border-compare-b/20',
                  )}
                >
                  <span
                    className={cn(
                      'text-2xl font-bold',
                      isDragOverB ? 'text-compare-b-foreground' : 'text-compare-b',
                    )}
                  >
                    B
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    openFileDialogB()
                  }}
                  className={cn(
                    'surface-control surface-control-elevation ui-radius-lg border border-dashed p-4 transition-all duration-200 group',
                    isDragOverB
                      ? 'border-compare-b bg-compare-b/10'
                      : 'border-muted-foreground/20 hover:border-compare-b/50',
                  )}
                >
                  <Upload
                    className={cn(
                      'w-8 h-8 transition-transform',
                      isDragOverB ? 'animate-bounce text-compare-b' : 'group-hover:scale-105',
                    )}
                  />
                </button>
                <div className="space-y-1">
                  <span className="text-base font-semibold block">
                    {mediaB ? 'Replace Media B' : 'Drop Media B'}
                  </span>
                  {!mediaB && (
                    <span className="text-sm text-muted-foreground/60 block">After / Modified</span>
                  )}
                  {!mediaB && (
                    <span className="text-xs text-muted-foreground/40 block mt-2">
                      Video, Image, or Audio
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload buttons when media exists (shown in corners) */}
      {mediaA && mediaB && !isDragOverA && !isDragOverB && (
        <>
          {/* Upload button A (top-left) */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              openFileDialogA()
            }}
            className="surface-control ui-radius-lg absolute top-4 left-4 z-20 border p-2 text-compare-a-foreground transition-colors group hover:bg-compare-a/80"
            title="Replace Media A"
          >
            <Upload className="w-5 h-5 text-compare-a-foreground group-hover:scale-110 transition-transform" />
          </button>

          {/* Upload button B (top-right) */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              openFileDialogB()
            }}
            className="surface-control ui-radius-lg absolute top-4 right-4 z-20 border p-2 text-compare-b-foreground transition-colors group hover:bg-compare-b/80"
            title="Replace Media B"
          >
            <Upload className="w-5 h-5 text-compare-b-foreground group-hover:scale-110 transition-transform" />
          </button>
        </>
      )}

      {/* A/B badges when media is loaded */}
      {mediaA && mediaB && videoBounds && (
        <>
          <div className="absolute bottom-4 left-4 z-20 ui-radius-sm px-2 py-0.5 bg-compare-a/80 text-compare-a-foreground text-xs font-semibold">
            A
          </div>
          <div className="absolute bottom-4 right-4 z-20 ui-radius-sm px-2 py-0.5 bg-compare-b/80 text-compare-b-foreground text-xs font-semibold">
            B
          </div>
        </>
      )}

      {/* Slider handle - constrained to video bounds */}
      {videoBounds && !hideSlider && (
        <div
          className={cn(
            'absolute bg-lime-400 shadow-lg z-10',
            isVertical ? 'w-0.5 cursor-ew-resize' : 'h-0.5 cursor-ns-resize',
          )}
          style={
            isVertical
              ? {
                  left: videoBounds.left + (sliderPosition / 100) * videoBounds.width,
                  top: videoBounds.top,
                  height: videoBounds.height,
                  transform: 'translateX(-50%)',
                }
              : {
                  top: videoBounds.top + (sliderPosition / 100) * videoBounds.height,
                  left: videoBounds.left,
                  width: videoBounds.width,
                  transform: 'translateY(-50%)',
                }
          }
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {/* Handle grip - compact but easy to drag */}
          <div
            className={cn(
              'absolute bg-lime-400 shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing rounded-sm',
              isVertical
                ? 'w-3 h-8 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
                : 'w-8 h-3 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
            )}
          >
            <div className={cn('flex gap-px', isVertical ? 'flex-row' : 'flex-col')}>
              <div className="w-px h-3 bg-black/30" />
              <div className="w-px h-3 bg-black/30" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
