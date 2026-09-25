import { Camera, Download, FileText, Layers, Sparkles, type LucideIcon } from 'lucide-react'

export type ExportMode = 'video' | 'screenshot' | 'pdf' | 'transition' | 'stitch'

interface ExportModeDefinition {
  value: ExportMode
  label: string
  icon: LucideIcon
  title?: string
}

const exportModes: ExportModeDefinition[] = [
  { value: 'video', label: 'Video', icon: Download },
  { value: 'stitch', label: 'Stitch', icon: Layers, title: 'Stitch clips into a single video' },
  { value: 'transition', label: 'FX', icon: Sparkles },
  { value: 'screenshot', label: 'Image', icon: Camera },
  { value: 'pdf', label: 'PDF', icon: FileText },
]

interface ExportModeTabsProps {
  value: ExportMode
  onValueChange: (value: ExportMode) => void
  disabled?: boolean
}

export function ExportModeTabs({ value, onValueChange, disabled = false }: ExportModeTabsProps) {
  return (
    <div
      className="mb-4 grid grid-cols-5 gap-1 border-b border-border pb-1"
      role="tablist"
      aria-label="Export mode"
    >
      {exportModes.map(({ value: mode, label, icon: Icon, title }) => (
        <button
          key={mode}
          type="button"
          role="tab"
          aria-selected={value === mode}
          disabled={disabled}
          title={title}
          className={`flex items-center justify-center gap-1 px-1 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            value === mode
              ? 'border-b-2 border-accent bg-surface-alt text-text-primary'
              : 'text-text-secondary hover:bg-surface-alt/50 hover:text-text-primary'
          }`}
          onClick={() => onValueChange(mode)}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}
