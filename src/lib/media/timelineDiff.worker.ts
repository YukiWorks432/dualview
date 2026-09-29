import { ALL_FORMATS, BlobSource, CanvasSink, EncodedPacketSink, Input } from 'mediabunny'

import type { MediaType, TimelineClip } from '../../types'
import { ensureProResDecoder } from './prores'
import { calculateMediaTime, findActiveClip } from './timeline'
import {
  calculatePixelDifferenceRate,
  collectTimelineDiffEventTimes,
  findFrameAtMediaTime,
  type FrameTiming,
  type TimelineDiffFrameScore,
} from './timelineDiff'

interface TimelineDiffSource {
  id: string
  type: MediaType
  file: File
  hasAlpha: boolean
}

interface TimelineDiffRequest {
  duration: number
  clipsA: TimelineClip[]
  clipsB: TimelineClip[]
  sources: TimelineDiffSource[]
  colorThreshold: number
  resolution: 'standard' | 'detailed'
}

type WorkerRequest =
  | { type: 'analyze'; jobId: string; input: TimelineDiffRequest }
  | { type: 'cancel'; jobId: string }

type WorkerResponse =
  | {
      type: 'progress'
      jobId: string
      completedFrames: number
      totalFrames: number
      frames: TimelineDiffFrameScore[]
    }
  | {
      type: 'finished'
      jobId: string
      status: 'complete' | 'partial' | 'unsupported' | 'error'
      message?: string
    }

interface SourceMetadata {
  frames: FrameTiming[]
  displayWidth: number
  displayHeight: number
  unsupportedReason?: string
}

interface OpenVideoInput {
  input: Input
  track: NonNullable<Awaited<ReturnType<Input['getPrimaryVideoTrack']>>>
}

interface PairWorkspace {
  key: string
  inputA: Input
  inputB: Input
  sinkA: CanvasSink
  sinkB: CanvasSink
  lastTimestampA: number | null
  lastTimestampB: number | null
  lastCanvasA: HTMLCanvasElement | OffscreenCanvas | null
  lastCanvasB: HTMLCanvasElement | OffscreenCanvas | null
  width: number
  height: number
}

class UnsupportedMediaError extends Error {}
class CancelledAnalysisError extends Error {}

const cancelledJobs = new Set<string>()

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const message = event.data
  if (message.type === 'cancel') {
    cancelledJobs.add(message.jobId)
    return
  }
  void analyze(message.jobId, message.input)
})

function isCancelled(jobId: string): boolean {
  return cancelledJobs.has(jobId)
}

function assertNotCancelled(jobId: string): void {
  if (isCancelled(jobId)) throw new CancelledAnalysisError('Analysis cancelled')
}

function post(message: WorkerResponse): void {
  self.postMessage(message)
}

async function openVideoInput(source: TimelineDiffSource): Promise<OpenVideoInput> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(source.file) })
  try {
    if (!(await input.canRead())) throw new UnsupportedMediaError('Unsupported video container')

    const track = await input.getPrimaryVideoTrack()
    if (!track) throw new UnsupportedMediaError('No video track was found')

    if ((await track.getCodec()) === 'prores') await ensureProResDecoder()
    if (!(await track.canDecode())) {
      throw new UnsupportedMediaError('This browser cannot decode the video for analysis')
    }

    return { input, track }
  } catch (error) {
    input.dispose()
    throw error
  }
}

function normalizeFrameTimings(packets: FrameTiming[], trackEnd: number): FrameTiming[] {
  packets.sort((a, b) => a.timestamp - b.timestamp)
  const uniquePackets = packets.filter(
    (packet, index) => index === 0 || packet.timestamp !== packets[index - 1].timestamp,
  )

  return uniquePackets.flatMap((packet, index) => {
    const nextTimestamp = uniquePackets[index + 1]?.timestamp
    const duration =
      packet.duration > 0 && Number.isFinite(packet.duration)
        ? packet.duration
        : nextTimestamp !== undefined && nextTimestamp > packet.timestamp
          ? nextTimestamp - packet.timestamp
          : trackEnd - packet.timestamp

    return duration > 0 && Number.isFinite(duration)
      ? [{ timestamp: packet.timestamp, duration }]
      : []
  })
}

