import { AlertCircle, Check, Clipboard, Download, Loader2 } from 'lucide-react'

import type { ExportProgress } from '../../types'
import { Button, Select, Slider } from '../ui'

export type ScreenshotFormat = 'png' | 'jpg'
export type ScreenshotResolution = '720p' | '1080p' | '4k'
export type ScreenshotSource = 'comparison' | 'a-only' | 'b-only'

interface ScreenshotExportPanelProps {
  source: ScreenshotSource
  onSourceChange: (source: ScreenshotSource) => void
  resolution: ScreenshotResolution
  onResolutionChange: (resolution: ScreenshotResolution) => void
  format: ScreenshotFormat
  onFormatChange: (format: ScreenshotFormat) => void
  quality: number
  onQualityChange: (quality: number) => void
  progress: ExportProgress
  error: string | null
  isExporting: boolean
  onClose: () => void
  onExport: (copyToClipboard: boolean) => void
}

export function ScreenshotExportPanel({
  source,
  onSourceChange,
  resolution,
  onResolutionChange,
  format,
  onFormatChange,
  quality,
  onQualityChange,
  progress,
  error,
  isExporting,
  onClose,
  onExport,
}: ScreenshotExportPanelProps) {
  return (
    <>
      <fieldset>
        <legend className="mb-2 text-sm text-text-secondary">Export Source</legend>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'comparison', label: 'Comparison' },
            { value: 'a-only', label: 'A Only' },
            { value: 'b-only', label: 'B Only' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={source === option.value}
              onClick={() => onSourceChange(option.value as ScreenshotSource)}
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
      </fieldset>

      {source === 'comparison' && (
        <p className="text-xs text-text-muted">
          Comparison captures the current visible comparison mode and frame.
        </p>
      )}

      <fieldset>
        <legend className="mb-2 text-sm text-text-secondary">Resolution</legend>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: '720p', label: '720p', description: '1280×720' },
            { value: '1080p', label: '1080p', description: '1920×1080' },
            { value: '4k', label: '4K', description: '3840×2160' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={resolution === option.value}
              onClick={() => onResolutionChange(option.value as ScreenshotResolution)}
              className={`border px-3 py-2 text-sm transition-colors ${
                resolution === option.value
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-text-secondary hover:border-text-muted'
              }`}
            >
              <span className="block font-medium">{option.label}</span>
              <span className="block text-xs opacity-70">{option.description}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <Select
        label="Format"
        value={format}
        onChange={(event) => onFormatChange(event.target.value as ScreenshotFormat)}
        options={[
          { value: 'png', label: 'PNG (lossless)' },
          { value: 'jpg', label: 'JPEG (smaller file)' },
        ]}
      />

      {format === 'jpg' && (
        <div>
          <label htmlFor="screenshot-quality" className="mb-2 block text-sm text-text-secondary">
            Quality: {quality}%
          </label>
          <Slider
            id="screenshot-quality"
            value={quality}
            onChange={(event) => onQualityChange(Number(event.target.value))}
            min={10}
            max={100}
            step={5}
          />
          <div className="mt-1 flex justify-between text-xs text-text-muted">
            <span>Smaller file</span>
            <span>Better quality</span>
          </div>
        </div>
      )}

      {progress.status === 'done' && progress.message && (
        <div className="flex items-center gap-2 text-sm text-success" role="status">
          <Check className="h-4 w-4" aria-hidden="true" />
          <span>{progress.message}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-error" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="outline" onClick={() => onExport(true)} disabled={isExporting}>
          <Clipboard className="h-4 w-4" aria-hidden="true" />
          Copy
        </Button>
        <Button onClick={() => onExport(false)} disabled={isExporting}>
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Capturing...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" aria-hidden="true" />
              Download
            </>
          )}
        </Button>
      </div>
    </>
  )
}
