/**
 * useFilmstrip Hook (FILMSTRIP-001, FILMSTRIP-002)
 *
 * Manages filmstrip extraction and caching for video clips.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  extractFilmstrip,
  getCachedFilmstrip,
  type FilmstripData,
  type FilmstripConfig,
} from '../lib/filmstripExtractor'
import { useMediaStore } from '../stores/mediaStore'

interface UseFilmstripOptions extends FilmstripConfig {
  enabled?: boolean
}

interface UseFilmstripResult {
  filmstrip: FilmstripData | null
  isLoading: boolean
  error: string | null
  reload: () => void
}

function useStableFilmstripConfig(options: UseFilmstripOptions): {
  enabled: boolean
  config: FilmstripConfig
} {
  const {
    enabled = true,
    frameInterval,
    thumbnailWidth,
    thumbnailHeight,
    maxFrames,
  } = options
  const config = useMemo(
    () => ({ frameInterval, thumbnailWidth, thumbnailHeight, maxFrames }),
    [frameInterval, thumbnailWidth, thumbnailHeight, maxFrames],
  )

  return { enabled, config }
}

/**
 * Hook to get filmstrip data for a video media item
 */
export function useFilmstrip(
  mediaId: string | undefined,
  options: UseFilmstripOptions = {},
): UseFilmstripResult {
  const { enabled, config } = useStableFilmstripConfig(options)
  const [filmstrip, setFilmstrip] = useState<FilmstripData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadTrigger, setReloadTrigger] = useState(0)

  const getFile = useMediaStore((state) => state.getFile)

  const reload = useCallback(() => {
    setReloadTrigger((prev) => prev + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadFilmstrip = async () => {
      // Keep effect-driven state changes asynchronous so stale work can be cancelled
      // before it reaches React state.
      await Promise.resolve()
      if (cancelled) return

      if (!mediaId || !enabled) {
        setFilmstrip(null)
        setIsLoading(false)
        setError(null)
        return
      }

      const media = getFile(mediaId)
      if (!media || media.type !== 'video') {
        setFilmstrip(null)
        setIsLoading(false)
        setError(null)
        return
      }

      const cached = getCachedFilmstrip(mediaId)
      if (cached) {
        setFilmstrip(cached)
        setIsLoading(false)
        setError(null)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const result = await extractFilmstrip(mediaId, media.url, media.duration || 10, config)
        if (cancelled) return

        setFilmstrip(result)
        if (!result) {
          setError('Failed to extract frames')
        }
      } catch (err) {
        if (cancelled) return
        console.error('Filmstrip extraction error:', err)
        setError(err instanceof Error ? err.message : 'Extraction failed')
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadFilmstrip()

    return () => {
      cancelled = true
    }
  }, [mediaId, enabled, getFile, reloadTrigger, config])

  return { filmstrip, isLoading, error, reload }
}

/**
 * Hook to get filmstrips for multiple media items
 */
export function useFilmstrips(
  mediaIds: string[],
  options: UseFilmstripOptions = {},
): Map<string, FilmstripData | null> {
  const { enabled, config } = useStableFilmstripConfig(options)
  const [filmstrips, setFilmstrips] = useState<Map<string, FilmstripData | null>>(new Map())
  const mediaIdsKey = JSON.stringify(mediaIds)

  const getFile = useMediaStore((state) => state.getFile)

  useEffect(() => {
    let cancelled = false

    const extractAll = async () => {
      await Promise.resolve()
      if (cancelled) return

      const requestedMediaIds = JSON.parse(mediaIdsKey) as string[]
      if (!enabled || requestedMediaIds.length === 0) {
        setFilmstrips(new Map())
        return
      }

      const results = new Map<string, FilmstripData | null>()

      for (const mediaId of requestedMediaIds) {
        const cached = getCachedFilmstrip(mediaId)
        if (cached) {
          results.set(mediaId, cached)
          continue
        }

        const media = getFile(mediaId)
        if (!media || media.type !== 'video') {
          results.set(mediaId, null)
          continue
        }

        try {
          const filmstrip = await extractFilmstrip(mediaId, media.url, media.duration || 10, config)
          if (cancelled) return
          results.set(mediaId, filmstrip)
        } catch {
          if (cancelled) return
          results.set(mediaId, null)
        }
      }

      if (!cancelled) {
        setFilmstrips(results)
      }
    }

    void extractAll()

    return () => {
      cancelled = true
    }
  }, [mediaIdsKey, enabled, getFile, config])

  return filmstrips
}
