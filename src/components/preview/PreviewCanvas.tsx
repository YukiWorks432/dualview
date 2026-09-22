import { Suspense, forwardRef, lazy, useImperativeHandle, useRef } from 'react'

import { useProjectStore } from '../../stores/projectStore'
import { BlendModes } from '../comparison/BlendModes'
import { FlickerComparison } from '../comparison/FlickerComparison'
import { SideBySide } from '../comparison/SideBySide'
import { SliderComparison } from '../comparison/SliderComparison'
import { SplitScreen } from '../comparison/SplitScreen'

const PromptDiff = lazy(() =>
  import('../comparison/PromptDiff').then((module) => ({ default: module.PromptDiff })),
)
const DifferenceHeatmap = lazy(() =>
  import('../comparison/DifferenceHeatmap').then((module) => ({
    default: module.DifferenceHeatmap,
  })),
)
const JsonDiffView = lazy(() =>
  import('../comparison/JsonDiffView').then((module) => ({ default: module.JsonDiffView })),
)
const AudioComparison = lazy(() =>
  import('../comparison/AudioComparison').then((module) => ({
    default: module.AudioComparison,
  })),
)
const Model3DComparison = lazy(() =>
  import('../comparison/Model3DComparison').then((module) => ({
    default: module.Model3DComparison,
  })),
)
const WebGLComparison = lazy(() =>
  import('../comparison/WebGLComparison').then((module) => ({
    default: module.WebGLComparison,
  })),
)
const QuadComparison = lazy(() =>
  import('../comparison/QuadComparison').then((module) => ({
    default: module.QuadComparison,
  })),
)
const RadialLoupeComparison = lazy(() =>
  import('../comparison/RadialLoupeComparison').then((module) => ({
    default: module.RadialLoupeComparison,
  })),
)
const GridTileComparison = lazy(() =>
  import('../comparison/GridTileComparison').then((module) => ({
    default: module.GridTileComparison,
  })),
)
const MorphologicalView = lazy(() =>
  import('../comparison/MorphologicalView').then((module) => ({
    default: module.MorphologicalView,
  })),
)
const DocumentComparison = lazy(() =>
  import('../comparison/DocumentComparison').then((module) => ({
    default: module.DocumentComparison,
  })),
)

export interface PreviewCanvasHandle {
  captureFrame: () => HTMLCanvasElement | null
}

interface PreviewCanvasProps {
  canvasRef?: React.RefObject<HTMLCanvasElement | null>
  isTimelineVisible?: boolean
}

function ComparisonLoadingFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-surface text-text-muted text-sm">
      Loading comparison mode…
    </div>
  )
}

export const PreviewCanvas = forwardRef<PreviewCanvasHandle, PreviewCanvasProps>(
  function PreviewCanvas({ canvasRef, isTimelineVisible = true }, ref) {
    const { comparisonMode } = useProjectStore()
    const containerRef = useRef<HTMLDivElement>(null)
    const exportCanvasRef = useRef<HTMLCanvasElement>(null)

    // Expose captureFrame method to parent
    useImperativeHandle(ref, () => ({
      captureFrame: () => {
        const container = containerRef.current
        const canvas = exportCanvasRef.current
        if (!container || !canvas) return null

        const ctx = canvas.getContext('2d')
        if (!ctx) return null

        const rect = container.getBoundingClientRect()

        // Set canvas size to match container
        canvas.width = 1920
        canvas.height = 1080

        // Calculate scale to fit container content to 1920x1080
        const scaleX = 1920 / rect.width
        const scaleY = 1080 / rect.height

        // Fill background
        ctx.fillStyle = '#0d0d0d'
        ctx.fillRect(0, 0, 1920, 1080)

        // Find all video, image, and canvas elements
        const videos = container.querySelectorAll('video')
        const images = container.querySelectorAll('img')
        const canvases = container.querySelectorAll('canvas')

        const drawMedia = (media: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) => {
          const mediaRect = media.getBoundingClientRect()
          const x = (mediaRect.left - rect.left) * scaleX
          const y = (mediaRect.top - rect.top) * scaleY
          const width = mediaRect.width * scaleX
          const height = mediaRect.height * scaleY

          try {
            ctx.drawImage(media, x, y, width, height)
          } catch (e) {
            console.warn('Failed to draw media element:', e)
          }
        }

        // Draw in order: videos first, then images, then canvases
        videos.forEach((video) => {
          if (!video.classList.contains('hidden')) drawMedia(video)
        })
        images.forEach((image) => drawMedia(image))
        canvases.forEach((childCanvas) => {
          if (childCanvas !== canvas) drawMedia(childCanvas)
        })

        return canvas
      },
    }))

    return (
      <div className="flex-1 bg-black flex items-center justify-center overflow-hidden relative">
        <div
          ref={containerRef}
          className={`w-full h-full max-w-[1920px] relative ${
            isTimelineVisible && comparisonMode !== 'document' ? 'max-h-[1080px] aspect-video' : ''
          }`}
        >
          <Suspense fallback={<ComparisonLoadingFallback />}>
            {comparisonMode === 'slider' && <SliderComparison />}
            {comparisonMode === 'side-by-side' && <SideBySide />}
            {comparisonMode === 'blend' && <BlendModes />}
            {comparisonMode === 'split' && <SplitScreen />}
            {comparisonMode === 'flicker' && <FlickerComparison />}
            {comparisonMode === 'prompt-diff' && <PromptDiff />}
            {comparisonMode === 'json-diff' && <JsonDiffView />}
            {comparisonMode === 'heatmap' && <DifferenceHeatmap />}
            {comparisonMode === 'audio' && <AudioComparison />}
            {comparisonMode === 'model-3d' && <Model3DComparison />}
            {comparisonMode === 'webgl-compare' && <WebGLComparison />}
            {comparisonMode === 'quad' && <QuadComparison />}
            {comparisonMode === 'radial-loupe' && <RadialLoupeComparison />}
            {comparisonMode === 'grid-tile' && <GridTileComparison />}
            {comparisonMode === 'morphological' && <MorphologicalView />}
            {comparisonMode === 'document' && <DocumentComparison />}
          </Suspense>
        </div>

        <canvas ref={exportCanvasRef} className="hidden" width={1920} height={1080} />
        {canvasRef && <canvas ref={canvasRef} className="hidden" width={1920} height={1080} />}
      </div>
    )
  },
)
