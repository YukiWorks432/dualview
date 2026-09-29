import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import { calculateCommonAnalysisDimensions } from '../lib/difference/geometry'
import type { NormalizedDifferenceRegion } from '../lib/difference/regions'
import {
  getBaseMinimumRegionPixels,
  scaleMinimumRegionPixels,
  sensitivityToPixelmatchThreshold,
} from '../lib/difference/settings'
import {
  areFrameRangesSynchronized,
  getConsecutivePresentedFrameRange,
  getPlaybackDifferenceExpiryDelay,
} from '../lib/difference/synchronization'
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
  calculateMediaTime,
  calculateTimelineTime,
  type TimelineFrameRange,
} from '../lib/media/timeline'
import { useDifferenceHighlightStore } from '../stores/differenceHighlightStore'
import { usePlaybackStore } from '../stores/playbackStore'
import type { TimelineClip } from '../types'

const PLAYBACK_ANALYSIS_INTERVAL_MS = 200
const PLAYBACK_SYNC_TOLERANCE_SECONDS = 0.08
// Presented timestamps can lead the media element clock while native playback advances.
const PLAYBACK_PRESENTED_FRAME_SYNC_TOLERANCE_SECONDS = 0.2
const FRAME_POINT_PAIR_TOLERANCE_SECONDS = 0.001
const PLAYBACK_MIN_FRAME_OVERLAP_SECONDS = 0.001
// The decoded presentation timestamp can be one held frame behind the paused timeline position.
const PAUSED_SYNC_TOLERANCE_SECONDS = 0.05
const PLAYBACK_RESULT_TTL_MS = 500
const FULL_RESOLUTION_MAX_PIXELS = 12_000_000
const MAX_REGIONS = 80

interface CapturedSource {
  imageData: ImageData
  timelineRange: TimelineFrameRange | null
}

interface DifferenceResult {
  signature: string
  regions: NormalizedDifferenceRegion[]
  aspectRatio: number
  capturedAt: number
}

function createEmptyResult(signature = ''): DifferenceResult {
  return {
    signature,
    regions: [],
    aspectRatio: 16 / 9,
    capturedAt: 0,
  }
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

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function readCanvasTimelineRange(source: HTMLCanvasElement): TimelineFrameRange | null {
  const startTime = Number(source.dataset.frameTimelineTime)
  const endValue = source.dataset.frameTimelineEndTime
  const endTime = endValue === undefined ? startTime : Number(endValue)
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime > endTime) {
    return null
  }

  return { startTime, endTime }
}

function readPresentedVideoFrame(video: HTMLVideoElement) {
  const mediaTime = Number(video.dataset.presentedMediaTime)
  const presentedFrames = Number(video.dataset.presentedFrames)
  if (!Number.isFinite(mediaTime) || !Number.isSafeInteger(presentedFrames)) return null

  return { mediaTime, presentedFrames }
}

function distanceFromTimeToRange(time: number, range: TimelineFrameRange): number {
  if (time < range.startTime) return range.startTime - time
  if (time > range.endTime) return time - range.endTime
  return 0
}

function waitForPresentedVideoSnapshot(
  video: HTMLVideoElement,
  clip: TimelineClip,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  isCurrent: () => boolean,
): Promise<CapturedSource | null> {
  const deadline = performance.now() + 180

  return new Promise((resolve) => {
    let settled = false
    let callbackId: number | undefined
    let timeoutId: number | undefined
    let capturedSnapshot: {
      imageData: ImageData
      timelineTime: number
      presentedFrames: number
    } | null = null
    const handleSeeking = () => {
      capturedSnapshot = null
    }

    const finish = (snapshot: CapturedSource | null) => {
      if (settled) return
      settled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      if (callbackId !== undefined) video.cancelVideoFrameCallback(callbackId)
      video.removeEventListener('seeking', handleSeeking)
      resolve(snapshot)
    }

    const requestNextFrame = () => {
      if (!isCurrent() || performance.now() >= deadline) {
        finish(null)
        return
      }

      callbackId = video.requestVideoFrameCallback((_now, metadata) => {
        callbackId = undefined
        if (!isCurrent()) {
          finish(null)
          return
        }
        if (video.seeking) {
          capturedSnapshot = null
          requestNextFrame()
          return
        }

        const presentedTimelineTime = calculateTimelineTime(metadata.mediaTime, clip)
        const currentVideoTimelineTime = calculateTimelineTime(video.currentTime, clip)
        if (capturedSnapshot && !video.seeking && presentedTimelineTime !== null) {
          const consecutiveRange = getConsecutivePresentedFrameRange(capturedSnapshot, {
            timelineTime: presentedTimelineTime,
            presentedFrames: metadata.presentedFrames,
          })
          finish({
            imageData: capturedSnapshot.imageData,
            timelineRange: consecutiveRange ?? {
              startTime: capturedSnapshot.timelineTime,
              endTime: capturedSnapshot.timelineTime,
            },
          })
          return
        }

        if (
          isVisualFrameReady(video) &&
          !video.seeking &&
          presentedTimelineTime !== null &&
          currentVideoTimelineTime !== null &&
          Math.abs(presentedTimelineTime - currentVideoTimelineTime) <=
            PLAYBACK_PRESENTED_FRAME_SYNC_TOLERANCE_SECONDS
        ) {
          const imageData = captureSource(video, canvas, width, height)
          if (imageData) {
            capturedSnapshot = {
              imageData,
              timelineTime: presentedTimelineTime,
              presentedFrames: metadata.presentedFrames,
            }
            requestNextFrame()
            return
          }
        }

        requestNextFrame()
      })
    }

    timeoutId = window.setTimeout(
      () => {
        finish(
          isCurrent() && capturedSnapshot
            ? {
                imageData: capturedSnapshot.imageData,
                timelineRange: {
                  startTime: capturedSnapshot.timelineTime,
                  endTime: capturedSnapshot.timelineTime,
                },
              }
            : null,
        )
      },
      Math.max(0, deadline - performance.now()),
    )
    video.addEventListener('seeking', handleSeeking)
    requestNextFrame()
  })
}

