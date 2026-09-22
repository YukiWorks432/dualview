import { AlertCircle, Box, Check, Loader2 } from 'lucide-react'

import type { ExportProgress } from '../../types'
import { Button, Select, Slider } from '../ui'

export type Export3DSource = 'side-by-side' | 'a-only' | 'b-only'
export type Export3DFormat = 'mp4' | 'gif'
export type Export3DQuality = 'low' | 'medium' | 'high'

interface Model3DExportPanelProps {
  source: Export3DSource
  onSourceChange: (source: Export3DSource) => void
  rotations: number
  onRotationsChange: (rotations: number) => void
  fps: number
  onFpsChange: (fps: number) => void
  format: Export3DFormat
  onFormatChange: (format: Export3DFormat) => void
  quality: Export3DQuality
  onQualityChange: (quality: Export3DQuality) => void
  isExporting: boolean
  progress: number
  exportProgress: ExportProgress
  error: string | null
  onClose: () => void
  onExport: () => void
  onReset: () => void
}

export function Model3DExportPanel({
  source,
  onSourceChange,
  rotations,
  onRotationsChange,
  fps,
  onFpsChange,
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
}: Model3DExportPanelProps) {
  return (
    <>
      <fieldset>
        <legend className="mb-2 text-sm text-text-secondary">Export Source</legend>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'side-by-side', label: 'Side by Side' },
            { value: 'a-only', label: 'A Only' },
            { value: 'b-only', label: 'B Only' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={source === option.value}
              onClick={() => onSourceChange(option.value as Export3DSource)}
              className={`border px-3 py-2 text-sm transition-colors ${
                source === option.value
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-text-secondary hover:border-text-muted'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {source === 'side-by-side' && 'Both models rotate together in split view'}
          {source === 'a-only' && 'Only Model A rotating'}
          {source === 'b-only' && 'Only Model B rotating'}
        </p>
      </fieldset>

      <div>
        <label htmlFor="3d-export-rotations" className="mb-2 block text-sm text-text-secondary">
          Full Rotations: {rotations}
        </label>
        <Slider
          id="3d-export-rotations"
          value={rotations}
          onChange={(event) => onRotationsChange(Number(event.target.value))}
          min={1}
          max={5}
          step={1}
        />
        <p className="mt-1 text-xs text-text-muted">Duration: ~{rotations * 3} seconds</p>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm text-text-secondary">Format</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'mp4', label: 'MP4' },
            { value: 'gif', label: 'GIF' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={format === option.value}
              onClick={() => onFormatChange(option.value as Export3DFormat)}
              className={`border px-3 py-2 text-sm transition-colors ${
                format === option.value
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-text-secondary hover:border-text-muted'
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
          onChange={(event) => onQualityChange(event.target.value as Export3DQuality)}
          options={[
            { value: 'low', label: 'Low (faster, smaller file)' },
            { value: 'medium', label: 'Medium (balanced)' },
            { value: 'high', label: 'High (best quality)' },
          ]}
        />
      )}

      <fieldset>
        <legend className="mb-2 text-sm text-text-secondary">Frame Rate: {fps} fps</legend>
        <div className="grid grid-cols-3 gap-2">
          {[24, 30, 60].map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={fps === option}
              onClick={() => onFpsChange(option)}
              className={`border px-3 py-2 text-sm transition-colors ${
                fps === option
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-text-secondary hover:border-text-muted'
              }`}
            >
              {option} fps
            </button>
          ))}
        </div>
      </fieldset>

      {isExporting && (
        <div className="space-y-3 border border-border bg-surface-alt p-4" role="status">
          <div className="flex items-center justify-between text-xs">
            <span className="bg-accent px-2 py-1 text-white">1. Setup</span>
            <div className="mx-2 h-px flex-1 bg-border" />
            <span
              className={`px-2 py-1 ${
                progress >= 10 ? 'bg-accent text-white' : 'bg-border text-text-muted'
              }`}
            >
              2. Rendering
            </span>
            <div className="mx-2 h-px flex-1 bg-border" />
            <span
              className={`px-2 py-1 ${
                progress >= 90 ? 'bg-accent text-white' : 'bg-border text-text-muted'
              }`}
            >
              3. Encoding
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">{exportProgress.message}</span>
              <span className={`font-medium ${progress >= 90 ? 'text-secondary' : 'text-accent'}`}>
                {Math.round(progress)}%
              </span>
            </div>
            <div
              className="h-2 overflow-hidden bg-background"
              role="progressbar"
              aria-label="3D export progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
            >
              <div
                className="h-full bg-gradient-to-r from-accent via-accent to-secondary transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {exportProgress.status === 'done' && (
        <div className="space-y-4 border border-accent/40 bg-gradient-to-br from-accent/20 via-accent/10 to-secondary/10 p-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center bg-accent/20">
            <Check className="h-8 w-8 text-accent" strokeWidth={3} aria-hidden="true" />
          </div>
          <h3 className="text-xl font-bold text-text-primary">3D Export Complete!</h3>
          <p className="text-sm text-text-secondary">
            Your turntable video is ready in your downloads folder
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
        <div className="flex items-center gap-2 text-sm text-error" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose} disabled={isExporting}>
          Cancel
        </Button>
        <Button onClick={onExport} disabled={isExporting}>
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Exporting...
            </>
          ) : (
            <>
              <Box className="h-4 w-4" aria-hidden="true" />
              Export 3D
            </>
          )}
        </Button>
      </div>
    </>
  )
}
