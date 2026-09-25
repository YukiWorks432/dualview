import { Upload, Film, Image, AlertCircle, Link, Clipboard, Monitor } from 'lucide-react'
import { useCallback, useState, useEffect } from 'react'

import { SUPPORTED_MEDIA_ACCEPT, isSupportedMediaFile } from '../../lib/media/fileTypes'
import { captureScreenAsFile, isScreenCaptureSupported } from '../../lib/screenCapture'
import { cn } from '../../lib/utils'
import { useMediaStore } from '../../stores/mediaStore'
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
  const { addClip, tracks } = useTimelineStore()

  // Clipboard paste handler (IMPORT-002)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
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
              const mediaFile = await addFile(file)

              // Auto-add to timeline
              const trackA = tracks.find((t) => t.type === 'a')
              const trackB = tracks.find((t) => t.type === 'b')

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
  }, [addFile, addClip, tracks, onUpload])

  // Handle files with optional target track ('a', 'b', or 'auto' for alternating)
  const handleFiles = useCallback(
    async (files: FileList | null, targetTrack: 'a' | 'b' | 'auto' = 'auto') => {
      if (!files || files.length === 0) return

      setIsUploading(true)
      setError(null)
      setUploadProgress({ current: 0, total: files.length })

      const invalidFiles: string[] = []

      // Track cumulative positions for sequential placement
      let nextStartTimeA = 0
      let nextStartTimeB = 0

      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        // Delivery review intentionally accepts only images and videos.
        if (!isSupportedMediaFile(file)) {
          invalidFiles.push(file.name)
          setUploadProgress((prev) => ({ ...prev, current: i + 1 }))
          continue
        }

        try {
          setUploadProgress({ current: i + 1, total: files.length })
          const mediaFile = await addFile(file)
          const duration = mediaFile.duration || 10

          // Auto-add to timeline based on target track
          const trackA = tracks.find((t) => t.type === 'a')
          const trackB = tracks.find((t) => t.type === 'b')

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
            if (i === 0 && trackA) {
              addClip(trackA.id, mediaFile.id, nextStartTimeA, duration)
              nextStartTimeA += duration
            } else if (i === 1 && trackB) {
              addClip(trackB.id, mediaFile.id, nextStartTimeB, duration)
              nextStartTimeB += duration
            } else if (i % 2 === 0 && trackA) {
              addClip(trackA.id, mediaFile.id, nextStartTimeA, duration)
              nextStartTimeA += duration
            } else if (trackB) {
              addClip(trackB.id, mediaFile.id, nextStartTimeB, duration)
              nextStartTimeB += duration
            }
          }
        } catch (error) {
          console.error('Failed to add file:', error)
          invalidFiles.push(file.name)
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
    [addFile, addClip, tracks, onUpload],
  )

  // General drop handler (auto mode)
  const handleDropGeneral = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOverGeneral(false)
      handleFiles(e.dataTransfer.files, 'auto')
    },
    [handleFiles],
  )

  // Track A drop handler
  const handleDropA = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOverA(false)
      handleFiles(e.dataTransfer.files, 'a')
    },
    [handleFiles],
  )

  // Track B drop handler
  const handleDropB = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOverB(false)
      handleFiles(e.dataTransfer.files, 'b')
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
      handleFiles(target.files, 'a')
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
      handleFiles(target.files, 'b')
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
      handleFiles(target.files, 'auto')
    }
    input.click()
  }

  const handleScreenCapture = async () => {
    if (!isScreenCaptureSupported()) {
      setError('Screen capture is not supported in this browser')
      setTimeout(() => setError(null), 3000)
      return
    }

    setIsCapturing(true)
    setError(null)

    try {
      const file = await captureScreenAsFile()
      const mediaFile = await addFile(file)

      // Auto-add to timeline
      const trackA = tracks.find((t) => t.type === 'a')
      const trackB = tracks.find((t) => t.type === 'b')

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
            isDragOverA
              ? 'border-orange-500 shadow-[0_0_0_1px_rgba(249,115,22,0.22)]'
              : 'border-orange-500/40 hover:border-orange-500',
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
                isDragOverA ? 'bg-orange-500/30' : 'bg-orange-500/10 group-hover:bg-orange-500/20',
              )}
            >
              <Upload
                className={cn(
                  'h-5 w-5',
                  isDragOverA
                    ? 'text-orange-500'
                    : 'text-orange-500/70 group-hover:text-orange-500',
                )}
              />
            </div>
            <p
              className={cn(
                'text-center text-xs font-medium',
                isDragOverA ? 'text-orange-500' : 'text-text-primary',
              )}
            >
              {isDragOverA ? 'Drop for A' : 'Media A'}
            </p>
            <p className="mt-0.5 text-[10px] text-text-muted">Track A</p>
          </div>
        </ElevatedSurface>

        {/* Media B Drop Zone */}
        <ElevatedSurface
          offset={1}
          className={cn(
            'surface-interactive ui-radius-lg group cursor-pointer border-2 border-dashed transition-[border-color,box-shadow,opacity] duration-150',
            isDragOverB
              ? 'border-lime-400 shadow-[0_0_0_1px_rgba(163,230,53,0.22)]'
              : 'border-lime-400/40 hover:border-lime-400',
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
                isDragOverB ? 'bg-lime-400/30' : 'bg-lime-400/10 group-hover:bg-lime-400/20',
              )}
            >
              <Upload
                className={cn(
                  'h-5 w-5',
                  isDragOverB ? 'text-lime-400' : 'text-lime-400/70 group-hover:text-lime-400',
                )}
              />
            </div>
            <p
              className={cn(
                'text-center text-xs font-medium',
                isDragOverB ? 'text-lime-400' : 'text-text-primary',
              )}
            >
              {isDragOverB ? 'Drop for B' : 'Media B'}
            </p>
            <p className="mt-0.5 text-[10px] text-text-muted">Track B</p>
          </div>
        </ElevatedSurface>
      </div>

      {/* General drop zone for both */}
      <ElevatedSurface
        offset={1}
        className={cn(
          'surface-interactive ui-radius-lg group cursor-pointer border-2 border-dashed transition-[border-color,box-shadow,opacity] duration-150',
          isDragOverGeneral
            ? 'border-accent shadow-[0_0_0_1px_rgba(255,87,34,0.2)]'
            : 'border-border hover:border-accent/60',
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
              isDragOverGeneral ? 'text-accent' : 'text-text-muted',
            )}
          >
            {isUploading
              ? `Uploading ${uploadProgress.current}/${uploadProgress.total}...`
              : isDragOverGeneral
                ? 'Drop to add to both tracks'
                : 'Drop multiple files (auto A/B)'}
          </p>
          <div className="mt-2 flex gap-2">
            <Film className="h-3 w-3 text-text-muted/50" />
            <Image className="w-3 h-3 text-text-muted/50" />
          </div>
        </div>
      </ElevatedSurface>

      {/* Import options */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIsURLImportOpen(true)
          }}
          className="surface-control ui-radius-md flex items-center justify-center gap-1 border px-2 py-2 text-xs text-text-secondary transition-colors hover:text-text-primary"
        >
          <Link className="w-3 h-3" />
          URL
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            navigator.clipboard.read().catch(() => {})
          }}
          className="surface-control ui-radius-md flex items-center justify-center gap-1 border px-2 py-2 text-xs text-text-secondary transition-colors hover:text-text-primary"
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
            'surface-control ui-radius-md flex items-center justify-center gap-1 border px-2 py-2 text-xs text-text-secondary transition-colors hover:text-text-primary',
            isCapturing && 'opacity-50 cursor-wait',
          )}
          title="Capture screen region"
        >
          <Monitor className="w-3 h-3" />
          {isCapturing ? '...' : 'Screen'}
        </button>
      </div>

      {error && (
        <div className="ui-radius-md flex items-center gap-2 border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* URL Import Modal */}
      <URLImport isOpen={isURLImportOpen} onClose={() => setIsURLImportOpen(false)} />
    </div>
  )
}
