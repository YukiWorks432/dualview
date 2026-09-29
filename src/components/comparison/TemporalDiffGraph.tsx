import { Pause, Play } from 'lucide-react'
import type { RefObject } from 'react'

import type { VideoFrameElement } from '../../lib/media/frameSource'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { DifferenceControls } from '../timeline/DifferenceControls'
import { DifferencePlot } from '../timeline/DifferencePlot'
import { Button, ElevatedSurface } from '../ui'

interface TemporalDiffGraphProps {
  videoARef: RefObject<VideoFrameElement | null>
  videoBRef: RefObject<VideoFrameElement | null>
  isVisible: boolean
}
/** Displays the same analysis as the timeline; never seeks preview surfaces to measure them. */
export function TemporalDiffGraph({ isVisible }: TemporalDiffGraphProps) {
  const duration = useTimelineStore((state) => state.duration)
  const currentTime = usePlaybackStore((state) => state.currentTime)
  const isPlaying = usePlaybackStore((state) => state.isPlaying)
  if (!isVisible) return null
  return (
    <ElevatedSurface offset={1} shadowLevel={null} className="border-t border-border">
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-sm text-text-secondary">Temporal Difference Analysis</span>
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          onClick={() => usePlaybackStore.getState().togglePlay()}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </Button>
      </div>
      <DifferenceControls />
      <div className="relative">
        <DifferencePlot duration={duration} graph />
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-accent"
          style={{ left: `${Math.min(100, (currentTime / Math.max(duration, 0.001)) * 100)}%` }}
        />
      </div>
      <div className="flex justify-between px-2 text-[10px] text-text-muted">
        <span>0s · changed area 0–100%</span>
        <span>{duration.toFixed(3)}s</span>
      </div>
      <p className="px-2 pb-1 text-[10px] text-text-muted">
        Amber: difference · red: unavailable · stripes: not analyzed · dashed line: area threshold
      </p>
    </ElevatedSurface>
  )
}
