import { ALL_FORMATS, BlobSource, CanvasSink, EncodedPacketSink, Input } from 'mediabunny'
import type { InputVideoTrack, WrappedCanvas } from 'mediabunny'

import { ensureProResDecoder } from '../media/prores'
import { calculateMediaTime } from '../media/timeline'
import { PixelComparator } from './compare'
import {
  comparisonBoundaries,
  comparisonSize,
  frameAt,
  normalizeFrameTimings,
  pairWindows,
  sourceTimestamps,
  validateOptions,
} from './model'
import type {
  DifferenceBatch,
  DifferenceMedia,
  DifferenceRequest,
  DifferenceSample,
  FrameTiming,
} from './model'

interface PreparedVideo {
  input: Input
  track: InputVideoTrack
  width: number
  height: number
  timings: FrameTiming[]
}
type PreparedMedia = PreparedVideo | { error: string; state: 'unsupported' | 'error' }
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
async function prepareVideo(media: DifferenceMedia, signal: AbortSignal): Promise<PreparedMedia> {
  if (media.type !== 'video')
    return {
      state: 'unsupported',
      error: `${media.name}: timeline analysis currently requires video`,
    }
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(media.file) })
  const abort = () => input.dispose()
  signal.addEventListener('abort', abort, { once: true })
  try {
    signal.throwIfAborted()
    if (!(await input.canRead())) throw new Error('Unsupported video container')
    const track = await input.getPrimaryVideoTrack()
    if (!track) throw new Error('No video track')
    if ((await track.getCodec()) === 'prores') await ensureProResDecoder()
    signal.throwIfAborted()
    if (!(await track.canDecode())) {
      input.dispose()
      return { state: 'unsupported', error: `${media.name}: video decoder unavailable` }
    }
    const [width, height, trackEnd] = await Promise.all([
      track.getDisplayWidth(),
      track.getDisplayHeight(),
      track.computeDuration(),
    ])
    const timings: FrameTiming[] = []
    const packets = new EncodedPacketSink(track)
    for await (const packet of packets.packets(undefined, undefined, { metadataOnly: true })) {
      signal.throwIfAborted()
      timings.push({ timestamp: packet.timestamp, duration: packet.duration })
    }
    return { input, track, width, height, timings: normalizeFrameTimings(timings, trackEnd) }
  } catch (error) {
    input.dispose()
    signal.throwIfAborted()
    return { state: 'error', error: `${media.name}: ${errorMessage(error)}` }
  } finally {
    signal.removeEventListener('abort', abort)
  }
}
function readPixels(frame: WrappedCanvas): Uint8ClampedArray {
  const context = frame.canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Cannot read the decoded frame')
  return context.getImageData(0, 0, frame.canvas.width, frame.canvas.height).data
}
/** Independent inputs and sinks: this function never accesses the preview or playback store. */
export async function analyzeDifferences(
  request: DifferenceRequest,
  onBatch: (batch: DifferenceBatch) => void,
  onMetadata: (descriptions: string[]) => void,
  signal: AbortSignal,
): Promise<void> {
  validateOptions(request.options)
  const windows = pairWindows(request.clipsA, request.clipsB, request.duration)
  const prepared = new Map<string, PreparedMedia>()
  const descriptions: string[] = []
  let batch: DifferenceSample[] = []
  let lastFlush = performance.now()
  const flush = () => {
    if (!batch.length) return
    onBatch({ samples: batch, processedUntil: batch[batch.length - 1].end })
    batch = []
    lastFlush = performance.now()
  }
  const emit = (sample: DifferenceSample) => {
    batch.push(sample)
    if (batch.length >= 128 || performance.now() - lastFlush >= 100) flush()
  }
  const disposeInputs = () => {
    for (const video of prepared.values()) if ('input' in video) video.input.dispose()
  }
  signal.addEventListener('abort', disposeInputs, { once: true })
  try {
    const usedIds = new Set([...request.clipsA, ...request.clipsB].map((clip) => clip.mediaId))
    for (const media of request.media) {
      if (!usedIds.has(media.id)) continue
      signal.throwIfAborted()
      const video = await prepareVideo(media, signal)
      prepared.set(media.id, video)
      descriptions.push(
        'error' in video
          ? video.error
          : `${media.name}: ${video.width} × ${video.height}, ${video.timings.length} frames`,
      )
      onMetadata([...descriptions])
    }
    for (const window of windows) {
      signal.throwIfAborted()
      const a = window.a ? prepared.get(window.a.mediaId) : undefined
      const b = window.b ? prepared.get(window.b.mediaId) : undefined
      if (!window.a || !window.b || !a || !b) {
        emit({
          start: window.start,
          end: window.end,
          state:
            (!window.a || !a) && (!window.b || !b)
              ? 'empty'
              : !window.a || !a
                ? 'missing-a'
                : 'missing-b',
          ratio: null,
          message: 'No source for one or both comparison tracks',
        })
        continue
      }
      if ('error' in a || 'error' in b) {
        const failure = 'error' in a ? a : (b as Extract<PreparedMedia, { error: string }>)
        emit({
          start: window.start,
          end: window.end,
          state: failure.state,
          ratio: null,
          message: failure.error,
        })
        continue
      }
      const times = comparisonBoundaries(window, a.timings, b.timings)
      const size = comparisonSize(a, b, request.options.resolution)
      const comparator = new PixelComparator(size.width, size.height)
      // Separate pools are necessary even when A and B refer to the same file.
      const sinkA = new CanvasSink(a.track, { ...size, fit: 'contain', alpha: true, poolSize: 1 })
      const sinkB = new CanvasSink(b.track, { ...size, fit: 'contain', alpha: true, poolSize: 1 })
      const framesA = sinkA.canvasesAtTimestamps(sourceTimestamps(times, window.a))
      const framesB = sinkB.canvasesAtTimestamps(sourceTimestamps(times, window.b))
      let remainingStart = window.start
      try {
        for (let index = 0; index < times.length - 1; index++) {
          signal.throwIfAborted()
          const start = times[index]
          const end = times[index + 1]
          const midpoint = start + (end - start) / 2
          const timeA = calculateMediaTime(midpoint, window.a)
          const timeB = calculateMediaTime(midpoint, window.b)
          const expectedA = timeA === null ? null : frameAt(a.timings, timeA)
          const expectedB = timeB === null ? null : frameAt(b.timings, timeB)
          const [resultA, resultB] = await Promise.all([framesA.next(), framesB.next()])
          signal.throwIfAborted()
          const frameA = resultA.value
          const frameB = resultB.value
          if (!expectedA || !expectedB || !frameA || !frameB) {
            emit({
              start,
              end,
              state:
                (!expectedA || !frameA) && (!expectedB || !frameB)
                  ? 'empty'
                  : !expectedA || !frameA
                    ? 'missing-a'
                    : 'missing-b',
              ratio: null,
              message: 'No frame covers this source time',
            })
          } else if (
            Math.abs(frameA.timestamp - expectedA.timestamp) > 0.000001 ||
            Math.abs(frameB.timestamp - expectedB.timestamp) > 0.000001
          ) {
            emit({
              start,
              end,
              state: 'error',
              ratio: null,
              message: 'Decoded frame timestamp does not match the requested frame',
            })
          } else {
            emit({
              start,
              end,
              state: 'compared',
              ratio: comparator.compare(
                readPixels(frameA),
                readPixels(frameB),
                request.options.pixelThreshold,
              ),
            })
          }
          remainingStart = end
        }
      } catch (error) {
        signal.throwIfAborted()
        if (remainingStart < window.end)
          emit({
            start: remainingStart,
            end: window.end,
            state: 'error',
            ratio: null,
            message: errorMessage(error),
          })
      } finally {
        await Promise.allSettled([framesA.return(), framesB.return()])
      }
    }
    flush()
  } finally {
    signal.removeEventListener('abort', disposeInputs)
    disposeInputs()
  }
}
