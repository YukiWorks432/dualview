/**
 * WEBGL-013: Batch Comparison Mode
 * Compare multiple images at once with matrix view and export
 */

import {
  Upload,
  Grid3X3,
  SortAsc,
  SortDesc,
  Filter,
  X,
  Play,
  Pause,
  FileJson,
  FileSpreadsheet,
} from 'lucide-react'
import { useState, useCallback, useRef } from 'react'

import { useMediaStore } from '../../stores/mediaStore'
import { Dialog, DialogContent, DialogTitle } from '../ui'
import { Select } from '../ui/select'

interface BatchResult {
  idA: string
  idB: string
  nameA: string
  nameB: string
  ssim: number
  deltaE: number
  diffPixelPercent: number
  peakDifference: number
  meanDifference: number
  timestamp: number
}

interface BatchComparisonProps {
  isOpen: boolean
  onClose: () => void
}

// Load image as HTMLImageElement
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

// Compute metrics using 2D canvas
function computeMetricsFromCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  imgA: HTMLImageElement,
  imgB: HTMLImageElement,
) {
  const width = canvas.width
  const height = canvas.height

  // Draw image A
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(imgA, 0, 0, width, height)
  const dataA = ctx.getImageData(0, 0, width, height).data

  // Draw image B
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(imgB, 0, 0, width, height)
  const dataB = ctx.getImageData(0, 0, width, height).data

  // Compute metrics
  let sumDiff = 0
  let maxDiff = 0
  let diffPixels = 0
  let sumSquaredDiff = 0
  const threshold = 10 // Default threshold

  for (let i = 0; i < dataA.length; i += 4) {
    const dr = Math.abs(dataA[i] - dataB[i])
    const dg = Math.abs(dataA[i + 1] - dataB[i + 1])
    const db = Math.abs(dataA[i + 2] - dataB[i + 2])
    const diff = (dr + dg + db) / 3

    sumDiff += diff
    maxDiff = Math.max(maxDiff, diff)
    sumSquaredDiff += diff * diff

    if (diff > threshold) {
      diffPixels++
    }
  }

  const pixelCount = dataA.length / 4
  const meanDiff = sumDiff / pixelCount
  const variance = sumSquaredDiff / pixelCount - meanDiff * meanDiff

  // Simplified SSIM approximation
  const ssim = 1 - (variance / (255 * 255)) * 0.5 - (meanDiff / 255) * 0.5

  // Simplified Delta E (using RGB difference as approximation)
  const deltaE = meanDiff * 0.4 // Rough approximation

  return {
    ssim: Math.max(0, Math.min(1, ssim)),
    deltaE: deltaE,
    diffPixelPercent: (diffPixels / pixelCount) * 100,
    peakDifference: maxDiff,
    meanDifference: meanDiff,
  }
}

