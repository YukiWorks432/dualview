import { Trash2, AlertTriangle } from 'lucide-react'
/**
 * Memoized Timeline Clip Component (OpenCut Optimization)
 *
 * Extracted from Timeline.tsx to enable React.memo optimization.
 * Only re-renders when clip props change, not on every store update.
 */
import { memo, useCallback } from 'react'

import { useFilmstrip } from '../../hooks/useFilmstrip'
import { cn } from '../../lib/utils'
import type { TimelineClip as ClipType } from '../../types'
import { ClipFilmstrip, FilmstripLoading } from './ClipFilmstrip'
import { ClipWaveform } from './ClipWaveform'

interface TimelineClipProps {
  clip: ClipType
  trackType: 'a' | 'b' | 'c' | 'audio'
  trackLocked: boolean
  isSelected: boolean
  isBeingDragged: boolean
  isSnapped: boolean
  hasOverlap?: boolean // Overlap detection warning
  clipLeft: number
  clipWidth: number
  mediaName?: string
  mediaThumbnail?: string
  mediaType?: string
  waveformPeaks?: number[]
  // FILMSTRIP-001, FILMSTRIP-002: Filmstrip support
  showFilmstrip?: boolean
  trimState: {
    clipId: string
    side: 'start' | 'end'
  } | null
  onMouseDown: (e: React.MouseEvent, clipId: string, trackId: string, startTime: number) => void
  onTrimMouseDown: (
    e: React.MouseEvent,
    clipId: string,
    side: 'start' | 'end',
    clipTime: number,
    trackId: string,
  ) => void
  onClick: (e: React.MouseEvent, clipId: string) => void
  onContextMenu: (e: React.MouseEvent, clipId: string, trackId: string) => void
  onDelete: (clipId: string) => void
}

export const TimelineClip = memo(function TimelineClip({
  clip,
  trackType,
  trackLocked,
  isSelected,
  isBeingDragged,
  isSnapped,
  hasOverlap = false,
  clipLeft,
  clipWidth,
  mediaName,
  mediaThumbnail,
  mediaType,
  waveformPeaks,
  showFilmstrip = true,
  trimState,
  onMouseDown,
  onTrimMouseDown,
  onClick,
  onContextMenu,
  onDelete,
}: TimelineClipProps) {
  const { filmstrip, isLoading: filmstripLoading } = useFilmstrip(clip.mediaId, {
    enabled: showFilmstrip && mediaType === 'video',
    frameInterval: 1,
    maxFrames: 60,
  })
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      onMouseDown(e, clip.id, clip.trackId, clip.startTime)
    },
    [onMouseDown, clip.id, clip.trackId, clip.startTime],
  )

  const handleTrimStartMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onTrimMouseDown(e, clip.id, 'start', clip.startTime, clip.trackId)
    },
    [onTrimMouseDown, clip.id, clip.startTime, clip.trackId],
  )

  const handleTrimEndMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onTrimMouseDown(e, clip.id, 'end', clip.endTime, clip.trackId)
    },
    [onTrimMouseDown, clip.id, clip.endTime, clip.trackId],
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      onClick(e, clip.id)
    },
    [onClick, clip.id],
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      onContextMenu(e, clip.id, clip.trackId)
    },
    [onContextMenu, clip.id, clip.trackId],
  )

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDelete(clip.id)
    },
    [onDelete, clip.id],
  )

  const bgColorClass =
    trackType === 'a'
      ? 'bg-compare-a/30 border border-compare-a/60'
      : trackType === 'b'
        ? 'bg-compare-b/30 border border-compare-b/60'
        : 'bg-muted/30 border border-muted-foreground/40'

  const waveformColor =
    trackType === 'a'
      ? 'hsl(var(--compare-a) / 0.8)'
      : trackType === 'b'
        ? 'hsl(var(--compare-b) / 0.8)'
        : 'hsl(var(--muted-foreground) / 0.8)'

  return (
    <div
      data-clip
      className={cn(
        'absolute top-1 bottom-1 overflow-hidden group/clip',
        trackLocked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing',
        bgColorClass,
        isSelected && 'ring-2 ring-primary',
        isBeingDragged && 'opacity-70 z-10 scale-[1.02]',
        !isBeingDragged && 'transition-all',
        isSnapped && 'ring-2 ring-warning',
        hasOverlap && 'ring-2 ring-destructive animate-pulse',
      )}
      style={{
        left: clipLeft,
        width: Math.max(clipWidth, 20),
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      title={hasOverlap ? 'Warning: This clip overlaps with another clip' : undefined}
    >
      {/* FILMSTRIP-002: Filmstrip for video clips */}
      {showFilmstrip && mediaType === 'video' && filmstrip && (
        <ClipFilmstrip
          filmstrip={filmstrip}
          clipWidth={clipWidth}
          inPoint={clip.inPoint}
          outPoint={clip.outPoint}
        />
      )}

      {/* Filmstrip loading indicator */}
      {showFilmstrip && mediaType === 'video' && filmstripLoading && !filmstrip && (
        <FilmstripLoading />
      )}

      {/* Thumbnail for video/image (fallback when no filmstrip) */}
      {mediaThumbnail &&
        mediaType !== 'audio' &&
        (!showFilmstrip || !filmstrip) &&
        !filmstripLoading && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-50"
            style={{ backgroundImage: `url(${mediaThumbnail})` }}
          />
        )}

      {/* Thumbnail for images (always show single thumbnail) */}
      {mediaThumbnail && mediaType === 'image' && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-50"
          style={{ backgroundImage: `url(${mediaThumbnail})` }}
        />
      )}

      {/* Waveform preview for audio clips */}
      {mediaType === 'audio' && waveformPeaks && (
        <div className="absolute inset-0 opacity-70">
          <ClipWaveform peaks={waveformPeaks} color={waveformColor} />
        </div>
      )}

      <div className="absolute inset-0 p-1 flex items-start justify-between z-10">
        <div className="flex items-center gap-1">
          {/* Overlap warning icon */}
          {hasOverlap && (
            <AlertTriangle className="w-3 h-3 text-destructive drop-shadow animate-pulse" />
          )}
          <span className="text-[10px] text-foreground font-medium drop-shadow">
            {mediaName || 'Clip'}
          </span>
        </div>
        {/* Delete button */}
        {!trackLocked && (
          <button
            className="ui-radius-sm opacity-0 group-hover/clip:opacity-100 p-0.5 bg-destructive/80 hover:bg-destructive transition-opacity"
            onClick={handleDelete}
            title="Delete clip (Del)"
          >
            <Trash2 className="w-3 h-3 text-destructive-foreground" />
          </button>
        )}
      </div>

      {/* Trim handles */}
      {!trackLocked && (
        <>
          <div
            className={cn(
              'absolute left-0 top-0 bottom-0 w-2 bg-foreground/30 hover:bg-foreground/80 cursor-ew-resize z-10 transition-colors',
              trimState?.clipId === clip.id && trimState.side === 'start' && 'bg-primary',
            )}
            title="先頭をトリム"
            onMouseDown={handleTrimStartMouseDown}
          />
          <div
            className={cn(
              'absolute right-0 top-0 bottom-0 w-2 bg-foreground/30 hover:bg-foreground/80 cursor-ew-resize z-10 transition-colors',
              trimState?.clipId === clip.id && trimState.side === 'end' && 'bg-primary',
            )}
            title="末尾をトリム"
            onMouseDown={handleTrimEndMouseDown}
          />
        </>
      )}
    </div>
  )
})
