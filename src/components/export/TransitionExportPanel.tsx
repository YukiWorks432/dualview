import { AlertCircle, Check, Loader2, Sparkles } from 'lucide-react'

import type { EngineInfo } from '../../lib/webgl/shaders'
import type { ExportProgress, TransitionEngine, TransitionExportMode } from '../../types'
import { Button, Select, Slider } from '../ui'

export type TransitionExportFormat = 'mp4' | 'gif'
export type TransitionExportQuality = 'low' | 'medium' | 'high'

export interface TransitionVariantOption {
  value: string
  label: string
}

interface TransitionExportPanelProps {
  shaderCount: number
  webglSupported: boolean
  exportMode: TransitionExportMode
  onExportModeChange: (mode: TransitionExportMode) => void
  engines: EngineInfo[]
  engine: TransitionEngine
  onEngineChange: (engine: TransitionEngine) => void
  variants: TransitionVariantOption[]
  variant: string
  onVariantChange: (variant: string) => void
  duration: number
  onDurationChange: (duration: number) => void
  intensity: number
  onIntensityChange: (intensity: number) => void
  format: TransitionExportFormat
  onFormatChange: (format: TransitionExportFormat) => void
  quality: TransitionExportQuality
  onQualityChange: (quality: TransitionExportQuality) => void
  isExporting: boolean
  progress: number
  exportProgress: ExportProgress
  error: string | null
  onClose: () => void
  onExport: () => void
  onReset: () => void
}

export function TransitionExportPanel({
  shaderCount,
  webglSupported,
  exportMode,
  onExportModeChange,
  engines,
  engine,
  onEngineChange,
  variants,
  variant,
  onVariantChange,
  duration,
  onDurationChange,
  intensity,
  onIntensityChange,
  format,
  onFormatChange,
  quality,
  onQualityChange,
  isExporting,
  progress,
  exportProgress,
  error,
  onClose,
  onExport,
  onReset,
}: TransitionExportPanelProps) {
  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {shaderCount} transition effects available
        </span>
        {!webglSupported && <span className="text-xs text-destructive">WebGL not supported</span>}
      </div>

      <fieldset>
        <legend className="mb-2 text-sm text-muted-foreground">Export Mode</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              value: 'sequential',
              label: 'A → T → B',
              description: 'Full A, then transition, then full B',
            },
            {
              value: 'overlap',
              label: 'Overlap',
              description: 'Videos overlap during transition',
            },
            {
              value: 'loop',
              label: 'Loop A↔B',
              description: 'Continuous A↔B transitions',
            },
            {
              value: 'transition-only',
              label: 'Trans Only',
              description: 'Just the transition effect',
            },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={exportMode === option.value}
              title={option.description}
              onClick={() => onExportModeChange(option.value as TransitionExportMode)}
              className={`surface-control-elevation ui-radius-md border px-3 py-2 text-sm transition-colors ${
                exportMode === option.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'surface-control text-muted-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm text-muted-foreground">Effect Category</legend>
        <div className="grid max-h-32 grid-cols-4 gap-1 overflow-y-auto">
          {engines.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={engine === option.id}
              title={option.description}
              onClick={() => onEngineChange(option.id)}
              className={`surface-control-elevation flex flex-col items-center ui-radius-md border px-2 py-1.5 text-xs transition-colors ${
                engine === option.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'surface-control text-muted-foreground'
              }`}
            >
              <span className="text-base" aria-hidden="true">
                {option.icon}
              </span>
              <span className="w-full truncate text-center">{option.label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm text-muted-foreground">
          Variant ({variants.length} options)
        </legend>
        <div className="grid max-h-24 grid-cols-4 gap-1 overflow-y-auto">
          {variants.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={variant === option.value}
              onClick={() => onVariantChange(option.value)}
              className={`surface-control-elevation truncate ui-radius-md border px-2 py-1 text-xs transition-colors ${
                variant === option.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'surface-control text-muted-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="transition-export-duration"
            className="mb-2 block text-sm text-muted-foreground"
          >
            Duration: {duration.toFixed(1)}s
          </label>
          <Slider
            id="transition-export-duration"
            value={duration * 10}
            onChange={(event) => onDurationChange(Number(event.target.value) / 10)}
            min={5}
            max={50}
            step={1}
          />
        </div>
        <div>
          <label
            htmlFor="transition-export-intensity"
            className="mb-2 block text-sm text-muted-foreground"
          >
            Intensity: {Math.round(intensity * 100)}%
          </label>
          <Slider
            id="transition-export-intensity"
            value={intensity * 100}
            onChange={(event) => onIntensityChange(Number(event.target.value) / 100)}
            min={0}
            max={100}
            step={5}
          />
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm text-muted-foreground">Format</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'mp4', label: 'MP4' },
            { value: 'gif', label: 'GIF' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={format === option.value}
              onClick={() => onFormatChange(option.value as TransitionExportFormat)}
              className={`surface-control-elevation ui-radius-md border px-3 py-2 text-sm transition-colors ${
                format === option.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'surface-control text-muted-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      {format === 'mp4' && (
        <Select
          label="Quality"
          value={quality}
          onChange={(event) => onQualityChange(event.target.value as TransitionExportQuality)}
          options={[
            { value: 'low', label: 'Low (faster, smaller file)' },
            { value: 'medium', label: 'Medium (balanced)' },
            { value: 'high', label: 'High (best quality)' },
          ]}
        />
      )}

      {isExporting && (
        <div
          className="ui-radius-lg space-y-3 border border-border bg-surface-alt p-4"
          role="status"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="ui-radius-sm bg-primary px-2 py-1 text-white">1. Initialize</span>
            <div className="mx-2 h-px flex-1 bg-border" />
            <span
              className={`ui-radius-sm px-2 py-1 ${
                progress >= 10
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-border text-muted-foreground'
              }`}
            >
              2. Rendering
            </span>
            <div className="mx-2 h-px flex-1 bg-border" />
            <span
              className={`ui-radius-sm px-2 py-1 ${
                progress >= 90
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-border text-muted-foreground'
              }`}
            >
              3. Encode
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{exportProgress.message}</span>
              <span className={`font-medium ${progress >= 90 ? 'text-success' : 'text-primary'}`}>
                {Math.round(progress)}%
              </span>
            </div>
            <div
              className="ui-radius-sm h-2 overflow-hidden bg-background"
              role="progressbar"
              aria-label="Transition export progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
            >
              <div
                className="h-full bg-gradient-to-r from-primary via-primary to-success transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {exportProgress.status === 'done' && (
        <div className="ui-radius-lg space-y-4 border border-primary/40 bg-gradient-to-br from-primary/20 via-primary/10 to-success/10 p-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
            <Check className="h-8 w-8 text-primary" strokeWidth={3} aria-hidden="true" />
          </div>
          <h3 className="text-xl font-bold text-foreground">Transition Export Complete!</h3>
          <p className="text-sm text-muted-foreground">
            Your {format.toUpperCase()} with {engine}/{variant} effect is ready
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button onClick={onClose}>Done</Button>
            <Button variant="outline" onClick={onReset}>
              Export Another
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose} disabled={isExporting}>
          Cancel
        </Button>
        <Button onClick={onExport} disabled={isExporting || !webglSupported}>
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Exporting...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Export FX
            </>
          )}
        </Button>
      </div>
    </>
  )
}
