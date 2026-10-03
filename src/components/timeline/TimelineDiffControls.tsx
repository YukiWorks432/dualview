import { ArrowLeft, ArrowRight, Loader2, Play, Square } from 'lucide-react'
import { useMemo } from 'react'

import { cancelTimelineDiffAnalysis, startTimelineDiffAnalysis } from '../../hooks/useTimelineDiff'
import { findNextTimelineDiffSegment } from '../../lib/media/timelineDiff'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useTimelineDiffStore } from '../../stores/timelineDiffStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { Slider } from '../ui'
import { Select } from '../ui/select'

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

export function TimelineDiffControls() {
  const tracks = useTimelineStore((state) => state.tracks)
  const currentTime = usePlaybackStore((state) => state.currentTime)
  const seek = usePlaybackStore((state) => state.seek)
  const colorThreshold = useTimelineDiffStore((state) => state.colorThreshold)
  const areaThreshold = useTimelineDiffStore((state) => state.areaThreshold)
  const resolution = useTimelineDiffStore((state) => state.resolution)
  const setColorThreshold = useTimelineDiffStore((state) => state.setColorThreshold)
  const setAreaThreshold = useTimelineDiffStore((state) => state.setAreaThreshold)
  const setResolution = useTimelineDiffStore((state) => state.setResolution)
  const status = useTimelineDiffStore((state) => state.status)
  const message = useTimelineDiffStore((state) => state.message)
  const progress = useTimelineDiffStore((state) => state.progress)
  const segments = useTimelineDiffStore((state) => state.segments)
  const canAnalyze =
    (tracks.find((track) => track.type === 'a')?.clips.length ?? 0) > 0 &&
    (tracks.find((track) => track.type === 'b')?.clips.length ?? 0) > 0
  const isRunning = status === 'analyzing' || status === 'cancelling'
  const nextSegment = useMemo(
    () => findNextTimelineDiffSegment(segments, currentTime, 'next'),
    [segments, currentTime],
  )
  const previousSegment = useMemo(
    () => findNextTimelineDiffSegment(segments, currentTime, 'previous'),
    [segments, currentTime],
  )

  return (
    <div
      data-marquee-ignore
      className="h-9 shrink-0 px-2 flex items-center gap-2 overflow-x-auto border-b border-border bg-surface text-[10px] whitespace-nowrap"
    >
      <span className="font-medium text-text-secondary">A/B difference</span>
      <span className="text-text-muted" title={message ?? undefined}>
        {statusLabel(status)}
        {status === 'analyzing' ? ` ${progress.toFixed(0)}%` : ''}
      </span>
      {status === 'analyzing' && <Loader2 className="h-3 w-3 animate-spin text-accent" />}
      {isRunning ? (
        <button
          onClick={cancelTimelineDiffAnalysis}
          disabled={status === 'cancelling'}
          className="surface-control ui-radius-sm inline-flex h-6 items-center gap-1 border px-2 text-text-secondary disabled:opacity-50"
          title="Cancel A/B analysis"
        >
          <Square className="h-3 w-3" /> Cancel
        </button>
      ) : (
        <button
          onClick={startTimelineDiffAnalysis}
          disabled={!canAnalyze}
          className="surface-control-elevation ui-radius-sm inline-flex h-6 items-center gap-1 border border-accent/50 px-2 text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          title={
            canAnalyze
              ? 'Analyze all displayed A/B frame intervals'
              : 'Add a clip to both A and B tracks'
          }
        >
          <Play className="h-3 w-3" /> Analyze
        </button>
      )}
      <label
        className="flex items-center gap-1 text-text-muted"
        title="Pixelmatch color threshold from 0 to 1"
      >
        Pixel{' '}
        <Slider
          aria-label="Pixel difference threshold"
          min={0}
          max={1}
          step={0.01}
          value={colorThreshold}
          onChange={(event) => setColorThreshold(Number(event.target.value))}
          className="w-14 shrink-0"
        />
        <span className="w-7 text-text-secondary">{colorThreshold.toFixed(2)}</span>
      </label>
      <label
        className="flex items-center gap-1 text-text-muted"
        title="Minimum differing pixel area to highlight"
      >
        Area{' '}
        <Slider
          aria-label="Highlight area threshold"
          min={0}
          max={0.25}
          step={0.005}
          value={areaThreshold}
          onChange={(event) => setAreaThreshold(Number(event.target.value))}
          className="w-14 shrink-0"
        />
        <span className="w-8 text-text-secondary">{(areaThreshold * 100).toFixed(1)}%</span>
      </label>
      <label className="flex items-center gap-1 text-text-muted">
        Resolution
        <Select
          aria-label="Analysis resolution"
          value={resolution}
          onValueChange={(value) => setResolution(value as 'standard' | 'detailed')}
          options={[
            { value: 'standard', label: '640 px' },
            { value: 'detailed', label: 'Full' },
          ]}
          className="surface-control h-6 w-auto ui-radius-sm border px-1 text-[10px] text-text-secondary"
        />
      </label>
      <span className="flex items-center gap-1 text-text-muted" aria-label="Difference lane legend">
        <i className="h-2 w-2 bg-[#ff6974]" /> Diff
        <i className="ml-1 h-2 w-2 bg-[#e6a23c]" /> Gap
        <i className="ml-1 h-2 w-2 bg-[#a78bfa]" /> Unsupported
        <i className="ml-1 h-2 w-2 bg-[#f87171]" /> Error
      </span>
      <span className="ml-auto inline-flex items-center gap-1">
        <button
          onClick={() => previousSegment && seek(previousSegment.maxDifferenceTime)}
          disabled={!previousSegment}
          className="surface-control ui-radius-sm inline-flex h-6 w-6 items-center justify-center border text-text-secondary disabled:opacity-40"
          title="Previous highlighted interval"
          aria-label="Previous highlighted interval"
        >
          <ArrowLeft className="h-3 w-3" />
        </button>
        <button
          onClick={() => nextSegment && seek(nextSegment.maxDifferenceTime)}
          disabled={!nextSegment}
          className="surface-control ui-radius-sm inline-flex h-6 w-6 items-center justify-center border text-text-secondary disabled:opacity-40"
          title="Next highlighted interval"
          aria-label="Next highlighted interval"
        >
          <ArrowRight className="h-3 w-3" />
        </button>
      </span>
    </div>
  )
}
