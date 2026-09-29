import { ChevronLeft, ChevronRight, Settings } from 'lucide-react'
import type { RefObject } from 'react'

import { findSample, regionIndexAfter, regionIndexBefore } from '../../lib/difference/model'
import { createDifferenceRequest } from '../../lib/difference/request'
import { useDifferenceStore } from '../../stores/differenceStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { Button, ElevatedSurface } from '../ui'

export function DifferenceControls({
  containerRef,
  pixelsPerSecond,
}: {
  containerRef?: RefObject<HTMLDivElement | null>
  pixelsPerSecond?: number
}) {
  const state = useDifferenceStore()
  const currentTime = usePlaybackStore((store) => store.currentTime)
  const hasClips = useTimelineStore((store) =>
    store.tracks.some((track) => ['a', 'b'].includes(track.type) && track.clips.length > 0),
  )
  const previous = regionIndexBefore(state.regions, currentTime)
  const next = regionIndexAfter(state.regions, currentTime)
  const sample = findSample(state.batches, currentTime)
  const navigate = (index: number) => {
    const region = state.regions[index]
    if (!region) return
    usePlaybackStore.getState().seek(region.start)
    const container = containerRef?.current
    if (container && pixelsPerSecond) {
      const x = region.start * pixelsPerSecond
      if (x < container.scrollLeft || x > container.scrollLeft + container.clientWidth)
        container.scrollLeft = Math.max(0, x - container.clientWidth / 2)
    }
  }
  const status = {
    idle: 'Not analyzed',
    running: 'Analyzing…',
    complete: state.unavailable > 0 ? 'Scan finished with unavailable ranges' : 'Analysis complete',
    cancelled: 'Stopped — remaining time is not analyzed',
    stale: 'Sources or settings changed — analyze again',
    error: state.error ?? 'Analysis failed',
    unsupported: state.error ?? 'Analysis is unavailable',
  }[state.status]
  const progress =
    state.duration > 0 ? Math.min(100, (state.processedUntil / state.duration) * 100) : 0
  const percent = (value: number) => `${(value * 100).toFixed(2)}%`
  return (
    <div
      className="relative shrink-0 border-b border-border px-2 py-1 text-xs"
      onKeyDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      aria-label="Timeline difference controls"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          className="h-7"
          disabled={!hasClips || state.status === 'running'}
          onClick={() => state.start(createDifferenceRequest())}
        >
          Analyze differences
        </Button>
        {state.status === 'running' && (
          <Button variant="secondary" size="sm" className="h-7" onClick={state.cancel}>
            Stop
          </Button>
        )}
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          aria-label="Previous difference"
          disabled={previous < 0}
          onClick={() => navigate(previous)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          aria-label="Next difference"
          disabled={next < 0}
          onClick={() => navigate(next)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <details className="relative">
          <summary
            className="surface-control ui-radius-md inline-flex h-7 w-7 cursor-pointer items-center justify-center border"
            aria-label="Difference settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </summary>
          <ElevatedSurface asChild offset={2}>
            <div className="ui-radius-md absolute right-0 bottom-full z-50 mb-1 max-h-80 w-64 overflow-y-auto border border-border p-3 text-text-primary shadow-lg">
              <label className="mb-3 block">
                Colour tolerance (0–1)
                <input
                  className="surface-control ui-radius-sm mt-1 block w-full border px-2 py-1"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={state.options.pixelThreshold}
                  onChange={(event) => {
                    const value = event.currentTarget.valueAsNumber
                    if (Number.isFinite(value) && value >= 0 && value <= 1)
                      state.setOptions({ pixelThreshold: value })
                  }}
                />
              </label>
              <label className="mb-3 block">
                Difference area (%)
                <input
                  className="surface-control ui-radius-sm mt-1 block w-full border px-2 py-1"
                  type="number"
                  min="0.001"
                  max="100"
                  step="0.1"
                  value={Number((state.areaThreshold * 100).toFixed(3))}
                  onChange={(event) =>
                    state.setAreaThreshold(event.currentTarget.valueAsNumber / 100)
                  }
                />
              </label>
              <label className="mb-3 block">
                Analysis resolution
                <select
                  className="surface-control ui-radius-sm mt-1 block w-full border px-2 py-1"
                  value={state.options.resolution}
                  onChange={(event) =>
                    state.setOptions({
                      resolution: event.currentTarget.value === 'full' ? 'full' : 'standard',
                    })
                  }
                >
                  <option value="standard">Standard — up to 640px</option>
                  <option value="full">Detailed — common source resolution</option>
                </select>
              </label>
              <p className="text-text-secondary">
                Both modes inspect every presentation interval. Standard reduces spatial detail.
                Sources are contained without stretching or upscaling; transparency is compared
                separately.
              </p>
              <p className="mt-2 text-text-secondary">
                Full-frame, display-converted comparison. Preview zoom, alignment and ROI are not
                applied. Results stay only in this session; no media is uploaded.
              </p>
              {state.descriptions.map((description) => (
                <p key={description} className="mt-2 break-words text-text-muted">
                  {description}
                </p>
              ))}
            </div>
          </ElevatedSurface>
        </details>
        <span data-testid="difference-count" className="text-text-secondary">
          {state.regions.length} difference intervals
        </span>
        <span
          role="status"
          data-testid="difference-status"
          data-status={state.status}
          className="min-w-0 truncate text-text-muted"
          title={status}
        >
          {status}
        </span>
        {state.status === 'running' && (
          <progress
            aria-label="Difference analysis progress"
            className="h-1 w-16"
            value={progress}
            max={100}
          />
        )}
      </div>
      <output
        className="block truncate text-[10px] text-text-muted"
        aria-label="Difference at playhead"
        title={sample?.message}
      >
        {sample
          ? `${sample.start.toFixed(6)}–${sample.end.toFixed(6)}s: ${sample.ratio === null ? sample.state : percent(sample.ratio)}${sample.message ? ` — ${sample.message}` : ''}`
          : 'Current time: not analyzed'}
        {state.compared > 0 && ` · ${state.compared} compared intervals`}
      </output>
    </div>
  )
}
