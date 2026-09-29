import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import { calculateCommonAnalysisDimensions } from '../lib/difference/geometry'
import type { NormalizedDifferenceRegion } from '../lib/difference/regions'
import {
  getBaseMinimumRegionPixels,
  scaleMinimumRegionPixels,
  sensitivityToPixelmatchThreshold,
} from '../lib/difference/settings'
import type {
  DifferenceWorkerRequest,
  DifferenceWorkerResponse,
} from '../lib/difference/workerProtocol'
import {
  getVisualFrameDimensions,
  isVisualFrameReady,
  type VisualFrameElement,
} from '../lib/media/frameSource'
import { calculateMediaTime } from '../lib/media/timeline'
import { useDifferenceHighlightStore } from '../stores/differenceHighlightStore'
import { usePlaybackStore } from '../stores/playbackStore'
import type { TimelineClip } from '../types'

const PLAYBACK_ANALYSIS_INTERVAL_MS = 200
const PLAYBACK_SYNC_TOLERANCE_SECONDS = 0.08
const PAUSED_SYNC_TOLERANCE_SECONDS = 0.02
const FULL_RESOLUTION_MAX_PIXELS = 12_000_000
const MAX_REGIONS = 80

interface UseDifferenceRegionsOptions {
  sourceARef: RefObject<VisualFrameElement | null>
  sourceBRef: RefObject<VisualFrameElement | null>
  clipA: TimelineClip | null
  clipB: TimelineClip | null
}

export interface DifferenceRegionsResult {
  regions: NormalizedDifferenceRegion[]
  aspectRatio: number
  notifyFrameReady: () => void
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function waitForPresentedVideoFrame(video: HTMLVideoElement): Promise<number | null> {
  if (
    video.paused ||
    typeof video.requestVideoFrameCallback !== 'function' ||
    typeof video.cancelVideoFrameCallback !== 'function'
  ) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    let settled = false
    const callbackId = video.requestVideoFrameCallback((_now, metadata) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      resolve(metadata.mediaTime)
    })
    const timeoutId = window.setTimeout(() => {
      if (settled) return
      settled = true
      video.cancelVideoFrameCallback(callbackId)
      resolve(null)
    }, 120)
  })
}

async function waitForSourceAtTime(
  source: VisualFrameElement,
  clip: TimelineClip,
  timelineTime: number,
  isPlaying: boolean,
): Promise<boolean> {
  const deadline = performance.now() + (isPlaying ? 180 : 700)
  const expectedMediaTime = calculateMediaTime(timelineTime, clip)
  if (expectedMediaTime === null) return false

  const presentedMediaTime =
    source instanceof HTMLVideoElement ? await waitForPresentedVideoFrame(source) : null
  const tolerance = isPlaying
    ? PLAYBACK_SYNC_TOLERANCE_SECONDS
    : PAUSED_SYNC_TOLERANCE_SECONDS

  while (performance.now() <= deadline) {
    if (isVisualFrameReady(source)) {
      if (source instanceof HTMLImageElement) return true

      if (source instanceof HTMLVideoElement) {
        const observedMediaTime = presentedMediaTime ?? source.currentTime
        if (!source.seeking && Math.abs(observedMediaTime - expectedMediaTime) <= tolerance) {
          return true
        }
      } else {
        const renderedTimelineTime = Number(source.dataset.frameTimelineTime)
        if (
          Number.isFinite(renderedTimelineTime) &&
          Math.abs(renderedTimelineTime - timelineTime) <= tolerance
        ) {
          return true
        }
      }
    }

    await nextAnimationFrame()
  }

  return false
}

function captureSource(
  source: VisualFrameElement,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): ImageData | null {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  context.clearRect(0, 0, width, height)
  context.drawImage(source, 0, 0, width, height)
  return context.getImageData(0, 0, width, height)
}

function analyzeInWorker(
  worker: Worker,
  request: DifferenceWorkerRequest,
): Promise<DifferenceWorkerResponse> {
  return new Promise((resolve) => {
    const cleanup = () => {
      worker.removeEventListener('message', handleMessage)
      worker.removeEventListener('error', handleError)
    }
    const handleMessage = (event: MessageEvent<DifferenceWorkerResponse>) => {
      if (event.data.id !== request.id) return
      cleanup()
      resolve(event.data)
    }
    const handleError = () => {
      cleanup()
      resolve({
        type: 'error',
        id: request.id,
        message: 'Difference analysis worker failed',
      })
    }

    worker.addEventListener('message', handleMessage)
    worker.addEventListener('error', handleError)
    worker.postMessage(request, [request.a, request.b])
  })
}

