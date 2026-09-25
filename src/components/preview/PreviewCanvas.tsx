import { Suspense, forwardRef, lazy, useImperativeHandle, useRef } from 'react'

import { captureVisualContainer } from '../../lib/media/capture'
import { useProjectStore } from '../../stores/projectStore'
import { BlendModes } from '../comparison/BlendModes'
import { FlickerComparison } from '../comparison/FlickerComparison'
import { SideBySide } from '../comparison/SideBySide'
import { SliderComparison } from '../comparison/SliderComparison'
import { SplitScreen } from '../comparison/SplitScreen'

const DifferenceHeatmap = lazy(() =>
  import('../comparison/DifferenceHeatmap').then((module) => ({
    default: module.DifferenceHeatmap,
  })),
)
const AudioComparison = lazy(() =>
  import('../comparison/AudioComparison').then((module) => ({
    default: module.AudioComparison,
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

export interface CaptureFrameOptions {
  width?: number
  height?: number
}

export interface PreviewCanvasHandle {
  captureFrame: (options?: CaptureFrameOptions) => HTMLCanvasElement | null
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
      captureFrame: (options) => {
        const container = containerRef.current
        const canvas = exportCanvasRef.current
        if (!container || !canvas) return null

        canvas.width = options?.width ?? 1920
        canvas.height = options?.height ?? 1080
        return captureVisualContainer(container, canvas)
      },
    }))

    return (
      <div className="flex-1 bg-black flex items-center justify-center overflow-hidden relative">
        <div
          ref={containerRef}
          className={`w-full h-full max-w-[1920px] relative ${
            isTimelineVisible ? 'max-h-[1080px] aspect-video' : ''
          }`}
        >
          <Suspense fallback={<ComparisonLoadingFallback />}>
            {comparisonMode === 'slider' && <SliderComparison />}
            {comparisonMode === 'side-by-side' && <SideBySide />}
            {comparisonMode === 'blend' && <BlendModes />}
            {comparisonMode === 'split' && <SplitScreen />}
            {comparisonMode === 'flicker' && <FlickerComparison />}
            {comparisonMode === 'heatmap' && <DifferenceHeatmap />}
            {comparisonMode === 'audio' && <AudioComparison />}
            {comparisonMode === 'webgl-compare' && <WebGLComparison />}
            {comparisonMode === 'quad' && <QuadComparison />}
            {comparisonMode === 'radial-loupe' && <RadialLoupeComparison />}
            {comparisonMode === 'grid-tile' && <GridTileComparison />}
            {comparisonMode === 'morphological' && <MorphologicalView />}
          </Suspense>
        </div>

        <canvas ref={exportCanvasRef} className="hidden" width={1920} height={1080} />
        {canvasRef && <canvas ref={canvasRef} className="hidden" width={1920} height={1080} />}
      </div>
    )
  },
)
