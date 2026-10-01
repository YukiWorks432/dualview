import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import { calculateCommonAnalysisDimensions } from '../lib/difference/geometry'
import type { NormalizedDifferenceRegion } from '../lib/difference/regions'
import {
  getBaseMinimumRegionPixels,
  scaleMinimumRegionPixels,
  sensitivityToColorThreshold,
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
import {
  isPresentedVideoFrameCurrent,
  type PresentedVideoFrame,
} from '../lib/media/presentedVideoFrame'
import { calculateMediaTime } from '../lib/media/timeline'
import { useDifferenceHighlightStore } from '../stores/differenceHighlightStore'
import { usePlaybackStore } from '../stores/playbackStore'
import type { TimelineClip } from '../types'

const AUTO_MAX_LONG_EDGE = 1920
const FULL_RESOLUTION_MAX_PIXELS = 12_000_000
const MAX_REGIONS = 80

interface DifferenceResult {
  signature: string
  regions: NormalizedDifferenceRegion[]
  aspectRatio: number
}

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

function createClipSignature(clip: TimelineClip | null): string {
  if (!clip) return 'none'

  return [
    clip.id,
    clip.mediaId,
    clip.startTime,
    clip.endTime,
    clip.inPoint,
    clip.outPoint,
    clip.speed,
    clip.reverse ? 1 : 0,
  ].join(':')
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

function isPausedSourceReady(
  source: VisualFrameElement,
  clip: TimelineClip,
  timelineTime: number,
): boolean {
  if (!isVisualFrameReady(source)) return false

  const expectedMediaTime = calculateMediaTime(timelineTime, clip)
  if (expectedMediaTime === null) return false

  if (source instanceof HTMLCanvasElement) {
    const frameStart = Number(source.dataset.frameMediaTime)
    const frameEnd = Number(source.dataset.frameMediaEndTime)
    const requestedMediaTime = Number(source.dataset.frameRequestedMediaTime)
    const seekGeneration = Number(source.dataset.frameSeekGeneration)
    const presentedGeneration = Number(source.dataset.framePresentedGeneration)
    return (
      Number.isFinite(frameStart) &&
      Number.isFinite(frameEnd) &&
      Number.isFinite(requestedMediaTime) &&
      Number.isFinite(seekGeneration) &&
      presentedGeneration === seekGeneration &&
      source.dataset.frameMediaId === clip.mediaId &&
      source.dataset.frameClipId === clip.id &&
      Math.abs(requestedMediaTime - expectedMediaTime) <= 0.000001 &&
      expectedMediaTime >= frameStart - 0.000001 &&
      expectedMediaTime <= frameEnd + 0.000001
    )
  }

  if (!(source instanceof HTMLVideoElement)) return true
  if (source.seeking || !source.paused) return false

  const presentedFrame: PresentedVideoFrame = {
    mediaId: source.dataset.framePresentedMediaId ?? '',
    clipId: source.dataset.framePresentedClipId ?? '',
    mediaTime: Number(source.dataset.framePresentedMediaTime),
    currentTime: Number(source.dataset.framePresentedCurrentTime),
    seekGeneration: Number(source.dataset.framePresentedSeekGeneration),
  }

  return isPresentedVideoFrameCurrent(presentedFrame, {
    mediaId: clip.mediaId,
    clipId: clip.id,
    mediaTime: expectedMediaTime,
    currentTime: source.currentTime,
    seekGeneration: Number(source.dataset.frameSeekGeneration),
  })
}

function analyzeInWorker(
  worker: Worker,
  request: DifferenceWorkerRequest,
): Promise<DifferenceWorkerResponse> {
  return new Promise((resolve) => {
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
    const cleanup = () => {
      worker.removeEventListener('message', handleMessage)
      worker.removeEventListener('error', handleError)
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
  const analysisTime = isPlaying ? null : currentTime

  const [result, setResult] = useState<DifferenceResult>({
    signature: '',
    regions: [],
    aspectRatio: 16 / 9,
  })
  const [frameRevision, setFrameRevision] = useState(0)
  const [visibilityRevision, setVisibilityRevision] = useState(0)
  const canvasARef = useRef<HTMLCanvasElement | null>(null)
  const canvasBRef = useRef<HTMLCanvasElement | null>(null)
  const requestIdRef = useRef(0)

  const signature = [
    createClipSignature(clipA),
    createClipSignature(clipB),
    enabled ? 'enabled' : 'disabled',
    sensitivity,
    noiseFilter,
    analysisQuality,
    isExporting ? 'exporting' : 'preview',
    isPlaying ? 'playing' : 'paused',
    analysisTime ?? 'playing',
    frameRevision,
    visibilityRevision,
  ].join('|')

  const notifyFrameReady = useCallback(() => {
    setFrameRevision((revision) => revision + 1)
  }, [])

  useEffect(() => {
    const handleVisibilityChange = () => {
      setVisibilityRevision((revision) => revision + 1)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    requestIdRef.current += 1
    const requestId = requestIdRef.current

    if (!enabled) return

    if (isPlaying) {
      setRuntime({
        status: 'idle',
        message: 'Pause playback to highlight differences on the current frame',
      })
      return
    }

    if (isExporting || document.visibilityState === 'hidden') {
      setRuntime({
        status: 'idle',
        message: isExporting
          ? 'Difference analysis pauses during export'
          : 'Difference analysis pauses while this tab is hidden',
      })
      return
    }

    if (analysisTime === null) return

    if (!clipA || !clipB) {
      setRuntime({
        status: 'unavailable',
        message: 'Both A and B need an active clip at the current timeline position',
      })
      return
    }

    const sourceA = sourceARef.current
    const sourceB = sourceBRef.current
    if (!sourceA || !sourceB) {
      setRuntime({
        status: 'syncing',
        message: 'Waiting for both A/B frames',
      })
      return
    }

    if (
      [sourceA, sourceB].some(
        (source) =>
          source instanceof HTMLVideoElement && source.dataset.framePresentedSupported === 'false',
      )
    ) {
      setRuntime({
        status: 'unavailable',
        message: 'Paused-frame highlighting requires requestVideoFrameCallback support',
      })
      return
    }

    if (
      !isPausedSourceReady(sourceA, clipA, analysisTime) ||
      !isPausedSourceReady(sourceB, clipB, analysisTime)
    ) {
      setRuntime({
        status: 'syncing',
        message: 'Waiting for the paused A/B frames',
      })
      return
    }

    const dimensionsA = getVisualFrameDimensions(sourceA)
    const dimensionsB = getVisualFrameDimensions(sourceB)
    const analysisDimensions = calculateCommonAnalysisDimensions(dimensionsA, dimensionsB, {
      maxLongEdge: analysisQuality === 'full' ? Number.POSITIVE_INFINITY : AUTO_MAX_LONG_EDGE,
      maxPixels: FULL_RESOLUTION_MAX_PIXELS,
    })

    if (!analysisDimensions.ok) {
      const message =
        analysisDimensions.reason === 'aspect-mismatch'
          ? 'A/B aspect ratios must match before regions can be compared'
          : analysisDimensions.reason === 'too-large'
            ? 'Full-resolution analysis exceeds the 12 MP safety limit; use Auto quality'
            : 'The current A/B frame dimensions are not ready'
      setRuntime({ status: 'unavailable', message })
      return
    }

    if (typeof Worker === 'undefined') {
      setRuntime({
        status: 'unavailable',
        message: 'Difference highlighting requires Web Worker support',
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
        status: 'syncing',
        message: 'Waiting for readable A/B frames',
      })
      return
    }

    const worker = new Worker(new URL('../workers/frameDifference.worker.ts', import.meta.url), {
      type: 'module',
    })
    let disposed = false
    const runSignature = signature

    setRuntime({
      status: 'analyzing',
      message: 'Analyzing the paused current frame…',
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
      threshold: sensitivityToColorThreshold(sensitivity),
      minPixels,
      mergeGap: Math.max(2, Math.round(3 * scaleReference)),
      padding: Math.max(2, Math.round(2 * scaleReference)),
      maxRegions: MAX_REGIONS,
    }

    void analyzeInWorker(worker, request).then((response) => {
      if (disposed || requestId !== requestIdRef.current) return

      if (response.type === 'error') {
        setRuntime({
          status: 'unavailable',
          message: response.message,
        })
        return
      }

      setResult({
        signature: runSignature,
        regions: response.regions,
        aspectRatio: analysisDimensions.aspectRatio,
      })
      setRuntime(
        response.regions.length > 0
          ? {
              status: 'different',
              message: `${response.regions.length} highlighted regions on the current frame`,
            }
          : {
              status: 'same',
              message:
                response.diffPixelCount > 0
                  ? 'Differences are below the current region filter'
                  : 'No highlighted differences on the current frame',
            },
      )
    })

    return () => {
      disposed = true
      worker.terminate()
    }
  }, [
    analysisQuality,
    clipA,
    clipB,
    analysisTime,
    enabled,
    frameRevision,
    isExporting,
    isPlaying,
    noiseFilter,
    sensitivity,
    setRuntime,
    sourceARef,
    sourceBRef,
    signature,
    visibilityRevision,
  ])

  const hasCurrentResult = !isPlaying && result.signature === signature

  return {
    regions: hasCurrentResult ? result.regions : [],
    aspectRatio: hasCurrentResult ? result.aspectRatio : 16 / 9,
    notifyFrameReady,
  }
}