export function useDifferenceRegions({
  sourceARef,
  sourceBRef,
  clipA,
  clipB,
}: UseDifferenceRegionsOptions): DifferenceRegionsResult {
  const enabled = useDifferenceHighlightStore((state) => state.enabled)
  const sensitivity = useDifferenceHighlightStore((state) => state.sensitivity)
  const noiseFilter = useDifferenceHighlightStore((state) => state.noiseFilter)
  const analysisQuality = useDifferenceHighlightStore((state) => state.analysisQuality)
  const setRuntime = useDifferenceHighlightStore((state) => state.setRuntime)
  const { currentTime, isPlaying, isExporting } = usePlaybackStore()

  const [regions, setRegions] = useState<NormalizedDifferenceRegion[]>([])
  const [aspectRatio, setAspectRatio] = useState(16 / 9)
  const [frameRevision, setFrameRevision] = useState(0)
  const [retryRevision, setRetryRevision] = useState(0)
  const workerRef = useRef<Worker | null>(null)
  const canvasARef = useRef<HTMLCanvasElement | null>(null)
  const canvasBRef = useRef<HTMLCanvasElement | null>(null)
  const requestIdRef = useRef(0)
  const inFlightRef = useRef(false)
  const queuedRef = useRef(false)
  const lastStartedAtRef = useRef(0)
  const signatureRef = useRef('')

  const signature = [
    clipA?.id ?? 'no-a',
    clipA?.mediaId ?? 'no-a-media',
    clipB?.id ?? 'no-b',
    clipB?.mediaId ?? 'no-b-media',
    enabled ? 'enabled' : 'disabled',
    sensitivity,
    noiseFilter,
    analysisQuality,
    isPlaying ? 'playing' : currentTime,
  ].join('|')
  signatureRef.current = signature

  const notifyFrameReady = useCallback(() => {
    setFrameRevision((revision) => revision + 1)
  }, [])

  useEffect(() => {
    const handleVisibilityChange = () => setFrameRevision((revision) => revision + 1)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current += 1
      inFlightRef.current = false
      queuedRef.current = false
      workerRef.current?.terminate()
      workerRef.current = null
      return
    }

    if (typeof Worker === 'undefined') {
      setRuntime({
        status: 'unavailable',
        message: 'Difference highlighting requires Web Worker support',
        regionCount: 0,
        approximate: false,
      })
      return
    }

    const worker = new Worker(new URL('../workers/difference.worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker

    return () => {
      requestIdRef.current += 1
      inFlightRef.current = false
      queuedRef.current = false
      worker.terminate()
      if (workerRef.current === worker) workerRef.current = null
    }
  }, [enabled, setRuntime])

  useEffect(() => {
    if (!enabled) {
      setRegions([])
      return
    }

    if (isExporting || document.visibilityState === 'hidden') {
      setRegions([])
      setRuntime({
        status: 'idle',
        message: isExporting
          ? 'Difference analysis pauses during export'
          : 'Difference analysis pauses while this tab is hidden',
        regionCount: 0,
        approximate: false,
      })
      return
    }

    if (!clipA || !clipB) {
      setRegions([])
      setRuntime({
        status: 'unavailable',
        message: 'Both A and B need an active clip at the current timeline position',
        regionCount: 0,
        approximate: false,
      })
      return
    }

    const now = performance.now()
    if (isPlaying && now - lastStartedAtRef.current < PLAYBACK_ANALYSIS_INTERVAL_MS) return

    if (inFlightRef.current) {
      queuedRef.current = true
      return
    }

    const sourceA = sourceARef.current
    const sourceB = sourceBRef.current
    const worker = workerRef.current
    if (!sourceA || !sourceB || !worker) {
      setRuntime({
        status: 'syncing',
        message: 'Waiting for both A/B frames',
        regionCount: 0,
        approximate: isPlaying,
      })
      return
    }

    const sampleTime = isPlaying ? usePlaybackStore.getState().currentTime : currentTime
    if (
      calculateMediaTime(sampleTime, clipA) === null ||
      calculateMediaTime(sampleTime, clipB) === null
    ) {
      setRegions([])
      setRuntime({
        status: 'unavailable',
        message: 'Both A and B need an active clip at the sampled timeline position',
        regionCount: 0,
        approximate: isPlaying,
      })
      return
    }

    const runSignature = signatureRef.current
    const run = async () => {
      inFlightRef.current = true
      queuedRef.current = false
      lastStartedAtRef.current = performance.now()
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId

      const isCurrent = () =>
        requestId === requestIdRef.current && runSignature === signatureRef.current

      try {
        setRuntime({
          status: 'syncing',
          message: 'Waiting for synchronized A/B frames…',
          regionCount: 0,
          approximate: isPlaying,
        })

        const [readyA, readyB] = await Promise.all([
          waitForSourceAtTime(sourceA, clipA, sampleTime, isPlaying),
          waitForSourceAtTime(sourceB, clipB, sampleTime, isPlaying),
        ])

        if (!isCurrent()) return
        if (!readyA || !readyB) {
          setRegions([])
          setRuntime({
            status: 'syncing',
            message: 'Waiting for the matching displayed frames…',
            regionCount: 0,
            approximate: isPlaying,
          })
          return
        }

        const dimensionsA = getVisualFrameDimensions(sourceA)
        const dimensionsB = getVisualFrameDimensions(sourceB)
        const analysisDimensions = calculateCommonAnalysisDimensions(dimensionsA, dimensionsB, {
          maxLongEdge:
            analysisQuality === 'full' ? Number.POSITIVE_INFINITY : isPlaying ? 960 : 1920,
          maxPixels: FULL_RESOLUTION_MAX_PIXELS,
        })

        if (!analysisDimensions.ok) {
          setRegions([])
          const message =
            analysisDimensions.reason === 'aspect-mismatch'
              ? 'A/B aspect ratios must match before regions can be compared'
              : analysisDimensions.reason === 'too-large'
                ? 'Full-resolution analysis exceeds the 12 MP safety limit; use Auto quality'
                : 'The current A/B frame dimensions are not ready'
          setRuntime({
            status: 'unavailable',
            message,
            regionCount: 0,
            approximate: false,
          })
          return
        }

        canvasARef.current ??= document.createElement('canvas')
        canvasBRef.current ??= document.createElement('canvas')
        const imageA = captureSource(
          sourceA,
          canvasARef.current,
          analysisDimensions.width,
          analysisDimensions.height,
        )
        const imageB = captureSource(
          sourceB,
          canvasBRef.current,
          analysisDimensions.width,
          analysisDimensions.height,
        )

        if (!imageA || !imageB) {
          setRuntime({
            status: 'unavailable',
            message: 'The current A/B frames could not be read for analysis',
            regionCount: 0,
            approximate: isPlaying,
          })
          return
        }

        setRuntime({
          status: 'analyzing',
          message: isPlaying ? 'Analyzing playback preview…' : 'Analyzing current frame…',
          regionCount: 0,
          approximate: isPlaying,
        })

        const minPixels = scaleMinimumRegionPixels(
          getBaseMinimumRegionPixels(noiseFilter),
          analysisDimensions.width,
          analysisDimensions.height,
        )
        const scaleReference = Math.max(1, analysisDimensions.width / 960)
        const request: DifferenceWorkerRequest = {
          type: 'analyze',
          id: requestId,
          a: imageA.data.buffer as ArrayBuffer,
          b: imageB.data.buffer as ArrayBuffer,
          width: analysisDimensions.width,
          height: analysisDimensions.height,
          threshold: sensitivityToPixelmatchThreshold(sensitivity),
          minPixels,
          mergeGap: Math.max(2, Math.round(3 * scaleReference)),
          padding: Math.max(2, Math.round(2 * scaleReference)),
          maxRegions: MAX_REGIONS,
        }
        const response = await analyzeInWorker(worker, request)

        if (!isCurrent()) return
        if (response.type === 'error') {
          setRegions([])
          setRuntime({
            status: 'unavailable',
            message: response.message,
            regionCount: 0,
            approximate: isPlaying,
          })
          return
        }

        setRegions(response.regions)
        setAspectRatio(analysisDimensions.aspectRatio)

        if (response.regions.length > 0) {
          setRuntime({
            status: 'different',
            message: isPlaying
              ? `${response.regions.length} highlighted regions • playback preview`
              : `${response.regions.length} highlighted regions on the current frame`,
            regionCount: response.regions.length,
            approximate: isPlaying,
          })
        } else {
          setRuntime({
            status: 'same',
            message:
              response.diffPixelCount > 0
                ? 'Differences are below the current region filter'
                : 'No highlighted differences on the current frame',
            regionCount: 0,
            approximate: isPlaying,
          })
        }
      } catch (error) {
        if (!isCurrent()) return
        setRegions([])
        setRuntime({
          status: 'unavailable',
          message: error instanceof Error ? error.message : 'Difference analysis failed',
          regionCount: 0,
          approximate: isPlaying,
        })
      } finally {
        inFlightRef.current = false
        if (queuedRef.current) {
          queuedRef.current = false
          setRetryRevision((revision) => revision + 1)
        }
      }
    }

    void run()
  }, [
    analysisQuality,
    clipA,
    clipB,
    currentTime,
    enabled,
    frameRevision,
    isExporting,
    isPlaying,
    noiseFilter,
    retryRevision,
    sensitivity,
    setRuntime,
    sourceARef,
    sourceBRef,
  ])

  return {
    regions,
    aspectRatio,
    notifyFrameReady,
  }
}