export function BatchComparison({ isOpen, onClose }: BatchComparisonProps) {
  const { files } = useMediaStore()
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [results, setResults] = useState<BatchResult[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [sortBy, setSortBy] = useState<'ssim' | 'deltaE' | 'diffPixelPercent'>('ssim')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filterThreshold] = useState(0) // Threshold filter (can be made configurable later)
  const [showOnlyDifferent, setShowOnlyDifferent] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const abortRef = useRef(false)

  // Filter to only image files
  const imageFiles = files.filter((f) => f.type === 'image')

  // Toggle file selection
  const toggleFile = useCallback((id: string) => {
    setSelectedFiles((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]))
  }, [])

  // Select all images
  const selectAll = useCallback(() => {
    setSelectedFiles(imageFiles.map((f) => f.id))
  }, [imageFiles])

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedFiles([])
    setResults([])
  }, [])

  // Run batch comparison
  const runBatchComparison = useCallback(async () => {
    if (selectedFiles.length < 2) return

    setIsProcessing(true)
    setProgress(0)
    abortRef.current = false

    const newResults: BatchResult[] = []
    const totalComparisons = (selectedFiles.length * (selectedFiles.length - 1)) / 2
    let completed = 0

    // Create offscreen canvas for comparison
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setIsProcessing(false)
      return
    }

    // Compare each pair
    for (let i = 0; i < selectedFiles.length && !abortRef.current; i++) {
      for (let j = i + 1; j < selectedFiles.length && !abortRef.current; j++) {
        const fileA = files.find((f) => f.id === selectedFiles[i])
        const fileB = files.find((f) => f.id === selectedFiles[j])

        if (!fileA || !fileB) continue

        try {
          // Load images
          const imgA = await loadImage(fileA.url)
          const imgB = await loadImage(fileB.url)

          // Compute metrics
          const metrics = computeMetricsFromCanvas(ctx, canvas, imgA, imgB)

          newResults.push({
            idA: fileA.id,
            idB: fileB.id,
            nameA: fileA.name,
            nameB: fileB.name,
            ssim: metrics.ssim,
            deltaE: metrics.deltaE,
            diffPixelPercent: metrics.diffPixelPercent,
            peakDifference: metrics.peakDifference,
            meanDifference: metrics.meanDifference,
            timestamp: Date.now(),
          })
        } catch (err) {
          console.error(`Failed to compare ${fileA.name} with ${fileB.name}:`, err)
        }

        completed++
        setProgress((completed / totalComparisons) * 100)

        // Allow UI to update
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    }

    setResults(newResults)
    setIsProcessing(false)
  }, [selectedFiles, files])

  // Stop processing
  const stopProcessing = useCallback(() => {
    abortRef.current = true
  }, [])

  // Sort results
  const sortedResults = [...results].sort((a, b) => {
    const multiplier = sortOrder === 'asc' ? 1 : -1
    return (a[sortBy] - b[sortBy]) * multiplier
  })

  // Filter results
  const filteredResults = sortedResults.filter((r) => {
    if (showOnlyDifferent && r.ssim > 0.99) return false
    if (filterThreshold > 0 && r.diffPixelPercent < filterThreshold) return false
    return true
  })

  // Export as JSON
  const exportJSON = useCallback(() => {
    const data = {
      timestamp: new Date().toISOString(),
      totalComparisons: filteredResults.length,
      results: filteredResults,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batch-comparison-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredResults])

  // Export as CSV
  const exportCSV = useCallback(() => {
    const headers = [
      'File A',
      'File B',
      'SSIM',
      'Delta E',
      'Diff Pixels %',
      'Peak Diff',
      'Mean Diff',
    ]
    const rows = filteredResults.map((r) => [
      r.nameA,
      r.nameB,
      r.ssim.toFixed(4),
      r.deltaE.toFixed(2),
      r.diffPixelPercent.toFixed(2),
      r.peakDifference.toFixed(0),
      r.meanDifference.toFixed(2),
    ])
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batch-comparison-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredResults])

  // Compute summary statistics
  const summaryStats =
    results.length > 0
      ? {
          avgSSIM: results.reduce((sum, r) => sum + r.ssim, 0) / results.length,
          minSSIM: Math.min(...results.map((r) => r.ssim)),
          maxSSIM: Math.max(...results.map((r) => r.ssim)),
          avgDeltaE: results.reduce((sum, r) => sum + r.deltaE, 0) / results.length,
          avgDiffPercent: results.reduce((sum, r) => sum + r.diffPixelPercent, 0) / results.length,
        }
      : null

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} disablePointerDismissal>
      <DialogContent
        showCloseButton={false}
        backdropClassName="bg-black/80"
        className="ui-radius-lg w-full max-w-6xl max-h-[90vh] flex flex-col border border-transparent"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Grid3X3 size={20} className="text-accent" />
            <DialogTitle className="text-lg font-semibold text-text-primary">
              Batch Comparison (WEBGL-013)
            </DialogTitle>
          </div>
          <button
            aria-label="Close batch comparison"
            onClick={onClose}
            className="surface-control ui-radius-sm border p-2 text-text-secondary hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: File Selection */}
          <div className="w-64 border-r border-border flex flex-col">
            <div className="p-4 border-b border-border">
              <div className="text-sm text-text-secondary mb-2">Select Images to Compare</div>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="surface-control flex-1 ui-radius-md border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
                >
                  Select All
                </button>
                <button
                  onClick={clearSelection}
                  className="surface-control flex-1 ui-radius-md border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {imageFiles.length === 0 ? (
                <div className="text-center text-text-muted py-8">
                  <Upload size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No images in library</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {imageFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => toggleFile(file.id)}
                      className={`surface-control-elevation w-full ui-radius-md flex items-center gap-2 border px-2 py-1.5 text-sm text-left ${
                        selectedFiles.includes(file.id)
                          ? 'border-accent bg-accent/20 text-text-primary'
                          : 'surface-control text-text-secondary'
                      }`}
                    >
                      {file.thumbnail && (
                        <img src={file.thumbnail} alt="" className="w-8 h-8 object-cover rounded" />
                      )}
                      <span className="truncate flex-1">{file.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border">
              <div className="text-sm text-text-secondary mb-2">
                {selectedFiles.length} files selected
              </div>
              {isProcessing ? (
                <div className="space-y-2">
                  <div className="h-2 bg-surface-alt ui-radius-md overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <button
                    onClick={stopProcessing}
                    className="surface-control-elevation ui-radius-md flex w-full items-center justify-center gap-2 border border-error bg-error px-4 py-2 text-text-primary"
                  >
                    <Pause size={16} />
                    Stop
                  </button>
                </div>
              ) : (
                <button
                  onClick={runBatchComparison}
                  disabled={selectedFiles.length < 2}
                  className="surface-control-elevation ui-radius-md flex w-full items-center justify-center gap-2 border border-accent bg-accent px-4 py-2 text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Play size={16} />
                  Compare ({Math.floor(
                    (selectedFiles.length * (selectedFiles.length - 1)) / 2,
                  )}{' '}
                  pairs)
                </button>
              )}
            </div>
          </div>

          {/* Right Panel: Results */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Summary Stats */}
            {summaryStats && (
              <div className="px-6 py-3 border-b border-border bg-surface-alt">
                <div className="text-xs text-text-secondary uppercase tracking-wide mb-2">
                  Summary
                </div>
                <div className="grid grid-cols-5 gap-4 text-sm">
                  <div>
                    <div className="text-text-muted">Avg SSIM</div>
                    <div className="text-text-primary font-mono">
                      {summaryStats.avgSSIM.toFixed(4)}
                    </div>
                  </div>
                  <div>
                    <div className="text-text-muted">Min SSIM</div>
                    <div className="text-red-400 font-mono">{summaryStats.minSSIM.toFixed(4)}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">Max SSIM</div>
                    <div className="text-green-400 font-mono">
                      {summaryStats.maxSSIM.toFixed(4)}
                    </div>
                  </div>
                  <div>
                    <div className="text-text-muted">Avg Delta E</div>
                    <div className="text-text-primary font-mono">
                      {summaryStats.avgDeltaE.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-text-muted">Avg Diff %</div>
                    <div className="text-text-primary font-mono">
                      {summaryStats.avgDiffPercent.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Toolbar */}
            <div className="px-6 py-3 border-b border-border flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary">Sort by:</span>
                <Select
                  aria-label="Sort by"
                  value={sortBy}
                  onValueChange={(value) => setSortBy(value as typeof sortBy)}
                  options={[
                    { value: 'ssim', label: 'SSIM' },
                    { value: 'deltaE', label: 'Delta E' },
                    { value: 'diffPixelPercent', label: 'Diff %' },
                  ]}
                  className="surface-control h-auto w-auto ui-radius-md border px-2 py-1 text-sm text-text-primary"
                />
                <button
                  onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="surface-control ui-radius-sm border p-1 text-text-secondary hover:text-text-primary"
                >
                  {sortOrder === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Filter size={16} className="text-text-secondary" />
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={showOnlyDifferent}
                    onChange={(e) => setShowOnlyDifferent(e.target.checked)}
                    className="ui-radius-sm"
                  />
                  Only different
                </label>
              </div>

              <div className="flex-1" />

              <div className="flex items-center gap-2">
                <button
                  onClick={exportJSON}
                  disabled={results.length === 0}
                  className="surface-control flex items-center gap-1 ui-radius-md border px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
                >
                  <FileJson size={14} />
                  JSON
                </button>
                <button
                  onClick={exportCSV}
                  disabled={results.length === 0}
                  className="surface-control flex items-center gap-1 ui-radius-md border px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
                >
                  <FileSpreadsheet size={14} />
                  CSV
                </button>
              </div>
            </div>

            {/* Results Table */}
            <div className="flex-1 overflow-auto">
              {filteredResults.length === 0 ? (
                <div className="flex items-center justify-center h-full text-text-muted">
                  {results.length === 0
                    ? 'Select files and run comparison'
                    : 'No results match current filters'}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-surface-alt sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 text-text-secondary font-medium">
                        File A
                      </th>
                      <th className="text-left px-4 py-2 text-text-secondary font-medium">
                        File B
                      </th>
                      <th className="text-right px-4 py-2 text-text-secondary font-medium">SSIM</th>
                      <th className="text-right px-4 py-2 text-text-secondary font-medium">
                        Delta E
                      </th>
                      <th className="text-right px-4 py-2 text-text-secondary font-medium">
                        Diff %
                      </th>
                      <th className="text-right px-4 py-2 text-text-secondary font-medium">Peak</th>
                      <th className="text-right px-4 py-2 text-text-secondary font-medium">Mean</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((result, idx) => (
                      <tr
                        key={`${result.idA}-${result.idB}`}
                        className={idx % 2 === 0 ? 'bg-surface' : 'bg-surface-hover'}
                      >
                        <td className="px-4 py-2 text-text-primary truncate max-w-[150px]">
                          {result.nameA}
                        </td>
                        <td className="px-4 py-2 text-text-primary truncate max-w-[150px]">
                          {result.nameB}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-mono ${
                            result.ssim > 0.95
                              ? 'text-green-400'
                              : result.ssim > 0.8
                                ? 'text-yellow-400'
                                : 'text-red-400'
                          }`}
                        >
                          {result.ssim.toFixed(4)}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-mono ${
                            result.deltaE < 1
                              ? 'text-green-400'
                              : result.deltaE < 5
                                ? 'text-yellow-400'
                                : 'text-red-400'
                          }`}
                        >
                          {result.deltaE.toFixed(2)}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-mono ${
                            result.diffPixelPercent < 1
                              ? 'text-green-400'
                              : result.diffPixelPercent < 10
                                ? 'text-yellow-400'
                                : 'text-red-400'
                          }`}
                        >
                          {result.diffPixelPercent.toFixed(1)}%
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-text-secondary">
                          {result.peakDifference.toFixed(0)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-text-secondary">
                          {result.meanDifference.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-2 border-t border-border text-xs text-text-muted">
              Showing {filteredResults.length} of {results.length} results
            </div>
          </div>
        </div>
        {/* Hidden canvas for processing */}
        <canvas ref={canvasRef} className="hidden" width={640} height={480} />
      </DialogContent>
    </Dialog>
  )
}

// Toggle button for batch comparison
export function BatchComparisonToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="surface-control ui-radius-md border p-2 text-text-secondary hover:text-text-primary transition-colors"
      title="Batch Comparison (WEBGL-013)"
    >
      <Grid3X3 size={16} />
    </button>
  )
}
