import { ScanSearch } from 'lucide-react'

import {
  useDifferenceHighlightStore,
  type DifferenceAnalysisQuality,
  type DifferenceNoiseFilter,
  type DifferenceRuntimeState,
} from '../../stores/differenceHighlightStore'
import { ElevatedSurface, Slider } from '../ui'
import { DropdownSelect } from '../ui/dropdown-select'

export function DifferenceRuntimeMessage({ runtime }: { runtime: DifferenceRuntimeState }) {
  return (
    <div
      className={`text-[10px] ${
        runtime.status === 'different' ? 'text-accent' : 'text-text-muted'
      }`}
    >
      {runtime.message}
    </div>
  )
}

export function DifferenceHighlightSettings() {
  const enabled = useDifferenceHighlightStore((state) => state.enabled)
  const sensitivity = useDifferenceHighlightStore((state) => state.sensitivity)
  const noiseFilter = useDifferenceHighlightStore((state) => state.noiseFilter)
  const analysisQuality = useDifferenceHighlightStore((state) => state.analysisQuality)
  const runtime = useDifferenceHighlightStore((state) => state.runtime)
  const setEnabled = useDifferenceHighlightStore((state) => state.setEnabled)
  const setSensitivity = useDifferenceHighlightStore((state) => state.setSensitivity)
  const setNoiseFilter = useDifferenceHighlightStore((state) => state.setNoiseFilter)
  const setAnalysisQuality = useDifferenceHighlightStore((state) => state.setAnalysisQuality)

  return (
    <ElevatedSurface
      offset={1}
      className="ui-radius-lg space-y-4 border border-border p-4 animate-slide-down"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <ScanSearch className="h-4 w-4 text-accent" />
        Difference Regions
      </h3>

      <button
        type="button"
        aria-pressed={enabled}
        onClick={() => setEnabled(!enabled)}
        className={`ui-radius-md flex w-full items-center justify-between border p-3 text-sm font-medium transition-colors ${
          enabled ? 'surface-active border-accent text-accent' : 'surface-control text-text-primary'
        }`}
      >
        <span>{enabled ? 'Highlighting On' : 'Highlighting Off'}</span>
        <span className="text-[10px] uppercase tracking-wide">{enabled ? 'On' : 'Off'}</span>
      </button>

      {enabled && (
        <>
          <Slider
            label={`Sensitivity: ${sensitivity}%`}
            min={0}
            max={100}
            step={1}
            value={sensitivity}
            onChange={(event) => setSensitivity(Number(event.target.value))}
          />
          <p className="-mt-2 text-[10px] text-text-muted">
            Higher sensitivity includes smaller pixel differences.
          </p>

          <DropdownSelect
            label="Small-region filter"
            value={noiseFilter}
            onValueChange={(value: DifferenceNoiseFilter) => setNoiseFilter(value)}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
          />

          <DropdownSelect
            label="Analysis quality"
            value={analysisQuality}
            onValueChange={(value: DifferenceAnalysisQuality) => setAnalysisQuality(value)}
            options={[
              { value: 'auto', label: 'Auto (up to 1920 px)' },
              { value: 'full', label: 'Full common resolution' },
            ]}
          />

          <div className="surface-control ui-radius-md border p-2">
            <DifferenceRuntimeMessage runtime={runtime} />
          </div>
        </>
      )}
    </ElevatedSurface>
  )
}
