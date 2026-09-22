import { AlertCircle, Check, Download, Loader2 } from 'lucide-react'

import type { ComparisonMode, ExportProgress, ExportSettings } from '../../types'
import { Button, Checkbox, Select, Slider } from '../ui'

interface VideoExportPanelProps {
  settings: ExportSettings
  comparisonMode: ComparisonMode
  isExporting: boolean
  progress: number
  exportProgress: ExportProgress
  error: string | null
  onSettingsChange: (settings: Partial<ExportSettings>) => void
  onClose: () => void
  onExport: () => void
  onReset: () => void
}

export function VideoExportPanel({
  settings,
  comparisonMode,
  isExporting,
  progress,
  exportProgress,
  error,
  onSettingsChange,
  onClose,
  onExport,
  onReset,
}: VideoExportPanelProps) {
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
              aria-pressed={settings.exportSource === option.value}
              onClick={() =>
                onSettingsChange({
                  exportSource: option.value as ExportSettings['exportSource'],
                })
              }
              className={`border px-3 py-2 text-sm transition-colors ${
                settings.exportSource === option.value
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-text-secondary hover:border-text-muted'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      {settings.exportSource === 'comparison' && comparisonMode === 'slider' && (
        <div>
          <label
            htmlFor="video-export-slider-position"
            className="mb-2 block text-sm text-text-secondary"
          >
            Slider Position: {settings.sliderPosition}%
          </label>
          <Slider
            id="video-export-slider-position"
            value={settings.sliderPosition}
            onChange={(event) => onSettingsChange({ sliderPosition: Number(event.target.value) })}
            min={0}
            max={100}
            step={1}
          />
          <div className="mt-1 flex justify-between text-xs text-text-muted">
            <span>Full A</span>
            <span>50/50</span>
            <span>Full B</span>
          </div>
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-2">
        <Checkbox
          checked={settings.loopShorterVideo}
          onCheckedChange={(checked) => onSettingsChange({ loopShorterVideo: Boolean(checked) })}
        />
        <span className="text-sm text-text-primary">Loop shorter video to match longer</span>
      </label>

      {settings.exportSource === 'comparison' && (
        <>
          <fieldset>
            <legend className="mb-2 text-sm text-text-secondary">Sweep Style</legend>
            <div className="grid grid-cols-7 gap-1">
              {[
                { value: 'horizontal', label: '↔', title: 'Horizontal' },
                { value: 'vertical', label: '↕', title: 'Vertical' },
                { value: 'diagonal', label: '⤡', title: 'Diagonal' },
                { value: 'circle', label: '◯', title: 'Circle' },
                { value: 'rectangle', label: '▢', title: 'Rectangle' },
                { value: 'spotlight', label: '◎', title: 'Spotlight Rect' },
                { value: 'spotlight-circle', label: '●', title: 'Spotlight Circle' },
              ].map((style) => (
                <button
                  key={style.value}
                  type="button"
                  aria-pressed={settings.sweepStyle === style.value}
                  title={style.title}
                  onClick={() =>
                    onSettingsChange({ sweepStyle: style.value as ExportSettings['sweepStyle'] })
                  }
                  className={`border px-2 py-2 text-lg transition-colors ${
                    settings.sweepStyle === style.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-text-secondary hover:border-text-muted'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {settings.sweepStyle === 'horizontal' && 'Left ↔ Right sweep'}
              {settings.sweepStyle === 'vertical' && 'Top ↔ Bottom sweep'}
              {settings.sweepStyle === 'diagonal' && 'Diagonal corner sweep'}
              {settings.sweepStyle === 'circle' && 'Expanding circle from center'}
              {settings.sweepStyle === 'rectangle' && 'Growing rectangle from center'}
              {settings.sweepStyle === 'spotlight' && 'Bouncing spotlight rectangle'}
              {settings.sweepStyle === 'spotlight-circle' && 'Bouncing spotlight circle'}
            </p>
          </fieldset>

          {(settings.sweepStyle === 'spotlight' || settings.sweepStyle === 'spotlight-circle') && (
            <div className="space-y-3 border border-border bg-surface-alt p-3">
              {settings.sweepStyle === 'spotlight' ? (
                <>
                  <div>
                    <label
                      htmlFor="video-export-spotlight-width"
                      className="mb-1 block text-xs text-text-secondary"
                    >
                      Width: {Math.round(settings.spotlightWidth * 100)}%
                    </label>
                    <Slider
                      id="video-export-spotlight-width"
                      value={settings.spotlightWidth * 100}
                      onChange={(event) =>
                        onSettingsChange({ spotlightWidth: Number(event.target.value) / 100 })
                      }
                      min={10}
                      max={90}
                      step={5}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="video-export-spotlight-height"
                      className="mb-1 block text-xs text-text-secondary"
                    >
                      Height: {Math.round(settings.spotlightHeight * 100)}%
                    </label>
                    <Slider
                      id="video-export-spotlight-height"
                      value={settings.spotlightHeight * 100}
                      onChange={(event) =>
                        onSettingsChange({ spotlightHeight: Number(event.target.value) / 100 })
                      }
                      min={10}
                      max={90}
                      step={5}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label
                    htmlFor="video-export-spotlight-size"
                    className="mb-1 block text-xs text-text-secondary"
                  >
                    Size:{' '}
                    {Math.round(((settings.spotlightWidth + settings.spotlightHeight) / 2) * 100)}%
                  </label>
                  <Slider
                    id="video-export-spotlight-size"
                    value={((settings.spotlightWidth + settings.spotlightHeight) / 2) * 100}
                    onChange={(event) => {
                      const value = Number(event.target.value) / 100
                      onSettingsChange({ spotlightWidth: value, spotlightHeight: value })
                    }}
                    min={10}
                    max={90}
                    step={5}
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="video-export-spotlight-speed"
                  className="mb-1 block text-xs text-text-secondary"
                >
                  Speed: {settings.spotlightSpeed.toFixed(1)}x
                </label>
                <Slider
                  id="video-export-spotlight-speed"
                  value={settings.spotlightSpeed * 10}
                  onChange={(event) =>
                    onSettingsChange({ spotlightSpeed: Number(event.target.value) / 10 })
                  }
                  min={1}
                  max={50}
                  step={1}
                />
                <div className="mt-1 flex justify-between text-[10px] text-text-muted">
                  <span>Very Slow</span>
                  <span>Fast</span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="video-export-loops"
                className="mb-2 block text-sm text-text-secondary"
              >
                Video Loops: {settings.videoLoops}
              </label>
              <Slider
                id="video-export-loops"
                value={settings.videoLoops}
                onChange={(event) => onSettingsChange({ videoLoops: Number(event.target.value) })}
                min={1}
                max={10}
                step={1}
              />
              <p className="mt-1 text-[10px] text-text-muted">Times video plays</p>
            </div>
            <div>
              <label
                htmlFor="video-export-sweeps"
                className="mb-2 block text-sm text-text-secondary"
              >
                Sweeps per Loop: {settings.sweepsPerLoop}
              </label>
              <Slider
                id="video-export-sweeps"
                value={settings.sweepsPerLoop}
                onChange={(event) =>
                  onSettingsChange({ sweepsPerLoop: Number(event.target.value) })
                }
                min={1}
                max={10}
                step={1}
              />
              <p className="mt-1 text-[10px] text-text-muted">Sweeps per video</p>
            </div>
          </div>
        </>
      )}

      <fieldset>
        <legend className="mb-2 text-sm text-text-secondary">Format</legend>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'webm', label: 'WebM' },
            { value: 'mp4', label: 'MP4' },
            { value: 'gif', label: 'GIF' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={settings.format === option.value}
              onClick={() => onSettingsChange({ format: option.value as ExportSettings['format'] })}
              className={`border px-3 py-2 text-sm transition-colors ${
                settings.format === option.value
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-text-secondary hover:border-text-muted'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {settings.format === 'webm' && 'Fastest export, modern browsers'}
          {settings.format === 'mp4' && 'Universal compatibility, hardware accelerated'}
          {settings.format === 'gif' && 'Animated image, works everywhere'}
        </p>
      </fieldset>

      {settings.format === 'gif' && (
        <Select
          label="GIF Size"
          value={settings.gifPreset || 'medium'}
          onChange={(event) =>
            onSettingsChange({
              gifPreset: event.target.value as NonNullable<ExportSettings['gifPreset']>,
            })
          }
          options={[
            { value: 'small', label: 'Small (320px, 10fps)' },
            { value: 'medium', label: 'Medium (480px, 12fps)' },
            { value: 'large', label: 'Large (640px, 15fps)' },
            { value: 'hd', label: 'HD (854px, 15fps)' },
          ]}
        />
      )}

      {settings.format !== 'gif' && (
        <Select
          label="Quality"
          value={settings.quality}
          onChange={(event) =>
            onSettingsChange({ quality: event.target.value as ExportSettings['quality'] })
          }
          options={[
            { value: 'low', label: 'Low (faster, smaller file)' },
            { value: 'medium', label: 'Medium (balanced)' },
            { value: 'high', label: 'High (best quality)' },
          ]}
        />
      )}

      {isExporting && (
        <div className="space-y-3 border border-border bg-surface-alt p-4" role="status">
          <div className="flex items-center justify-between text-xs">
            <span className="bg-accent px-2 py-1 text-white">1. Preparing</span>
            <div className="mx-2 h-px flex-1 bg-border" />
            <span
              className={`px-2 py-1 ${
                progress >= 30 ? 'bg-accent text-white' : 'bg-border text-text-muted'
              }`}
            >
              2. {settings.format === 'gif' ? 'Capturing' : 'Encoding'}
            </span>
            <div className="mx-2 h-px flex-1 bg-border" />
            <span
              className={`px-2 py-1 ${
                progress >= 90 ? 'bg-accent text-white' : 'bg-border text-text-muted'
              }`}
            >
              3. Finishing
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">{exportProgress.message}</span>
              <span
                className={`font-medium transition-all ${
                  progress >= 90 ? 'scale-110 text-secondary' : 'text-accent'
                }`}
              >
                {Math.round(progress)}%
              </span>
            </div>
            <div
              className="relative h-2 overflow-hidden bg-background"
              role="progressbar"
              aria-label="Video export progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
            >
              <div
                className={`h-full bg-gradient-to-r from-accent via-accent to-secondary transition-all ${
                  progress >= 90 ? 'duration-150' : progress >= 70 ? 'duration-200' : 'duration-300'
                }`}
                style={{ width: `${progress}%` }}
              />
              {progress >= 80 && progress < 100 && (
                <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              )}
            </div>
            {progress >= 85 && progress < 100 && (
              <p className="animate-pulse text-xs text-secondary">Almost there!</p>
            )}
          </div>
        </div>
      )}

      {exportProgress.status === 'done' && (
        <div className="relative space-y-4 overflow-hidden border border-accent/40 bg-gradient-to-br from-accent/20 via-accent/10 to-secondary/10 p-6 text-center">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div
              className="absolute left-4 top-2 h-2 w-2 animate-bounce bg-accent"
              style={{ animationDelay: '0ms' }}
            />
            <div
              className="absolute right-8 top-4 h-1.5 w-1.5 animate-bounce bg-secondary"
              style={{ animationDelay: '150ms' }}
            />
            <div
              className="absolute bottom-6 left-12 h-1 w-1 animate-bounce bg-accent"
              style={{ animationDelay: '300ms' }}
            />
            <div
              className="absolute left-1/4 top-8 h-1.5 w-1.5 animate-bounce bg-secondary"
              style={{ animationDelay: '100ms' }}
            />
            <div
              className="absolute bottom-4 right-1/4 h-2 w-2 animate-bounce bg-accent"
              style={{ animationDelay: '200ms' }}
            />
          </div>

          <div className="relative z-10">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center bg-accent/20 shadow-[0_0_30px_rgba(255,87,34,0.4)]">
              <Check className="h-8 w-8 text-accent" strokeWidth={3} aria-hidden="true" />
            </div>
            <h3 className="text-xl font-bold text-text-primary">Export Complete!</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Your {settings.format.toUpperCase()} is ready in your downloads folder
            </p>
          </div>

          <div className="relative z-10 flex items-center justify-center gap-3 pt-2">
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
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </>
          )}
        </Button>
      </div>
    </>
  )
}
