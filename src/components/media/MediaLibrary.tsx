import {
  Film,
  Image,
  Trash2,
  Plus,
  Layers,
  X,
  Search,
  Loader2,
  AlertCircle,
  RotateCcw,
  Clock,
} from 'lucide-react'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { DragEvent } from 'react'

import { MEDIA_DRAG_TYPE, type MediaDragData } from '../../lib/media/dragData'
import { cn, formatTime } from '../../lib/utils'
import { useMediaStore } from '../../stores/mediaStore'
import { useTimelineStore } from '../../stores/timelineStore'
import type { MediaType, MediaStatus } from '../../types'
import { ElevatedSurface, IconButton } from '../ui'


// Filter type includes 'all' plus all media types
type FilterType = 'all' | MediaType

interface FilterConfig {
  type: FilterType
  label: string
  icon: React.ReactNode
  shortcut: string
}

const FILTER_CONFIG: FilterConfig[] = [
  { type: 'all', label: 'All', icon: <Layers className="w-3 h-3" />, shortcut: '`' },
  { type: 'video', label: 'Video', icon: <Film className="w-3 h-3" />, shortcut: '1' },
  { type: 'image', label: 'Image', icon: <Image className="w-3 h-3" />, shortcut: '2' },
]

// MEDIA-012: Status indicator component
function StatusIndicator({
  status,
  message,
  onRetry,
}: {
  status: MediaStatus
  message?: string
  onRetry?: () => void
}) {
  if (status === 'pending') {
    return (
      <div className="flex items-center gap-1 text-warning" title="Waiting to process">
        <Clock className="w-3 h-3" />
      </div>
    )
  }
  if (status === 'processing') {
    return (
      <div className="flex items-center gap-1 text-primary" title="Processing...">
        <Loader2 className="w-3 h-3 animate-spin" />
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="flex items-center gap-1" title={message || 'Error'}>
        <AlertCircle className="w-3 h-3 text-destructive" />
        {onRetry && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRetry()
            }}
            className="surface-control ui-radius-sm border p-0.5"
            title="Retry"
          >
            <RotateCcw className="w-3 h-3 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
    )
  }
  // ready status - optionally show checkmark
  return null
}

