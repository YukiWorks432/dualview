import { AlertCircle, Check } from 'lucide-react'

interface ExportReadinessProps {
  hasMediaA: boolean
  hasMediaB: boolean
}

export function ExportReadiness({ hasMediaA, hasMediaB }: ExportReadinessProps) {
  if (!hasMediaA && !hasMediaB) {
    return (
      <div
        className="mb-4 flex items-center gap-2 border border-warning/30 bg-warning/10 p-3"
        role="status"
      >
        <AlertCircle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <span className="text-sm text-warning">Add media to Track A or B to export</span>
      </div>
    )
  }

  if (!hasMediaA || !hasMediaB) {
    return (
      <div
        className="mb-4 flex items-center gap-3 border border-border bg-surface-alt p-2 text-xs"
        role="status"
      >
        <div className={`flex items-center gap-1 ${hasMediaA ? 'text-accent' : 'text-text-muted'}`}>
          <span className={`h-2 w-2 ${hasMediaA ? 'bg-accent' : 'bg-border'}`} aria-hidden="true" />
          <span>Media A</span>
        </div>
        <div
          className={`flex items-center gap-1 ${hasMediaB ? 'text-secondary' : 'text-text-muted'}`}
        >
          <span
            className={`h-2 w-2 ${hasMediaB ? 'bg-secondary' : 'bg-border'}`}
            aria-hidden="true"
          />
          <span>Media B</span>
        </div>
        <span className="ml-auto text-text-muted">Single media export available</span>
      </div>
    )
  }

  return (
    <div
      className="mb-4 flex items-center gap-2 border border-accent/30 bg-accent/10 p-2 text-xs"
      role="status"
    >
      <Check className="h-4 w-4 text-accent" aria-hidden="true" />
      <span className="font-medium text-accent">Ready to export comparison</span>
    </div>
  )
}