async function captureSourceAtTime(
  source: VisualFrameElement,
  clip: TimelineClip,
  timelineTime: number,
  isPlaying: boolean,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  isCurrent: () => boolean,
): Promise<CapturedSource | null> {
  if (!isCurrent()) return null

  if (source instanceof HTMLImageElement) {
    if (!isVisualFrameReady(source)) return null
    const imageData = captureSource(source, canvas, width, height)
    return imageData ? { imageData, timelineRange: null } : null
  }

  if (
    source instanceof HTMLVideoElement &&
    isPlaying &&
    typeof source.requestVideoFrameCallback === 'function' &&
    typeof source.cancelVideoFrameCallback === 'function'
  ) {
    return waitForPresentedVideoSnapshot(source, clip, canvas, width, height, isCurrent)
  }

  const tolerance = isPlaying ? PLAYBACK_SYNC_TOLERANCE_SECONDS : PAUSED_SYNC_TOLERANCE_SECONDS
  const deadline = performance.now() + (isPlaying ? 180 : 700)

  while (performance.now() <= deadline) {
    if (!isCurrent()) return null

    if (isVisualFrameReady(source)) {
      if (source instanceof HTMLVideoElement) {
        if (!source.seeking) {
          const observedFrame = readPresentedVideoFrame(source)
          const observedTimelineTime = observedFrame
            ? calculateTimelineTime(observedFrame.mediaTime, clip)
            : null
          if (
            observedFrame &&
            observedTimelineTime !== null &&
            Math.abs(observedTimelineTime - timelineTime) <= tolerance
          ) {
            const imageData = captureSource(source, canvas, width, height)
            const afterCaptureFrame = readPresentedVideoFrame(source)
            if (
              imageData &&
              !source.seeking &&
              afterCaptureFrame &&
              afterCaptureFrame.mediaTime === observedFrame.mediaTime &&
              afterCaptureFrame.presentedFrames === observedFrame.presentedFrames
            ) {
              return {
                imageData,
                timelineRange: {
                  startTime: observedTimelineTime,
                  endTime: observedTimelineTime,
                },
              }
            }
          }
        }
      } else {
        const observedRange = readCanvasTimelineRange(source)
        if (observedRange && distanceFromTimeToRange(timelineTime, observedRange) <= tolerance) {
          const imageData = captureSource(source, canvas, width, height)
          const afterCaptureRange = readCanvasTimelineRange(source)
          if (
            imageData &&
            afterCaptureRange?.startTime === observedRange.startTime &&
            afterCaptureRange.endTime === observedRange.endTime
          ) {
            return { imageData, timelineRange: observedRange }
          }
        }
      }
    }

    await nextAnimationFrame()
  }

  return null
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

  const [result, setResult] = useState<DifferenceResult>(() => createEmptyResult())
  const [frameRevision, setFrameRevision] = useState(0)
  const [retryRevision, setRetryRevision] = useState(0)
  const [seekRevision, setSeekRevision] = useState(0)
  const workerRef = useRef<Worker | null>(null)
  const canvasARef = useRef<HTMLCanvasElement | null>(null)
  const canvasBRef = useRef<HTMLCanvasElement | null>(null)
  const requestIdRef = useRef(0)
  const seekRevisionRef = useRef(0)
  const inFlightRef = useRef(false)
  const queuedRef = useRef(false)
  const lastStartedAtRef = useRef(0)
  const signatureRef = useRef('')

  const signature = [
    createClipSignature(clipA),
    createClipSignature(clipB),
    enabled ? 'enabled' : 'disabled',
    sensitivity,
    noiseFilter,
    analysisQuality,
    isExporting ? 'exporting' : 'preview',
    isPlaying ? 'playing' : currentTime,
    seekRevision,
  ].join('|')

  useEffect(() => {
    signatureRef.current = signature
  }, [signature])

  const notifyFrameReady = useCallback(() => {
    setFrameRevision((revision) => revision + 1)
  }, [])

  useEffect(() => {
    const handlePlaybackSeek = () => {
      seekRevisionRef.current += 1
      requestIdRef.current += 1
      queuedRef.current = enabled
      signatureRef.current = ''
      setResult(createEmptyResult())
      setSeekRevision(seekRevisionRef.current)
    }

    window.addEventListener('playback-seek', handlePlaybackSeek as EventListener)
    return () => window.removeEventListener('playback-seek', handlePlaybackSeek as EventListener)
  }, [enabled])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') setResult(createEmptyResult())
      setFrameRevision((revision) => revision + 1)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    if (!isPlaying || result.regions.length === 0) return

    const timeoutId = window.setTimeout(
      () => {
        setResult((current) => (current === result ? createEmptyResult(result.signature) : current))
      },
      getPlaybackDifferenceExpiryDelay(
        performance.now(),
        result.capturedAt,
        PLAYBACK_RESULT_TTL_MS,
      ),
    )

    return () => window.clearTimeout(timeoutId)
  }, [isPlaying, result])

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

    const worker = new Worker(new URL('../workers/frameDifference.worker.ts', import.meta.url), {
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
      return
    }

    if (isExporting || document.visibilityState === 'hidden') {
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
        requestId === requestIdRef.current &&
        runSignature === signatureRef.current &&
        seekRevisionRef.current === seekRevision

      try {
        setRuntime({
          status: 'syncing',
          message: 'Waiting for synchronized A/B frames…',
          regionCount: 0,
          approximate: isPlaying,
        })

        const dimensionsA = getVisualFrameDimensions(sourceA)
        const dimensionsB = getVisualFrameDimensions(sourceB)
        if (
          dimensionsA.width <= 0 ||
          dimensionsA.height <= 0 ||
          dimensionsB.width <= 0 ||
          dimensionsB.height <= 0
        ) {
          setResult(createEmptyResult(runSignature))
          setRuntime({
            status: 'syncing',
            message: 'Waiting for both A/B frame dimensions…',
            regionCount: 0,
            approximate: isPlaying,
          })
          return
        }

        const analysisDimensions = calculateCommonAnalysisDimensions(dimensionsA, dimensionsB, {
          maxLongEdge:
            analysisQuality === 'full' ? Number.POSITIVE_INFINITY : isPlaying ? 960 : 1920,
          maxPixels: FULL_RESOLUTION_MAX_PIXELS,
        })

        if (!analysisDimensions.ok) {
          setResult(createEmptyResult(runSignature))
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
        const [capturedA, capturedB] = await Promise.all([
          captureSourceAtTime(
            sourceA,
            clipA,
            sampleTime,
            isPlaying,
            canvasARef.current,
            analysisDimensions.width,
            analysisDimensions.height,
            isCurrent,
          ),
          captureSourceAtTime(
            sourceB,
            clipB,
            sampleTime,
            isPlaying,
            canvasBRef.current,
            analysisDimensions.width,
            analysisDimensions.height,
            isCurrent,
          ),
        ])

        if (!isCurrent()) return

        const presentedTimelineTimeA =
          isPlaying && sourceA instanceof HTMLVideoElement
            ? calculateTimelineTime(sourceA.currentTime, clipA)
            : null
        const synchronizationTime = presentedTimelineTimeA ?? sampleTime
        const expectedFrameTolerance = isPlaying
          ? PLAYBACK_PRESENTED_FRAME_SYNC_TOLERANCE_SECONDS
          : PAUSED_SYNC_TOLERANCE_SECONDS
        if (
          !capturedA ||
          !capturedB ||
          !areFrameRangesSynchronized(
            [capturedA.timelineRange, capturedB.timelineRange],
            synchronizationTime,
            expectedFrameTolerance,
            FRAME_POINT_PAIR_TOLERANCE_SECONDS,
            isPlaying ? PLAYBACK_MIN_FRAME_OVERLAP_SECONDS : 0,
          )
        ) {
          setResult(createEmptyResult(runSignature))
          setRuntime({
            status: 'syncing',
            message: 'Waiting for a synchronized A/B frame pair…',
            regionCount: 0,
            approximate: isPlaying,
          })
          return
        }

        const imageA = capturedA.imageData
        const imageB = capturedB.imageData

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
          setResult(createEmptyResult(runSignature))
          setRuntime({
            status: 'unavailable',
            message: response.message,
            regionCount: 0,
            approximate: isPlaying,
          })
          return
        }

        setResult({
          signature: runSignature,
          regions: response.regions,
          aspectRatio: analysisDimensions.aspectRatio,
          capturedAt: performance.now(),
        })

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
        setResult(createEmptyResult(runSignature))
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
    seekRevision,
    sensitivity,
    setRuntime,
    sourceARef,
    sourceBRef,
  ])

  const hasCurrentResult = result.signature === signature

  return {
    regions: hasCurrentResult ? result.regions : [],
    aspectRatio: hasCurrentResult ? result.aspectRatio : 16 / 9,
    notifyFrameReady,
  }
}