async function readSourceMetadata(
  source: TimelineDiffSource,
  jobId: string,
): Promise<SourceMetadata> {
  const { input, track } = await openVideoInput(source)
  try {
    const [displayWidth, displayHeight, trackEnd] = await Promise.all([
      track.getDisplayWidth(),
      track.getDisplayHeight(),
      track.computeDuration(),
    ])
    const packetSink = new EncodedPacketSink(track)
    const packets: FrameTiming[] = []

    for await (const packet of packetSink.packets(undefined, undefined, { metadataOnly: true })) {
      assertNotCancelled(jobId)
      packets.push({ timestamp: packet.timestamp, duration: packet.duration })
    }

    return {
      frames: normalizeFrameTimings(packets, trackEnd),
      displayWidth,
      displayHeight,
    }
  } finally {
    input.dispose()
  }
}

async function scanSources(
  sources: TimelineDiffSource[],
  jobId: string,
): Promise<Map<string, SourceMetadata>> {
  const result = new Map<string, SourceMetadata>()
  for (const source of sources) {
    assertNotCancelled(jobId)
    if (source.type !== 'video') {
      result.set(source.id, {
        frames: [],
        displayWidth: 0,
        displayHeight: 0,
        unsupportedReason: 'Image clips are not supported by video analysis',
      })
      continue
    }

    try {
      result.set(source.id, await readSourceMetadata(source, jobId))
    } catch (error) {
      if (error instanceof CancelledAnalysisError) throw error
      result.set(source.id, {
        frames: [],
        displayWidth: 0,
        displayHeight: 0,
        unsupportedReason: error instanceof Error ? error.message : 'Video analysis is unavailable',
      })
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  return result
}

function getComparisonSize(
  metadataA: SourceMetadata,
  metadataB: SourceMetadata,
  resolution: 'standard' | 'detailed',
): { width: number; height: number } {
  const sourceWidth = Math.max(metadataA.displayWidth, metadataB.displayWidth)
  const sourceHeight = Math.max(metadataA.displayHeight, metadataB.displayHeight)
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new UnsupportedMediaError('Video display dimensions are unavailable')
  }

  const scale =
    resolution === 'standard' ? Math.min(1, 640 / Math.max(sourceWidth, sourceHeight)) : 1
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  }
}

async function createPairWorkspace(
  key: string,
  sourceA: TimelineDiffSource,
  sourceB: TimelineDiffSource,
  metadataA: SourceMetadata,
  metadataB: SourceMetadata,
  resolution: 'standard' | 'detailed',
): Promise<PairWorkspace> {
  const size = getComparisonSize(metadataA, metadataB, resolution)
  const openedA = await openVideoInput(sourceA)
  let openedB: OpenVideoInput
  try {
    openedB = await openVideoInput(sourceB)
  } catch (error) {
    openedA.input.dispose()
    throw error
  }

  try {
    return {
      key,
      inputA: openedA.input,
      inputB: openedB.input,
      sinkA: new CanvasSink(openedA.track, {
        width: size.width,
        height: size.height,
        fit: 'contain',
        alpha: sourceA.hasAlpha,
        poolSize: 1,
      }),
      sinkB: new CanvasSink(openedB.track, {
        width: size.width,
        height: size.height,
        fit: 'contain',
        alpha: sourceB.hasAlpha,
        poolSize: 1,
      }),
      lastTimestampA: null,
      lastTimestampB: null,
      lastCanvasA: null,
      lastCanvasB: null,
      width: size.width,
      height: size.height,
    }
  } catch (error) {
    openedA.input.dispose()
    openedB.input.dispose()
    throw error
  }
}

function get2dContext(canvas: HTMLCanvasElement | OffscreenCanvas) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context || !('getImageData' in context)) {
    throw new Error('A 2D canvas context is unavailable in the analysis worker')
  }
  return context
}

async function getFrameCanvas(
  workspace: PairWorkspace,
  side: 'a' | 'b',
  expectedFrame: FrameTiming,
  mediaTime: number,
): Promise<HTMLCanvasElement | OffscreenCanvas> {
  if (
    side === 'a' &&
    workspace.lastTimestampA === expectedFrame.timestamp &&
    workspace.lastCanvasA
  ) {
    return workspace.lastCanvasA
  }
  if (
    side === 'b' &&
    workspace.lastTimestampB === expectedFrame.timestamp &&
    workspace.lastCanvasB
  ) {
    return workspace.lastCanvasB
  }

  const sink = side === 'a' ? workspace.sinkA : workspace.sinkB
  const result = await sink.getCanvas(mediaTime)
  if (!result) throw new Error(`Frame at ${mediaTime.toFixed(6)} seconds could not be decoded`)

  const canvas = result.canvas
  if (side === 'a') {
    workspace.lastTimestampA = expectedFrame.timestamp
    workspace.lastCanvasA = canvas
  } else {
    workspace.lastTimestampB = expectedFrame.timestamp
    workspace.lastCanvasB = canvas
  }
  return canvas
}

