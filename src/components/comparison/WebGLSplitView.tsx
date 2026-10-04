/**
 * WEBGL-011: Split View Component
 * Three-panel layout: Source A | Analysis | Source B
 * With synchronized zoom/pan and adjustable panel widths
 */

import { GripVertical, Maximize2, Minimize2 } from 'lucide-react'
import { useEffect, useRef, useState, useCallback } from 'react'

import { resolveVisualTrackSource } from '../../lib/media/comparisonSource'
import {
  getVisualFrameDimensions,
  isPausedVisualFrameReady,
  isVisualFrameReady,
  type VisualFrameElement,
} from '../../lib/media/frameSource'
import { getComparisonModeInfo } from '../../lib/webgl/comparison-shaders'
import { WebGLComparisonRenderer } from '../../lib/webgl/WebGLComparisonRenderer'
import { useMediaStore } from '../../stores/mediaStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useProjectStore } from '../../stores/projectStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { VisualSurface } from '../media/VisualSurface'

interface WebGLSplitViewProps {
  isVisible: boolean
  onToggle: () => void
}

export function WebGLSplitView({ isVisible, onToggle }: WebGLSplitViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLComparisonRenderer | null>(null)
  const sourceARef = useRef<VisualFrameElement>(null)
  const sourceBRef = useRef<VisualFrameElement>(null)

  const [leftWidth, setLeftWidth] = useState(30) // % for source A
  const [rightWidth, setRightWidth] = useState(30) // % for source B
  const [isDraggingLeft, setIsDraggingLeft] = useState(false)
  const [isDraggingRight, setIsDraggingRight] = useState(false)
  const [frameRevision, setFrameRevision] = useState(0)

  const { webglComparisonSettings } = useProjectStore()
  const { getFile } = useMediaStore()
  const { tracks } = useTimelineStore()
  const { currentTime, isPlaying } = usePlaybackStore()

  const {
    activeClip: activeClipA,
    displayClip: displayClipA,
    media: mediaA,
  } = resolveVisualTrackSource(tracks, 'a', currentTime, getFile)
  const {
    activeClip: activeClipB,
    displayClip: displayClipB,
    media: mediaB,
  } = resolveVisualTrackSource(tracks, 'b', currentTime, getFile)

  const handleFrameReady = useCallback(() => {
    setFrameRevision((revision) => revision + 1)
  }, [])

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current || !isVisible) return

    if (!WebGLComparisonRenderer.isSupported()) return

    const renderer = new WebGLComparisonRenderer(canvasRef.current)
    rendererRef.current = renderer

    return () => {
      renderer.dispose()
      rendererRef.current = null
    }
  }, [isVisible])

  // Update mode when settings change
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setMode(webglComparisonSettings.mode)
    }
  }, [webglComparisonSettings.mode, isVisible])

  // 中央の解析には、左右に表示している面そのものを使う。
  const renderFrame = useCallback(() => {
    const renderer = rendererRef.current
    const canvas = canvasRef.current
    if (!isVisible || !renderer || !canvas) return
    const sourceA = sourceARef.current
    const sourceB = sourceBRef.current
    const playback = usePlaybackStore.getState()
    canvas.dataset.frameReady = 'false'
    if (
      !mediaA ||
      !mediaB ||
      !activeClipA ||
      !activeClipB ||
      !sourceA ||
      !sourceB ||
      (playback.isPlaying
        ? !isVisualFrameReady(sourceA) || !isVisualFrameReady(sourceB)
        : !isPausedVisualFrameReady(sourceA, activeClipA, playback.currentTime) ||
          !isPausedVisualFrameReady(sourceB, activeClipB, playback.currentTime))
    ) {
      // 空白区間とシーク待ちで、以前の解析結果を表示し続けない。
      renderer.clear()
      return
    }
    renderer.updateTexture('A', sourceA)
    renderer.updateTexture('B', sourceB)
    const dimensionsA = getVisualFrameDimensions(sourceA)
    const dimensionsB = getVisualFrameDimensions(sourceB)
    renderer.render({
      amplification: webglComparisonSettings.amplification,
      threshold: webglComparisonSettings.threshold,
      opacity: webglComparisonSettings.opacity,
      blockSize: webglComparisonSettings.blockSize,
      loupeSize: webglComparisonSettings.loupeSize,
      loupeZoom: webglComparisonSettings.loupeZoom,
      checkerSize: webglComparisonSettings.checkerSize,
      mouseX: 0.5,
      mouseY: 0.5,
      textureAWidth: dimensionsA.width,
      textureAHeight: dimensionsA.height,
      textureBWidth: dimensionsB.width,
      textureBHeight: dimensionsB.height,
    })
    canvas.dataset.frameReady = 'true'
  }, [activeClipA, activeClipB, mediaA, mediaB, webglComparisonSettings, isVisible])

  // 静止画でも動くことが仕様のモードだけは、停止中も描画を続ける。
  const animatedMode = ['video-flicker', 'exposure-zebra', 'exposure-zebra-compare'].includes(
    webglComparisonSettings.mode,
  )
  useEffect(() => {
    if (!isVisible) return
    let animation: number | undefined
    const tick = () => {
      renderFrame()
      if (isPlaying || animatedMode) animation = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      if (animation !== undefined) cancelAnimationFrame(animation)
    }
  }, [renderFrame, frameRevision, isPlaying, animatedMode, isVisible])

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!isVisible || !canvas || !parent) return
    const resizeCanvas = () => {
      const rect = parent.getBoundingClientRect()
      rendererRef.current?.resize(rect.width, rect.height)
      renderFrame()
    }
    resizeCanvas()
    const observer = new ResizeObserver(resizeCanvas)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [isVisible, renderFrame])

  // Handle divider drag
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100

      if (isDraggingLeft) {
        const newLeft = Math.max(15, Math.min(45, x))
        setLeftWidth(newLeft)
      }
      if (isDraggingRight) {
        const newRight = Math.max(15, Math.min(45, 100 - x))
        setRightWidth(newRight)
      }
    },
    [isDraggingLeft, isDraggingRight],
  )

  const handleMouseUp = useCallback(() => {
    setIsDraggingLeft(false)
    setIsDraggingRight(false)
  }, [])

  useEffect(() => {
    if (isDraggingLeft || isDraggingRight) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDraggingLeft, isDraggingRight, handleMouseMove, handleMouseUp])

  const modeInfo = getComparisonModeInfo(webglComparisonSettings.mode)
  const centerWidth = 100 - leftWidth - rightWidth

  if (!isVisible) return null

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex bg-black z-40"
      data-testid="webgl-split-view"
    >
      {/* Source A Panel */}
      <div
        className="relative bg-black flex items-center justify-center overflow-hidden"
        style={{ width: `${leftWidth}%` }}
      >
        {mediaA && (
          <VisualSurface
            key={mediaA.id}
            ref={sourceARef}
            media={mediaA}
            clip={displayClipA}
            dataTrack="a"
            onFrameReady={handleFrameReady}
            className="max-w-full max-h-full object-contain"
            style={{
              transform: `scale(${webglComparisonSettings.webglZoom}) translate(${(webglComparisonSettings.webglPanX * 50) / webglComparisonSettings.webglZoom}%, ${(-webglComparisonSettings.webglPanY * 50) / webglComparisonSettings.webglZoom}%)`,
            }}
            alt="Source A"
          />
        )}
        <div className="surface-control-elevation ui-radius-sm absolute top-2 left-2 border border-border/40 bg-surface-alt/85 px-2 py-1 text-xs text-compare-a backdrop-blur-sm">
          Source A
        </div>
      </div>

      {/* Left Divider */}
      <div
        className="group flex w-1 cursor-col-resize items-center justify-center bg-border hover:bg-primary"
        onMouseDown={() => setIsDraggingLeft(true)}
      >
        <GripVertical size={12} className="text-muted-foreground group-hover:text-foreground" />
      </div>

      {/* Analysis Center Panel */}
      <div
        className="relative bg-black flex items-center justify-center overflow-hidden"
        style={{ width: `${centerWidth}%` }}
      >
        <canvas
          ref={canvasRef}
          data-frame-ready="false"
          data-testid="split-analysis"
          className="w-full h-full"
          style={{
            transform: `scale(${webglComparisonSettings.webglZoom}) translate(${(webglComparisonSettings.webglPanX * 50) / webglComparisonSettings.webglZoom}%, ${(-webglComparisonSettings.webglPanY * 50) / webglComparisonSettings.webglZoom}%)`,
          }}
        />
        <div className="surface-control-elevation ui-radius-sm absolute top-2 left-2 border border-border/40 bg-surface-alt/85 px-2 py-1 text-xs backdrop-blur-sm">
          <span className="text-muted-foreground">Analysis: </span>
          <span className="text-primary">{modeInfo?.label || webglComparisonSettings.mode}</span>
        </div>
      </div>

      {/* Right Divider */}
      <div
        className="group flex w-1 cursor-col-resize items-center justify-center bg-border hover:bg-primary"
        onMouseDown={() => setIsDraggingRight(true)}
      >
        <GripVertical size={12} className="text-muted-foreground group-hover:text-foreground" />
      </div>

      {/* Source B Panel */}
      <div
        className="relative bg-black flex items-center justify-center overflow-hidden"
        style={{ width: `${rightWidth}%` }}
      >
        {mediaB && (
          <VisualSurface
            key={mediaB.id}
            ref={sourceBRef}
            media={mediaB}
            clip={displayClipB}
            dataTrack="b"
            onFrameReady={handleFrameReady}
            className="max-w-full max-h-full object-contain"
            style={{
              transform: `scale(${webglComparisonSettings.webglZoom}) translate(${(webglComparisonSettings.webglPanX * 50) / webglComparisonSettings.webglZoom}%, ${(-webglComparisonSettings.webglPanY * 50) / webglComparisonSettings.webglZoom}%)`,
            }}
            alt="Source B"
          />
        )}
        <div className="surface-control-elevation ui-radius-sm absolute top-2 right-2 border border-border/40 bg-surface-alt/85 px-2 py-1 text-xs text-compare-b backdrop-blur-sm">
          Source B
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={onToggle}
        className="surface-control-elevation surface-control ui-radius-md absolute top-2 right-2 z-10 border p-2 text-text-secondary transition-colors hover:text-text-primary"
        title="Exit Split View"
      >
        <Minimize2 size={16} />
      </button>
    </div>
  )
}

// Toggle button component
export function SplitViewToggle({ onClick, isActive }: { onClick: () => void; isActive: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`surface-control-elevation ui-radius-md border p-2 transition-colors ${isActive ? 'border-accent bg-accent text-primary-foreground' : 'surface-control text-text-secondary hover:text-text-primary'}`}
      title="Split View: A | Analysis | B (WEBGL-011)"
    >
      <Maximize2 size={16} />
    </button>
  )
}
