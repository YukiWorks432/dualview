import {
  AlertCircle,
  Clipboard,
  ExternalLink,
  FilePlus2,
  Film,
  Image,
  Link,
  Monitor,
} from 'lucide-react'
import { useCallback, useState, useEffect } from 'react'

import { SUPPORTED_MEDIA_ACCEPT, isSupportedMediaFile } from '../../lib/media/fileTypes'
import { captureMediaImport } from '../../lib/media/importRequest'
import { captureScreenAsFile, isScreenCaptureSupported } from '../../lib/screenCapture'
import { cn } from '../../lib/utils'
import { isMediaImportCurrent, useMediaStore } from '../../stores/mediaStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { ElevatedSurface } from '../ui'
import { URLImport } from './URLImport'

interface MediaUploadProps {
  className?: string
  onUpload?: () => void
}

export function MediaUpload({ className, onUpload }: MediaUploadProps) {
  const [isDragOverA, setIsDragOverA] = useState(false)
  const [isDragOverB, setIsDragOverB] = useState(false)
  const [isDragOverGeneral, setIsDragOverGeneral] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [isURLImportOpen, setIsURLImportOpen] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)

  const { addFile } = useMediaStore()
  const { addClip } = useTimelineStore()

  // Clipboard paste handler (IMPORT-002)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const request = captureMediaImport()
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]

        // Handle image paste
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            setIsUploading(true)
            try {
              const mediaFile = await addFile(file, request)
              if (!isMediaImportCurrent(mediaFile, request)) return

              // Auto-add to timeline
              const trackA = useTimelineStore.getState().tracks.find((t) => t.type === 'a')
              const trackB = useTimelineStore.getState().tracks.find((t) => t.type === 'b')

              if (trackA && trackA.clips.length === 0) {
                addClip(trackA.id, mediaFile.id, 0, mediaFile.duration || 10)
              } else if (trackB && trackB.clips.length === 0) {
                addClip(trackB.id, mediaFile.id, 0, mediaFile.duration || 10)
              }

              onUpload?.()
            } catch (err) {
              console.error('Failed to paste image:', err)
              setError('Failed to paste image')
              setTimeout(() => setError(null), 3000)
            } finally {
              setIsUploading(false)
            }
          }
          break
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [addFile, addClip, onUpload])

  // Handle files with optional target track ('a', 'b', or 'auto' for alternating)
  const handleFiles = useCallback(
    async (files: File[], targetTrack: 'a' | 'b' | 'auto' = 'auto') => {
      if (files.length === 0) return

      const request = captureMediaImport()
      const totalFiles = files.length
      setIsUploading(true)
      setError(null)
      setUploadProgress({ current: 0, total: totalFiles })

      const invalidFiles: string[] = []

      // Track cumulative positions for sequential placement
      let nextStartTimeA = 0
      let nextStartTimeB = 0
      let fileIndex = 0

      while (files.length > 0) {
        let sourceFile: File | undefined = files.shift()
        if (!sourceFile) break

        const sourceName = sourceFile.name
        const currentIndex = fileIndex
        fileIndex += 1

        // Delivery review intentionally accepts only images and videos.
        if (!isSupportedMediaFile(sourceFile)) {
          invalidFiles.push(sourceName)
          sourceFile = undefined
          setUploadProgress({ current: fileIndex, total: totalFiles })
          continue
        }

        try {
          setUploadProgress({ current: fileIndex, total: totalFiles })
          const mediaFile = await addFile(sourceFile, request)
          sourceFile = undefined
          if (!isMediaImportCurrent(mediaFile, request)) continue
          const duration = mediaFile.duration || 10

          // Auto-add to timeline based on target track
          const trackA = useTimelineStore.getState().tracks.find((t) => t.type === 'a')
          const trackB = useTimelineStore.getState().tracks.find((t) => t.type === 'b')

          if (targetTrack === 'a' && trackA) {
            // Add all files to Track A sequentially
            addClip(trackA.id, mediaFile.id, nextStartTimeA, duration)
            nextStartTimeA += duration
          } else if (targetTrack === 'b' && trackB) {
            // Add all files to Track B sequentially
            addClip(trackB.id, mediaFile.id, nextStartTimeB, duration)
            nextStartTimeB += duration
          } else {
            // Auto mode: first file to A, second to B
            if (currentIndex === 0 && trackA) {
              addClip(trackA.id, mediaFile.id, nextStartTimeA, duration)
              nextStartTimeA += duration
            } else if (currentIndex === 1 && trackB) {
              addClip(trackB.id, mediaFile.id, nextStartTimeB, duration)
              nextStartTimeB += duration
            } else if (currentIndex % 2 === 0 && trackA) {
              addClip(trackA.id, mediaFile.id, nextStartTimeA, duration)
              nextStartTimeA += duration
            } else if (trackB) {
              addClip(trackB.id, mediaFile.id, nextStartTimeB, duration)
              nextStartTimeB += duration
            }
          }
        } catch (error) {
          sourceFile = undefined
          console.error('Failed to add file:', error)
          invalidFiles.push(sourceName)
        }
      }

      if (invalidFiles.length > 0) {
        setError(`Unsupported files: ${invalidFiles.join(', ')}`)
        setTimeout(() => setError(null), 5000)
      }

      setIsUploading(false)
      setUploadProgress({ current: 0, total: 0 })
      onUpload?.()
    },
    [addFile, addClip, onUpload],
  )

  // General drop handler (auto mode)
  const handleDropGeneral = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOverGeneral(false)
      handleFiles(Array.from(e.dataTransfer.files), 'auto')
    },
    [handleFiles],
  )

  // Track A drop handler
  const handleDropA = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOverA(false)
      handleFiles(Array.from(e.dataTransfer.files), 'a')
    },
    [handleFiles],
  )

  // Track B drop handler
  const handleDropB = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOverB(false)
      handleFiles(Array.from(e.dataTransfer.files), 'b')
    },
    [handleFiles],
  )

  const handleDragOverGeneral = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverGeneral(true)
  }

  const handleDragLeaveGeneral = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverGeneral(false)
  }

  const handleDragOverA = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverA(true)
  }

  const handleDragLeaveA = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverA(false)
  }

  const handleDragOverB = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverB(true)
  }

  const handleDragLeaveB = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverB(false)
  }

  const handleClickA = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = SUPPORTED_MEDIA_ACCEPT
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      const files = target.files ? Array.from(target.files) : []
      target.value = ''
      input.onchange = null
      handleFiles(files, 'a')
    }
    input.click()
  }

  const handleClickB = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = SUPPORTED_MEDIA_ACCEPT
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      const files = target.files ? Array.from(target.files) : []
      target.value = ''
      input.onchange = null
      handleFiles(files, 'b')
    }
    input.click()
  }

  const handleClickGeneral = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = SUPPORTED_MEDIA_ACCEPT
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      const files = target.files ? Array.from(target.files) : []
      target.value = ''
      input.onchange = null
      handleFiles(files, 'auto')
    }
    input.click()
  }

  const handleScreenCapture = async () => {
    if (!isScreenCaptureSupported()) {
      setError('Screen capture is not supported in this browser')
      setTimeout(() => setError(null), 3000)
      return
    }

    const request = captureMediaImport()
    setIsCapturing(true)
    setError(null)

    try {
      const file = await captureScreenAsFile()
      const mediaFile = await addFile(file, request)
      if (!isMediaImportCurrent(mediaFile, request)) return

      // Auto-add to timeline
      const trackA = useTimelineStore.getState().tracks.find((t) => t.type === 'a')
      const trackB = useTimelineStore.getState().tracks.find((t) => t.type === 'b')

      if (trackA && trackA.clips.length === 0) {
        addClip(trackA.id, mediaFile.id, 0, mediaFile.duration || 10)
      } else if (trackB && trackB.clips.length === 0) {
        addClip(trackB.id, mediaFile.id, 0, mediaFile.duration || 10)
      }

      onUpload?.()
    } catch (err) {
      if ((err as Error).name !== 'NotAllowedError') {
        console.error('Screen capture failed:', err)
        setError('Screen capture failed')
        setTimeout(() => setError(null), 3000)
      }
    } finally {
      setIsCapturing(false)
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Track A and Track B drop zones side by side */}
      <div className="grid grid-cols-2 gap-2">
        {/* Media A Drop Zone */}
        <ElevatedSurface
          offset={1}
          className={cn(
            'surface-interactive ui-radius-lg group cursor-pointer border-2 border-dashed transition-[border-color,box-shadow,opacity] duration-150',
            isDragOverA ? 'border-compare-a' : 'border-compare-a/40 hover:border-compare-a',
            isUploading && 'pointer-events-none opacity-50',
          )}
          onDrop={handleDropA}
          onDragOver={handleDragOverA}
          onDragLeave={handleDragLeaveA}
          onClick={handleClickA}
        >
          <div className="flex flex-col items-center justify-center px-2 py-4">
            <div
              className={cn(
                'ui-radius-md mb-1 p-1.5 transition-colors',
                isDragOverA ? 'bg-compare-a/30' : 'bg-compare-a/10 group-hover:bg-compare-a/20',
              )}
            >
              <FilePlus2
                className={cn(
                  'h-5 w-5',
                  isDragOverA ? 'text-compare-a' : 'text-compare-a/70 group-hover:text-compare-a',
                )}
              />
            </div>
            <p
              className={cn(
                'text-center text-xs font-medium',
                isDragOverA ? 'text-compare-a' : 'text-foreground',
              )}
            >
              {isDragOverA ? 'Drop for A' : 'Media A'}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Track A</p>
          </div>
        </ElevatedSurface>

        {/* Media B Drop Zone */}
        <ElevatedSurface
          offset={1}
          className={cn(
            'surface-interactive ui-radius-lg group cursor-pointer border-2 border-dashed transition-[border-color,box-shadow,opacity] duration-150',
            isDragOverB ? 'border-compare-b' : 'border-compare-b/40 hover:border-compare-b',
            isUploading && 'pointer-events-none opacity-50',
          )}
          onDrop={handleDropB}
          onDragOver={handleDragOverB}
          onDragLeave={handleDragLeaveB}
          onClick={handleClickB}
        >
          <div className="flex flex-col items-center justify-center px-2 py-4">
            <div
              className={cn(
                'ui-radius-md mb-1 p-1.5 transition-colors',
                isDragOverB ? 'bg-compare-b/30' : 'bg-compare-b/10 group-hover:bg-compare-b/20',
              )}
            >
              <FilePlus2
                className={cn(
                  'h-5 w-5',
                  isDragOverB ? 'text-compare-b' : 'text-compare-b/70 group-hover:text-compare-b',
                )}
              />
            </div>
            <p
              className={cn(
                'text-center text-xs font-medium',
                isDragOverB ? 'text-compare-b' : 'text-foreground',
              )}
            >
              {isDragOverB ? 'Drop for B' : 'Media B'}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Track B</p>
          </div>
        </ElevatedSurface>
      </div>

      {/* General drop zone for both */}
      <ElevatedSurface
        offset={1}
        className={cn(
          'surface-interactive ui-radius-lg group cursor-pointer border-2 border-dashed transition-[border-color,box-shadow,opacity] duration-150',
          isDragOverGeneral
            ? 'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]'
            : 'border-border hover:border-primary/60',
          isUploading && 'pointer-events-none opacity-50',
        )}
        onDrop={handleDropGeneral}
        onDragOver={handleDragOverGeneral}
        onDragLeave={handleDragLeaveGeneral}
        onClick={handleClickGeneral}
      >
        <div className="flex flex-col items-center justify-center px-4 py-4">
          <p
            className={cn(
              'text-center text-xs',
              isDragOverGeneral ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {isUploading
              ? `Importing ${uploadProgress.current}/${uploadProgress.total}...`
              : isDragOverGeneral
                ? 'Drop to add to both tracks'
                : 'Drop multiple files (auto A/B)'}
          </p>
          <div className="mt-2 flex gap-2">
            <Film className="h-3 w-3 text-muted-foreground/50" />
            <Image className="w-3 h-3 text-muted-foreground/50" />
          </div>
        </div>
      </ElevatedSurface>

      <div className="ui-radius-md border border-border/60 px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground">
        <p>
          <strong className="font-semibold text-muted-foreground">Files are not uploaded.</strong>{' '}
          Comparison and analysis happen in your browser. Projects and media are saved in this
          browser so you can continue later.
        </p>
        <a
          href="/privacy/#local-processing"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Privacy and storage information (opens in a new tab)"
          className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
        >
          Privacy &amp; storage
          <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
        </a>
      </div>

      {/* Import options */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIsURLImportOpen(true)
          }}
          className="surface-control ui-radius-md flex items-center justify-center gap-1 border px-2 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Link className="w-3 h-3" />
          URL
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            navigator.clipboard.read().catch(() => {})
          }}
          className="surface-control ui-radius-md flex items-center justify-center gap-1 border px-2 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          title="Ctrl+V to paste images"
        >
          <Clipboard className="w-3 h-3" />
          Paste
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleScreenCapture()
          }}
          disabled={isCapturing}
          className={cn(
            'surface-control ui-radius-md flex items-center justify-center gap-1 border px-2 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground',
            isCapturing && 'opacity-50 cursor-wait',
          )}
          title="Capture screen region"
        >
          <Monitor className="w-3 h-3" />
          {isCapturing ? '...' : 'Screen'}
        </button>
      </div>

      {error && (
        <div className="ui-radius-md flex items-center gap-2 border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* URL Import Modal */}
      <URLImport isOpen={isURLImportOpen} onClose={() => setIsURLImportOpen(false)} />
    </div>
  )
}
