import { Link, X, Loader2, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { getFileNameFromUrl, isSupportedMediaFile } from '../../lib/media/fileTypes'
import { captureMediaImport } from '../../lib/media/importRequest'
import { cn } from '../../lib/utils'
import { isMediaImportCurrent, useMediaStore } from '../../stores/mediaStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { Button, ElevatedSurface } from '../ui'

interface URLImportProps {
  isOpen: boolean
  onClose: () => void
}

export function URLImport({ isOpen, onClose }: URLImportProps) {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const { addFile } = useMediaStore()
  const { addClip } = useTimelineStore()

  const activeRequest = useRef<AbortController | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelImport = () => {
    activeRequest.current?.abort()
    activeRequest.current = null
    if (closeTimer.current !== null) clearTimeout(closeTimer.current)
    closeTimer.current = null
  }
  useEffect(() => cancelImport, [isOpen])

  const handleClose = () => {
    cancelImport()
    setIsLoading(false)
    setSuccess(false)
    onClose()
  }

  const validateUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  const handleImport = async () => {
    if (activeRequest.current) return
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    if (!validateUrl(url)) {
      setError('Please enter a valid HTTP or HTTPS URL')
      return
    }

    if (closeTimer.current !== null) clearTimeout(closeTimer.current)
    closeTimer.current = null
    const controller = new AbortController()
    const request = captureMediaImport(controller.signal)
    activeRequest.current = controller
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Fetch the media
      const response = await fetch(url, {
        signal: request,
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type') || ''
      const blob = await response.blob()
      if (request.aborted) return

      // Apply the same MIME/extension policy as local imports. URL.pathname avoids
      // query/hash suffixes interfering with extension detection.
      const fileName = getFileNameFromUrl(url) || `imported-${Date.now()}`
      const file = new File([blob], fileName, { type: blob.type || contentType })
      if (!isSupportedMediaFile(file)) {
        throw new Error('Unsupported media type. Please use a video or image URL.')
      }

      // Add to media store
      const mediaFile = await addFile(file, request)
      if (!isMediaImportCurrent(mediaFile, request)) return

      // Auto-add to timeline if tracks are empty
      const tracks = useTimelineStore.getState().tracks
      const trackA = tracks.find((t) => t.type === 'a')
      const trackB = tracks.find((t) => t.type === 'b')

      if (trackA && trackA.clips.length === 0 && trackA.acceptedTypes.includes(mediaFile.type)) {
        addClip(trackA.id, mediaFile.id, 0, mediaFile.duration || 10)
      } else if (
        trackB &&
        trackB.clips.length === 0 &&
        trackB.acceptedTypes.includes(mediaFile.type)
      ) {
        addClip(trackB.id, mediaFile.id, 0, mediaFile.duration || 10)
      }

      setSuccess(true)
      setUrl('')
      closeTimer.current = setTimeout(() => {
        if (!request.aborted) handleClose()
      }, 1000)
    } catch (err) {
      if (request.aborted) return
      console.error('URL import error:', err)
      setError(err instanceof Error ? err.message : 'Failed to import from URL')
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null
        setIsLoading(false)
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <ElevatedSurface asChild offset={3}>
        <div className="ui-radius-lg border border-transparent p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Link className="w-5 h-5" />
              Import from URL
            </h2>
            <button onClick={handleClose} className="surface-control ui-radius-sm border p-1">
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Media URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className={cn(
                  'surface-control ui-radius-md w-full border px-3 py-2 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2',
                  error ? '!border-error focus:ring-error' : 'focus:ring-accent',
                )}
                disabled={isLoading}
                onKeyDown={(e) => e.key === 'Enter' && handleImport()}
              />
              <p className="text-xs text-text-muted mt-1">
                Direct HTTP(S) media URLs only. Some sites may block direct browser access.
              </p>
              <div className="ui-radius-md mt-3 border border-border/60 p-3 text-xs leading-relaxed text-text-muted">
                URL import connects directly to the site you enter to fetch that media. The imported
                media is processed locally, and your other local files are not sent there.
                <a
                  href="/privacy/#external-communication"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="URL import privacy details (opens in a new tab)"
                  className="mt-2 inline-flex items-center gap-1 text-accent hover:underline"
                >
                  Privacy details
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-error text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 text-green-500 text-sm">
                <CheckCircle className="w-4 h-4" />
                Successfully imported!
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={isLoading || !url.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import'
                )}
              </Button>
            </div>
          </div>
        </div>
      </ElevatedSurface>
    </div>
  )
}