export function MediaLibrary() {
  const { files, removeFile, selectedIds, selectFile, deselectFile, retryProcessing } =
    useMediaStore()
  const { addClip, tracks } = useTimelineStore()

  // Filter state - supports multiple selection
  const [activeFilters, setActiveFilters] = useState<Set<FilterType>>(new Set(['all']))
  // MEDIA-012: Status filter
  const [statusFilter, setStatusFilter] = useState<MediaStatus | 'all'>('all')

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Calculate counts for each type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: files.length }
    for (const file of files) {
      counts[file.type] = (counts[file.type] || 0) + 1
    }
    return counts
  }, [files])

  // MEDIA-012: Calculate counts for each status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: files.length,
      pending: 0,
      processing: 0,
      ready: 0,
      error: 0,
    }
    for (const file of files) {
      counts[file.status] = (counts[file.status] || 0) + 1
    }
    return counts
  }, [files])

  // Filter files based on active filters AND search query AND status
  const filteredFiles = useMemo(() => {
    let result = files

    // Apply type filter
    if (!activeFilters.has('all')) {
      result = result.filter((file) => activeFilters.has(file.type))
    }

    // MEDIA-012: Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((file) => file.status === statusFilter)
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter((file) => file.name.toLowerCase().includes(query))
    }

    return result
  }, [files, activeFilters, searchQuery, statusFilter])

  // Function to highlight matching text in filename
  const highlightMatch = useCallback((text: string, query: string) => {
    if (!query.trim()) return text

    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase().trim()
    const index = lowerText.indexOf(lowerQuery)

    if (index === -1) return text

    const before = text.slice(0, index)
    const match = text.slice(index, index + lowerQuery.length)
    const after = text.slice(index + lowerQuery.length)

    return (
      <>
        {before}
        <span className="bg-primary/30 text-primary">{match}</span>
        {after}
      </>
    )
  }, [])

  // Handle filter click
  const handleFilterClick = useCallback((filterType: FilterType, ctrlKey: boolean) => {
    setActiveFilters((prev) => {
      const newFilters = new Set(prev)

      if (filterType === 'all') {
        // Clicking 'all' clears everything and sets only 'all'
        return new Set(['all'])
      }

      if (ctrlKey) {
        // Multi-select with Ctrl
        newFilters.delete('all')
        if (newFilters.has(filterType)) {
          newFilters.delete(filterType)
          // If nothing selected, go back to 'all'
          if (newFilters.size === 0) {
            return new Set(['all'])
          }
        } else {
          newFilters.add(filterType)
        }
      } else {
        // Single select
        return new Set([filterType])
      }

      return newFilters
    })
  }, [])

  // Keyboard shortcuts for filters (Alt+1,2,3...)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Alt+key shortcuts
      if (!e.altKey) return

      // Find matching filter config
      const config = FILTER_CONFIG.find((f) => f.shortcut === e.key)
      if (config) {
        e.preventDefault()
        handleFilterClick(config.type, e.ctrlKey || e.metaKey)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleFilterClick])

  const handleAddToTimeline = (mediaId: string, trackType: 'a' | 'b') => {
    const media = files.find((f) => f.id === mediaId)
    const track = tracks.find((t) => t.type === trackType)

    if (media && track) {
      // Check if track accepts this media type
      if (!track.acceptedTypes.includes(media.type)) {
        return // Track doesn't accept this media type
      }

      // Find end of existing clips
      const lastClipEnd = track.clips.reduce((max, clip) => Math.max(max, clip.endTime), 0)
      addClip(track.id, mediaId, lastClipEnd, media.duration || 10)
    }
  }

  const canAddToTrack = (mediaType: string, trackType: 'a' | 'b') => {
    const track = tracks.find((t) => t.type === trackType)
    return track?.acceptedTypes.includes(mediaType as MediaType)
  }

  // Check if we have search or filter active
  const hasActiveSearch = searchQuery.trim() !== ''
  const hasActiveFilter = !activeFilters.has('all')

  // Determine if we're showing a filtered/search empty state
  const showFilterEmptyState =
    files.length > 0 && filteredFiles.length === 0 && (hasActiveSearch || hasActiveFilter)

  if (files.length === 0) {
    return (
      <ElevatedSurface
        offset={1}
        className="ui-radius-lg space-y-2 border border-border py-6 text-center text-muted-foreground"
      >
        <div className="flex justify-center gap-2">
          <Film className="h-4 w-4 text-muted-foreground/50" />
          <Image className="h-4 w-4 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No media yet</p>
        <p className="text-xs">Drop files above to get started</p>
      </ElevatedSurface>
    )
  }

  return (
    <div className="space-y-2">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            'surface-control ui-radius-md w-full border px-7 py-1.5 text-xs',
            'placeholder:text-muted-foreground text-foreground',
            'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
            'transition-colors',
          )}
        />
        {hasActiveSearch && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearchQuery('')}
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-1 pb-2 border-b border-border">
        {FILTER_CONFIG.map((config) => {
          const count = typeCounts[config.type] || 0
          const isActive = activeFilters.has(config.type)

          // Don't show types with 0 count (except 'all')
          if (config.type !== 'all' && count === 0) return null

          return (
            <button
              key={config.type}
              className={cn(
                'ui-radius-md flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground hover:bg-primary/80'
                  : 'surface-control text-muted-foreground hover:text-foreground',
              )}
              onClick={(e) => handleFilterClick(config.type, e.ctrlKey || e.metaKey)}
              title={`${config.label} (Alt+${config.shortcut})${
                config.type !== 'all' ? ' - Ctrl+click to multi-select' : ''
              }`}
            >
              {config.icon}
              <span>{config.label}</span>
              <span
                className={cn(
                  'ui-radius-sm px-1',
                  isActive ? 'bg-primary-foreground/15' : 'surface-subtle',
                )}
              >
                {count}
              </span>
            </button>
          )
        })}

        {/* Clear filters button when not showing 'all' */}
        {!activeFilters.has('all') && (
          <button
            className="surface-control ui-radius-md flex items-center gap-1 border px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setActiveFilters(new Set(['all']))}
            title="Clear filters"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {/* MEDIA-012: Status filter buttons (only show if there are non-ready files) */}
        {(statusCounts.pending > 0 || statusCounts.processing > 0 || statusCounts.error > 0) && (
          <>
            <div className="w-px h-4 bg-border mx-1" />
            {statusCounts.error > 0 && (
              <button
                className={cn(
                  'ui-radius-md flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors',
                  statusFilter === 'error'
                    ? 'bg-destructive/20 text-destructive'
                    : 'surface-control border text-muted-foreground hover:text-destructive',
                )}
                onClick={() => setStatusFilter(statusFilter === 'error' ? 'all' : 'error')}
                title="Show failed files"
              >
                <AlertCircle className="w-3 h-3" />
                <span>{statusCounts.error}</span>
              </button>
            )}
            {statusCounts.processing > 0 && (
              <button
                className={cn(
                  'ui-radius-md flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors',
                  statusFilter === 'processing'
                    ? 'bg-primary/20 text-primary'
                    : 'surface-control border text-muted-foreground hover:text-primary',
                )}
                onClick={() =>
                  setStatusFilter(statusFilter === 'processing' ? 'all' : 'processing')
                }
                title="Show processing files"
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{statusCounts.processing}</span>
              </button>
            )}
            {statusCounts.pending > 0 && (
              <button
                className={cn(
                  'ui-radius-md flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors',
                  statusFilter === 'pending'
                    ? 'bg-warning/20 text-warning'
                    : 'surface-control border text-muted-foreground hover:text-warning',
                )}
                onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
                title="Show pending files"
              >
                <Clock className="w-3 h-3" />
                <span>{statusCounts.pending}</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Empty filter/search state */}
      {showFilterEmptyState && (
        <ElevatedSurface
          offset={1}
          className="ui-radius-lg space-y-2 border border-border py-6 text-center text-muted-foreground"
        >
          <Search className="w-8 h-8 mx-auto opacity-30" />
          <p className="text-sm font-medium text-muted-foreground">No matching media</p>
          <p className="text-xs">
            {hasActiveSearch && hasActiveFilter
              ? `No ${Array.from(activeFilters)
                  .filter((f) => f !== 'all')
                  .join(' or ')} files matching "${searchQuery}"`
              : hasActiveSearch
                ? `No files matching "${searchQuery}"`
                : `No ${Array.from(activeFilters)
                    .filter((f) => f !== 'all')
                    .join(' or ')} files found`}
          </p>
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => {
              setSearchQuery('')
              setActiveFilters(new Set(['all']))
            }}
          >
            Clear{' '}
            {hasActiveSearch && hasActiveFilter
              ? 'search & filters'
              : hasActiveSearch
                ? 'search'
                : 'filters'}
          </button>
        </ElevatedSurface>
      )}

      {/* File list */}
      {filteredFiles.map((file) => {
        const isSelected = selectedIds.includes(file.id)
        const canDrag = file.status === 'ready'

        // Handle drag start - set drag data
        const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
          if (!canDrag) {
            e.preventDefault()
            return
          }
          const dragData: MediaDragData = {
            mediaId: file.id,
            mediaType: file.type,
            duration: file.duration || 5,
            name: file.name,
          }
          e.dataTransfer.setData(MEDIA_DRAG_TYPE, JSON.stringify(dragData))
          e.dataTransfer.effectAllowed = 'copy'
          // Add visual feedback
          const dragImage = e.currentTarget.cloneNode(true) as HTMLElement
          dragImage.style.opacity = '0.8'
          dragImage.style.transform = 'scale(0.9)'
          document.body.appendChild(dragImage)
          e.dataTransfer.setDragImage(dragImage, 40, 20)
          setTimeout(() => document.body.removeChild(dragImage), 0)
        }

        return (
          <ElevatedSurface
            offset={1}
            key={file.id}
            draggable={canDrag}
            onDragStart={handleDragStart}
            className={cn(
              'surface-interactive ui-radius-lg group relative overflow-hidden border transition-colors',
              canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
              isSelected ? 'border-primary' : 'surface-border-hover border-transparent',
            )}
            onClick={() => (isSelected ? deselectFile(file.id) : selectFile(file.id))}
          >
            <div className="flex items-center gap-3 p-2">
              {/* Thumbnail */}
              <div className="ui-radius-md relative flex h-10 w-16 flex-shrink-0 items-center justify-center overflow-hidden bg-background">
                {file.status === 'processing' && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  </div>
                )}
                {file.thumbnail ? (
                  <img
                    src={file.thumbnail}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-muted-foreground">
                    {file.type === 'video' && <Film className="w-5 h-5" />}
                    {file.type === 'image' && <Image className="w-5 h-5" />}
                  </div>
                )}
                {/* MEDIA-012: Error overlay */}
                {file.status === 'error' && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-destructive/20">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-foreground truncate flex-1">
                    {highlightMatch(file.name, searchQuery)}
                  </p>
                  {/* MEDIA-012: Status indicator */}
                  <StatusIndicator
                    status={file.status}
                    message={file.statusMessage}
                    onRetry={file.status === 'error' ? () => retryProcessing(file.id) : undefined}
                  />
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <span className="capitalize">{file.type}</span>
                  {file.duration && <span>{formatTime(file.duration)}</span>}
                  {file.width && file.height && (
                    <span>
                      {file.width}x{file.height}
                    </span>
                  )}
                  {/* MEDIA-012: Show error message */}
                  {file.status === 'error' && file.statusMessage && (
                    <span className="text-destructive truncate" title={file.statusMessage}>
                      {file.statusMessage}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <IconButton
                  variant="secondary"
                  className="h-7 w-7"
                  disabled={!canAddToTrack(file.type, 'a')}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAddToTimeline(file.id, 'a')
                  }}
                  title={
                    canAddToTrack(file.type, 'a')
                      ? 'Add to Track A'
                      : 'Track A does not accept this media type'
                  }
                >
                  <Plus
                    className={cn(
                      'w-3 h-3',
                      canAddToTrack(file.type, 'a') ? 'text-compare-a' : 'text-muted-foreground',
                    )}
                  />
                </IconButton>
                <IconButton
                  variant="secondary"
                  className="h-7 w-7"
                  disabled={!canAddToTrack(file.type, 'b')}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAddToTimeline(file.id, 'b')
                  }}
                  title={
                    canAddToTrack(file.type, 'b')
                      ? 'Add to Track B'
                      : 'Track B does not accept this media type'
                  }
                >
                  <Plus
                    className={cn(
                      'w-3 h-3',
                      canAddToTrack(file.type, 'b') ? 'text-compare-b' : 'text-muted-foreground',
                    )}
                  />
                </IconButton>
                <IconButton
                  variant="secondary"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFile(file.id)
                  }}
                  title="Remove"
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </IconButton>
              </div>
            </div>
          </ElevatedSurface>
        )
      })}
    </div>
  )
}
