import { Keyboard, X } from 'lucide-react'

import { comparisonModeDefinitions, primaryComparisonModes } from '../../config/comparisonModes'
import { Button } from './button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from './dialog'
import { Kbd } from './kbd'

interface ShortcutItem {
  keys: string[]
  description: string
}

interface ShortcutCategory {
  title: string
  shortcuts: ShortcutItem[]
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Comparison Modes',
    shortcuts: primaryComparisonModes.flatMap((definition) =>
      definition.shortcut
        ? [{ keys: [definition.shortcut.key], description: `Switch to ${definition.label}` }]
        : [],
    ),
  },
  ...comparisonModeDefinitions
    .filter((definition) => definition.localShortcuts)
    .map((definition) => ({
      title: `${definition.label} only`,
      shortcuts: definition.localShortcuts!.map((shortcut) => ({
        keys: shortcut.shift ? ['Shift', shortcut.key] : [shortcut.key],
        description: shortcut.description,
      })),
    })),
  {
    title: 'Playback',
    shortcuts: [
      { keys: ['Space'], description: 'Toggle play/pause' },
      { keys: ['J'], description: 'Shuttle backward (1x, 2x, 4x, 8x)' },
      { keys: ['K'], description: 'Stop shuttle playback' },
      { keys: ['L'], description: 'Shuttle forward (1x, 2x, 4x, 8x)' },
      { keys: ['←'], description: 'Frame step backward when paused' },
      { keys: ['→'], description: 'Frame step forward when paused' },
      { keys: ['Shift', '←'], description: 'Jump backward 5 seconds' },
      { keys: ['Shift', '→'], description: 'Jump forward 5 seconds' },
      { keys: ['Home'], description: 'Go to start' },
      { keys: ['End'], description: 'Go to end' },
    ],
  },
  {
    title: 'Timeline Editing',
    shortcuts: [
      { keys: ['S'], description: 'Split selected clip (outside Audio QA)' },
      { keys: ['Q'], description: 'Keep left of playhead (trim right)' },
      { keys: ['W'], description: 'Keep right of playhead (trim left)' },
      { keys: ['Delete'], description: 'Delete selected clips' },
      { keys: ['Ctrl/⌘', 'A'], description: 'Select all clips' },
      { keys: ['Ctrl/⌘', 'D'], description: 'Duplicate selected clip' },
      { keys: ['Ctrl/⌘', 'C'], description: 'Copy selected clip' },
      { keys: ['Ctrl/⌘', 'V'], description: 'Paste at playhead' },
      { keys: ['N'], description: 'Toggle snapping' },
      { keys: ['R'], description: 'Toggle ripple edit mode' },
    ],
  },
  {
    title: 'Loop Region',
    shortcuts: [
      { keys: ['I'], description: 'Set loop in-point' },
      { keys: ['O'], description: 'Set loop out-point' },
      { keys: ['Esc'], description: 'Clear loop region (outside dialogs)' },
    ],
  },
  {
    title: 'History',
    shortcuts: [
      { keys: ['Ctrl/⌘', 'Z'], description: 'Undo' },
      { keys: ['Ctrl/⌘', 'Shift', 'Z'], description: 'Redo' },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { keys: ['Ctrl/⌘', '+'], description: 'Zoom in timeline' },
      { keys: ['Ctrl/⌘', '-'], description: 'Zoom out timeline' },
      { keys: ['T'], description: 'Toggle timeline visibility' },
      { keys: ['B'], description: 'Toggle sidebar (outside Audio QA)' },
      { keys: ['E'], description: 'Open export dialog' },
    ],
  },
  {
    title: 'Markers & Metrics',
    shortcuts: [
      { keys: ['M'], description: 'Add marker at playhead' },
      { keys: ['Shift', 'M'], description: 'Toggle quality metrics overlay' },
      { keys: ['Shift', 'S'], description: 'Take screenshot' },
    ],
  },
  {
    title: 'Analysis Tools',
    shortcuts: [
      { keys: ['P'], description: 'Toggle Focus Peaking overlay' },
      { keys: ['Z'], description: 'Toggle Zebra Stripes overlay' },
      { keys: ['F'], description: 'Flip A/B sources in Difference mode' },
      { keys: ['G'], description: 'Toggle video scopes (outside Difference)' },
    ],
  },
]

interface KeyboardShortcutsHelpProps {
  isOpen: boolean
  onClose: () => void
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-3xl overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-accent" aria-hidden="true" />
            <DialogTitle className="text-lg font-semibold">Keyboard Shortcuts</DialogTitle>
            <DialogDescription className="sr-only">
              Keyboard shortcuts available throughout DualView.
            </DialogDescription>
          </div>
          <DialogClose
            render={
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8"
                aria-label="Close keyboard shortcuts"
              />
            }
          >
            <X className="h-5 w-5 text-text-muted" aria-hidden="true" />
          </DialogClose>
        </div>

        <div className="max-h-[calc(80vh-80px)] overflow-y-auto p-4">
          <p className="mb-4 text-sm text-text-secondary">
            Comparison-mode shortcuts take priority over timeline and global shortcuts. While
            typing, composing text, or using a dialog, global shortcuts are paused. Escape closes
            the dialog and returns focus without clearing the loop. Outside dialogs and text
            composition, Escape cancels an active clip drag or closes its menu, even if a text field
            still has focus. Alt+1/2 filters the visible media library.
          </p>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {SHORTCUT_CATEGORIES.map((category) => (
              <section key={category.title}>
                <h3 className="mb-3 text-sm font-medium text-accent">{category.title}</h3>
                <div className="space-y-2">
                  {category.shortcuts.map((shortcut) => (
                    <div
                      key={`${category.title}-${shortcut.keys.join('-')}`}
                      className="flex items-center justify-between gap-4 py-1"
                    >
                      <span className="text-sm text-text-secondary">{shortcut.description}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        {shortcut.keys.map((key, index) => (
                          <span key={`${key}-${index}`} className="flex items-center gap-1">
                            <Kbd>{key}</Kbd>
                            {index < shortcut.keys.length - 1 && (
                              <span className="text-text-muted">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="border-t border-border bg-surface-hover p-3">
          <p className="text-center text-xs text-text-muted">
            Press <Kbd>?</Kbd> to open this help and <Kbd>Esc</Kbd> to close it.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
