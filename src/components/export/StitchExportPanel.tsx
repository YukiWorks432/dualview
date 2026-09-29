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
        <legend className="mb-2 text-sm text-muted-foreground">Source Track</legend>
        <div className="grid grid-cols-2 gap-2">
          {tracks.map((track) => (
            <button
              key={track.id}
              type="button"
              aria-pressed={trackId === track.id}
              onClick={() => onTrackChange(track.id)}
              className={`surface-control-elevation ui-radius-md border p-3 text-left transition-colors ${
                trackId === track.id ? 'border-primary bg-primary/10' : 'surface-control'
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`h-3 w-3 rounded-full ${track.type === 'a' ? 'bg-compare-a' : 'bg-compare-b'}`}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-foreground">{track.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {track.clipCount} clip{track.clipCount !== 1 ? 's' : ''} •{' '}
                {formatTime(track.totalDuration)}
              </div>
            </button>
          ))}
        </div>
      </fieldset>

      {selectedTrack &&
        (selectedTrack.clipCount === 0 ? (
          <div className="ui-radius-md border border-border bg-surface-alt p-4 text-center">
            <Film className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">No clips on this track</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add clips to the timeline to export
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Clips to Stitch ({selectedTrack.clipCount})
            </div>
            <div className="max-h-32 space-y-1 overflow-y-auto ui-radius-md border border-border bg-surface-alt p-2">
              {selectedTrack.clips.map((clip, index) => (
                <div key={`${clip.name}-${index}`} className="flex items-center gap-2 text-xs">
                  <span className="w-5 text-muted-foreground">{index + 1}.</span>
                  <Film className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                  <span className="flex-1 truncate text-foreground">{clip.name}</span>
                  <span className="text-muted-foreground">{formatTime(clip.duration)}</span>
                </div>
              ))}
            </div>
            <div className="text-right text-xs text-muted-foreground">
              Total: {formatTime(selectedTrack.totalDuration)}
            </div>
          </div>
        ))}

      <fieldset>
        <legend className="mb-2 text-sm text-muted-foreground">Resolution</legend>
        <div className="grid grid-cols-3 gap-2">
          {(['720p', '1080p', '4k'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={resolution === option}
              onClick={() => onResolutionChange(option)}
              className={`surface-control-elevation ui-radius-md border px-3 py-2 text-sm transition-colors ${
                resolution === option
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'surface-control text-muted-foreground'
              }`}
            >
              {option.toUpperCase()}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm text-muted-foreground">Quality</legend>
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
              className={`surface-control-elevation ui-radius-md border px-3 py-2 text-sm transition-colors ${
                quality === option.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'surface-control text-muted-foreground'
              }`}
            >
              <span className="block">{option.label}</span>
              <span className="block text-[10px] text-muted-foreground">{option.description}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm text-muted-foreground">Frame Rate</legend>
        <div className="grid grid-cols-3 gap-2">
          {([24, 30, 60] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={fps === option}
              onClick={() => onFpsChange(option)}
              className={`surface-control-elevation ui-radius-md border px-3 py-2 text-sm transition-colors ${
                fps === option
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'surface-control text-muted-foreground'
              }`}
            >
              {option} fps
            </button>
          ))}
        </div>
      </fieldset>

      {(progress.status === 'preparing' || progress.status === 'encoding') && (
        <div
          className="ui-radius-lg space-y-3 border border-border bg-surface-alt p-4"
          role="status"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{progress.message}</span>
            <span className="font-medium text-primary">{progress.progress}%</span>
          </div>
          <div
            className="ui-radius-sm h-2 overflow-hidden bg-background"
            role="progressbar"
            aria-label="Stitch export progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.progress}
          >
            <div
              className="h-full bg-gradient-to-r from-primary via-primary to-success transition-all duration-200"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Clip {progress.currentClip} of {progress.totalClips}
          </div>
        </div>
      )}

      {progress.status === 'done' && (
        <div className="ui-radius-lg space-y-4 border border-primary/40 bg-gradient-to-br from-primary/20 via-primary/10 to-success/10 p-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
            <Check className="h-8 w-8 text-primary" strokeWidth={3} aria-hidden="true" />
          </div>
          <h3 className="text-xl font-bold text-foreground">Stitch Complete!</h3>
          <p className="text-sm text-muted-foreground">
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
          className="flex items-center gap-2 ui-radius-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
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
