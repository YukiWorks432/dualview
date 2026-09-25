import { Download, Keyboard, Menu, Pause, Play, Redo2, Undo2 } from 'lucide-react'

import { useHistoryStore } from '../../stores/historyStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { Button } from '../ui'
import { ComparisonModePicker } from './ComparisonModePicker'
import { MetadataComparison } from './MetadataComparison'

interface HeaderProps {
  onExport?: () => void
  onShowShortcuts?: () => void
  onToggleSidebar?: () => void
  onOpenProjects?: () => void
}

export function Header({ onExport, onShowShortcuts, onToggleSidebar }: HeaderProps) {
  const { isPlaying, togglePlay } = useTimelineStore()
  const { undo, redo, canUndo, canRedo } = useHistoryStore()

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-surface px-2 md:h-10 md:px-3">
      <div className="flex items-center gap-1.5 md:gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="show-mobile -ml-1 h-8 w-8 text-text-muted"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </Button>

        <h1 className="text-sm font-semibold text-text-primary">DualView</h1>

        <div className="hide-mobile h-4 w-px bg-border" />

        <div className="hide-mobile flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            onClick={undo}
            disabled={!canUndo()}
            className="h-7 w-7"
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
            onClick={redo}
            disabled={!canRedo()}
            className="h-7 w-7"
          >
            <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <ComparisonModePicker />

      <div className="hide-mobile">
        <MetadataComparison />
      </div>

      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Keyboard shortcuts"
          title="Keyboard Shortcuts (?)"
          onClick={onShowShortcuts}
          className="hide-mobile h-7 w-7"
        >
          <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>

        <div className="hide-mobile mx-0.5 h-4 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          className={`group h-7 gap-1 px-2 text-xs ${isPlaying ? 'bg-surface-active text-text-primary' : ''}`}
          onClick={togglePlay}
          title="Toggle playback (Space)"
        >
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5 animate-pulse-subtle" aria-hidden="true" />
          ) : (
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span className="hidden xl:inline">{isPlaying ? 'Pause' : 'Play'}</span>
        </Button>

        <Button
          size="sm"
          className="group relative h-7 gap-1 overflow-hidden px-2 text-xs md:px-3"
          onClick={onExport}
          title="Export (E)"
        >
          <span className="absolute inset-0 bg-white/5 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
          <Download className="relative z-10 h-3.5 w-3.5" aria-hidden="true" />
          <span className="relative z-10 hidden md:inline">Export</span>
        </Button>
      </div>
    </header>
  )
}