function compareCanvases(
  workspace: PairWorkspace,
  canvasA: HTMLCanvasElement | OffscreenCanvas,
  canvasB: HTMLCanvasElement | OffscreenCanvas,
  colorThreshold: number,
): number {
  const imageA = get2dContext(canvasA).getImageData(0, 0, workspace.width, workspace.height)
  const imageB = get2dContext(canvasB).getImageData(0, 0, workspace.width, workspace.height)
  return calculatePixelDifferenceRate(
    imageA.data,
    imageB.data,
    workspace.width,
    workspace.height,
    colorThreshold,
  )
}

function makeScore(
  startTime: number,
  endTime: number,
  clipA: TimelineClip | null,
  clipB: TimelineClip | null,
  status: TimelineDiffFrameScore['status'],
  reason?: string,
  differenceRate: number | null = null,
): TimelineDiffFrameScore {
  return {
    startTime,
    endTime,
    sampleTime: startTime + (endTime - startTime) / 2,
    differenceRate,
    status,
    ...(reason ? { reason } : {}),
    ...(clipA ? { clipAId: clipA.id } : {}),
    ...(clipB ? { clipBId: clipB.id } : {}),
  }
}

async function analyze(jobId: string, request: TimelineDiffRequest): Promise<void> {
  const sources = new Map(request.sources.map((source) => [source.id, source]))
  const metadataByMediaId = new Map<string, SourceMetadata>()
  const mediaIds = new Set([...request.clipsA, ...request.clipsB].map((clip) => clip.mediaId))
  let workspace: PairWorkspace | null = null
  let completedFrames = 0
  let totalFrames = 0
  let batch: TimelineDiffFrameScore[] = []
  let lastProgressAt = Date.now()

  const flushProgress = () => {
    if (batch.length === 0) return
    post({
      type: 'progress',
      jobId,
      completedFrames,
      totalFrames,
      frames: batch,
    })
    batch = []
    lastProgressAt = Date.now()
  }

  const disposeWorkspace = () => {
    workspace?.inputA.dispose()
    workspace?.inputB.dispose()
    workspace = null
  }

  try {
    if (typeof OffscreenCanvas === 'undefined') {
      throw new UnsupportedMediaError('OffscreenCanvas is not supported in this browser')
    }
    if (request.clipsA.length === 0 || request.clipsB.length === 0) {
      throw new UnsupportedMediaError('Add video clips to both A and B tracks before analysis')
    }

    const scanList = [...mediaIds]
      .map((id) => sources.get(id))
      .filter((source): source is TimelineDiffSource => source !== undefined)
    const scannedSources = await scanSources(scanList, jobId)
    for (const [id, metadata] of scannedSources) metadataByMediaId.set(id, metadata)

    const eventTimes = collectTimelineDiffEventTimes(
      request.duration,
      request.clipsA,
      request.clipsB,
      new Map([...metadataByMediaId].map(([id, metadata]) => [id, metadata.frames])),
    )
    totalFrames = Math.max(0, eventTimes.length - 1)

    for (let index = 0; index < totalFrames; index++) {
      assertNotCancelled(jobId)
      const startTime = eventTimes[index]
      const endTime = eventTimes[index + 1]
      if (endTime - startTime <= 1e-7) continue

      const sampleTime = startTime + (endTime - startTime) / 2
      const clipA = findActiveClip(request.clipsA, sampleTime)
      const clipB = findActiveClip(request.clipsB, sampleTime)
      const sourceA = clipA ? sources.get(clipA.mediaId) : undefined
      const sourceB = clipB ? sources.get(clipB.mediaId) : undefined
      const metadataA = clipA ? metadataByMediaId.get(clipA.mediaId) : undefined
      const metadataB = clipB ? metadataByMediaId.get(clipB.mediaId) : undefined

      let score: TimelineDiffFrameScore
      if (!clipA || !clipB) {
        const reason =
          !clipA && !clipB
            ? 'No A or B clip is active'
            : !clipA
              ? 'No A clip is active'
              : 'No B clip is active'
        score = makeScore(startTime, endTime, clipA, clipB, 'missing', reason)
        disposeWorkspace()
      } else if (!sourceA || !sourceB || !metadataA || !metadataB) {
        score = makeScore(
          startTime,
          endTime,
          clipA,
          clipB,
          'missing',
          'Media source is unavailable',
        )
        disposeWorkspace()
      } else if (sourceA.type !== 'video' || sourceB.type !== 'video') {
        score = makeScore(
          startTime,
          endTime,
          clipA,
          clipB,
          'unsupported',
          'Both active clips must be videos',
        )
        disposeWorkspace()
      } else if (metadataA.unsupportedReason || metadataB.unsupportedReason) {
        score = makeScore(
          startTime,
          endTime,
          clipA,
          clipB,
          'unsupported',
          metadataA.unsupportedReason ?? metadataB.unsupportedReason,
        )
        disposeWorkspace()
      } else {
        const mediaTimeA = calculateMediaTime(sampleTime, clipA)
        const mediaTimeB = calculateMediaTime(sampleTime, clipB)
        const frameA =
          mediaTimeA === null ? null : findFrameAtMediaTime(metadataA.frames, mediaTimeA)
        const frameB =
          mediaTimeB === null ? null : findFrameAtMediaTime(metadataB.frames, mediaTimeB)

        if (!frameA || !frameB || mediaTimeA === null || mediaTimeB === null) {
          const reason =
            !frameA && !frameB
              ? 'Neither video has a displayed frame'
              : !frameA
                ? 'A has no displayed frame'
                : 'B has no displayed frame'
          score = makeScore(startTime, endTime, clipA, clipB, 'missing', reason)
          disposeWorkspace()
        } else {
          const pairKey = [
            clipA.mediaId,
            clipB.mediaId,
            request.resolution,
            request.sources.find((source) => source.id === clipA.mediaId)?.hasAlpha ?? false,
            request.sources.find((source) => source.id === clipB.mediaId)?.hasAlpha ?? false,
          ].join(':')

          try {
            if (!workspace || workspace.key !== pairKey) {
              disposeWorkspace()
              workspace = await createPairWorkspace(
                pairKey,
                sourceA,
                sourceB,
                metadataA,
                metadataB,
                request.resolution,
              )
            }

            assertNotCancelled(jobId)
            const [canvasA, canvasB] = await Promise.all([
              getFrameCanvas(workspace, 'a', frameA, mediaTimeA),
              getFrameCanvas(workspace, 'b', frameB, mediaTimeB),
            ])
            assertNotCancelled(jobId)
            const differenceRate = compareCanvases(
              workspace,
              canvasA,
              canvasB,
              request.colorThreshold,
            )
            score = makeScore(
              startTime,
              endTime,
              clipA,
              clipB,
              'compared',
              undefined,
              differenceRate,
            )
          } catch (error) {
            if (error instanceof CancelledAnalysisError) throw error
            score = makeScore(
              startTime,
              endTime,
              clipA,
              clipB,
              error instanceof UnsupportedMediaError ? 'unsupported' : 'error',
              error instanceof Error ? error.message : 'Frame comparison failed',
            )
            disposeWorkspace()
          }
        }
      }

      batch.push(score)
      completedFrames = index + 1
      if (batch.length >= 1024 || Date.now() - lastProgressAt >= 500) flushProgress()
      if (index % 16 === 15) await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }

    flushProgress()
    post({
      type: 'finished',
      jobId,
      status: 'complete',
      message: `Compared ${completedFrames} timeline intervals. Unavailable intervals remain marked in the lane.`,
    })
  } catch (error) {
    flushProgress()
    if (error instanceof CancelledAnalysisError || isCancelled(jobId)) {
      post({
        type: 'finished',
        jobId,
        status: 'partial',
        message: 'Analysis cancelled. Results cover the inspected portion only.',
      })
    } else {
      const unsupported = error instanceof UnsupportedMediaError
      post({
        type: 'finished',
        jobId,
        status: unsupported ? 'unsupported' : 'error',
        message: error instanceof Error ? error.message : 'Timeline difference analysis failed',
      })
    }
  } finally {
    disposeWorkspace()
    cancelledJobs.delete(jobId)
    self.close()
  }
}
