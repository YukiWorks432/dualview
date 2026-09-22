import { AlertCircle, Check, Film, Layers, Loader2 } from 'lucide-react'

import type { StitchExportProgress } from '../../lib/stitchExport'
import { formatTime } from '../../lib/utils'
import { Button } from '../ui'

export type StitchResolution = '720p' | '1080p' | '4k'
export type StitchQuality = 'low' | 'medium' | 'high'
export type StitchFps = 24 | 30 | 60

export interface StitchTrackOption {
  id: string
  name: string
  type: 'a' | 'b'
  clipCount: number
  totalDuration: number
  clips: Array<{
    name: string
    duration: number
  }>
}

interface StitchExportPanelProps {
  tracks: StitchTrackOption[]
  trackId: string
  onTrackChange: (trackId: string) => void
  resolution: StitchResolution
  onResolutionChange: (resolution: StitchResolution) => void
  quality: StitchQuality
  onQualityChange: (quality: StitchQuality) => void
  fps: StitchFps
  onFpsChange: (fps: StitchFps) => void
  progress: StitchExportProgress
  isExporting: boolean
  onClose: () => void
  onExport: () => void
  onReset: () => void
}

export function StitchExportPanel({
  tracks,
  trackId,
  onTrackChange,
  resolution,
  onResolutionChange,
  quality,
  onQualityChange,
  fps,
  onFpsChange,
  progress,
  isExporting,
  onClose,
  onExport,
  onReset,
}: StitchExportPanelProps) {
  const selectedTrack = tracks.find((track) => track.id === trackId)
  const canExport = Boolean(selectedTrack?.clipCount)

  return (
    <>
      <fieldset>
        <legend className="mb-2 text-sm text-text-secondary">Source Track</legend>
        <div className="grid grid-cols-2 gap-2">
          {tracks.map((track) => (
            <button
              key={track.id}
              type="button"
              aria-pressed={trackId === track.id}
              onClick={() => onTrackChange(track.id)}
              className={`border p-3 text-left transition-colors ${
                trackId === track.id
                  ? 'border-accent bg-accent/10'
                  : 'border-border hover:border-text-muted'
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`h-3 w-3 ${track.type === 'a' ? 'bg-accent' : 'bg-secondary'}`}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-text-primary">{track.name}</span>
              </div>
              <div className="text-xs text-text-muted">
                {track.clipCount} clip{track.clipCount !== 1 ? 's' : ''} •{' '}
                {formatTime(track.totalDuration)}
              </div>
            </button>
          ))}
        </div>
      </fieldset>

      {selectedTrack &&
        (selectedTrack.clipCount === 0 ? (
          <div className="border border-border bg-surface-alt p-4 text-center">
            <Film className="mx-auto mb-2 h-8 w-8 text-text-muted" aria-hidden="true" />
            <p className="text-sm text-text-secondary">No clips on this track</p>
            <p className="mt-1 text-xs text-text-muted">Add clips to the timeline to export</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-text-secondary">
              Clips to Stitch ({selectedTrack.clipCount})
            </div>
            <div className="max-h-32 space-y-1 overflow-y-auto border border-border bg-surface-alt p-2">
              {selectedTrack.clips.map((clip, index) => (
                <div key={`${clip.name}-${index}`} className="flex items-center gap-2 text-xs">
                  <span className="w-5 text-text-muted">{index + 1}.</span>
                  <Film className="h-3 w-3 text-text-muted" aria-hidden="true" />
                  <span className="flex-1 truncate text-text-primary">{clip.name}</span>
                  <span className="text-text-muted">{formatTime(clip.duration)}</span>
                </div>
              ))}
            </div>
            <div className="text-right text-xs text-text-muted">
              Total: {formatTime(selectedTrack.totalDuration)}
            </div>
          </div>
        ))}

      <fieldset>
        <legend className="mb-2 text-sm text-text-secondary">Resolution</legend>
        <div className="grid grid-cols-3 gap-2">
          {(['720p', '1080p', '4k'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={resolution === option}
              onClick={() => onResolutionChange(option)}
              className={`border px-3 py-2 text-sm transition-colors ${
                resolution === option
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-text-secondary hover:border-text-muted'
              }`}
            >
              {option.toUpperCase()}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm text-text-secondary">Quality</legend>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'low', label: 'Low', description: '2 Mbps' },
            { value: 'medium', label: 'Medium', description: '5 Mbps' },
            { value: 'high', label: 'High', description: '10 Mbps' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={quality === option.value}
              onClick={() => onQualityChange(option.value as StitchQuality)}
              className={`border px-3 py-2 text-sm transition-colors ${
                quality === option.value
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-text-secondary hover:border-text-muted'
              }`}
            >
              <span className="block">{option.label}</span>
              <span className="block text-[10px] text-text-muted">{option.description}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm text-text-secondary">Frame Rate</legend>
        <div className="grid grid-cols-3 gap-2">
          {([24, 30, 60] as const).map((option) => (
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

      {(progress.status === 'preparing' || progress.status === 'encoding') && (
        <div className="space-y-3 border border-border bg-surface-alt p-4" role="status">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">{progress.message}</span>
            <span className="font-medium text-accent">{progress.progress}%</span>
          </div>
          <div
            className="h-2 overflow-hidden bg-background"
            role="progressbar"
            aria-label="Stitch export progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.progress}
          >
            <div
              className="h-full bg-gradient-to-r from-accent via-accent to-secondary transition-all duration-200"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          <div className="text-xs text-text-muted">
            Clip {progress.currentClip} of {progress.totalClips}
          </div>
        </div>
      )}

      {progress.status === 'done' && (
        <div className="space-y-4 border border-accent/40 bg-gradient-to-br from-accent/20 via-accent/10 to-secondary/10 p-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center bg-accent/20">
            <Check className="h-8 w-8 text-accent" strokeWidth={3} aria-hidden="true" />
          </div>
          <h3 className="text-xl font-bold text-text-primary">Stitch Complete!</h3>
          <p className="text-sm text-text-secondary">
            Your combined video is ready in your downloads folder
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button onClick={onClose}>Done</Button>
            <Button variant="outline" onClick={onReset}>
              Export Another
            </Button>
          </div>
        </div>
      )}

      {progress.status === 'error' && (
        <div
          className="flex items-center gap-2 border border-error/30 bg-error/10 p-3 text-sm text-error"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{progress.message}</span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose} disabled={isExporting}>
          Cancel
        </Button>
        <Button onClick={onExport} disabled={isExporting || !canExport}>
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Stitching...
            </>
          ) : (
            <>
              <Layers className="h-4 w-4" aria-hidden="true" />
              Export Stitched Video
            </>
          )}
        </Button>
      </div>
    </>
  )
}
