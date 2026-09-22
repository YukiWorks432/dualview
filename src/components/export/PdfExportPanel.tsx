import { FileText, Loader2 } from 'lucide-react'

import { Button, Checkbox, Input } from '../ui'

interface PdfExportPanelProps {
  title: string
  onTitleChange: (title: string) => void
  includeMetadata: boolean
  onIncludeMetadataChange: (value: boolean) => void
  includeSettings: boolean
  onIncludeSettingsChange: (value: boolean) => void
  isExporting: boolean
  onClose: () => void
  onExport: () => void
}

export function PdfExportPanel({
  title,
  onTitleChange,
  includeMetadata,
  onIncludeMetadataChange,
  includeSettings,
  onIncludeSettingsChange,
  isExporting,
  onClose,
  onExport,
}: PdfExportPanelProps) {
  return (
    <>
      <div>
        <label htmlFor="pdf-report-title" className="mb-1 block text-sm text-text-secondary">
          Report Title
        </label>
        <Input
          id="pdf-report-title"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox
            checked={includeMetadata}
            onCheckedChange={(checked) => onIncludeMetadataChange(Boolean(checked))}
          />
          <span className="text-sm text-text-primary">Include media metadata</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox
            checked={includeSettings}
            onCheckedChange={(checked) => onIncludeSettingsChange(Boolean(checked))}
          />
          <span className="text-sm text-text-primary">Include comparison settings</span>
        </label>
      </div>

      <div className="flex items-center gap-2 border border-border bg-surface-alt p-3 text-sm text-text-secondary">
        <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Generates a professional PDF report with screenshot, metadata, and quality metrics.
        </span>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onExport} disabled={isExporting}>
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Generating...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" aria-hidden="true" />
              Generate PDF
            </>
          )}
        </Button>
      </div>
    </>
  )
}
