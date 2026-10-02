import { ALL_FORMATS, AudioSampleSink, BlobSource, Input } from 'mediabunny'

import { estimateAudioAnalysisBytes } from '../audio/AudioAnalyzer'
import { createAudioTaskYield, throwIfAudioAborted } from '../audio/audioTask'

const playbackGains = new WeakMap<AudioBufferSourceNode, GainNode>()

function releaseAudioPlaybackSource(source: AudioBufferSourceNode): void {
  source.disconnect()
  playbackGains.get(source)?.disconnect()
  playbackGains.delete(source)
  source.buffer = null
}

export function createAudioPlaybackSource(
  context: AudioContext,
  buffer: AudioBuffer | null,
  playbackRate: number,
  volume: number,
  offset: number,
  duration?: number,
): AudioBufferSourceNode | null {
  if (!buffer) return null

  const safeOffset = Math.max(0, offset)
  if (safeOffset >= buffer.duration) return null

  const safeDuration =
    duration === undefined
      ? undefined
      : Math.max(0, Math.min(duration, buffer.duration - safeOffset))
  if (safeDuration !== undefined && safeDuration <= 0) return null

  const source = context.createBufferSource()
  const gain = context.createGain()
  source.buffer = buffer
  source.playbackRate.value = playbackRate
  gain.gain.value = volume
  source.connect(gain)
  gain.connect(context.destination)
  playbackGains.set(source, gain)
  source.onended = () => releaseAudioPlaybackSource(source)

  try {
    if (safeDuration === undefined) {
      source.start(0, safeOffset)
    } else {
      source.start(0, safeOffset, safeDuration)
    }
    return source
  } catch (error) {
    releaseAudioPlaybackSource(source)
    source.onended = null
    throw error
  }
}

export type AudioTrackKey = 'a' | 'b'

export class AudioSourceRegistry {
  private sources = new Map<AudioTrackKey, AudioBufferSourceNode>()

  replace(track: AudioTrackKey, source: AudioBufferSourceNode | null): void {
    this.stop(track)
    if (!source) return

    this.sources.set(track, source)
    const onended = source.onended
    source.onended = (event) => {
      onended?.call(source, event)
      if (this.sources.get(track) === source) {
        this.sources.delete(track)
      }
    }
  }

  stop(track: AudioTrackKey): void {
    const source = this.sources.get(track)
    if (!source) return

    try {
      source.stop()
    } catch {
      // The source may already have ended.
    }
    // stop後のendedを待たず、PCMと接続先を手放す。
    releaseAudioPlaybackSource(source)
    source.onended = null
    this.sources.delete(track)
  }

  stopAll(): void {
    this.stop('a')
    this.stop('b')
  }
}

export class PlaybackRequestGate {
  private generation = 0

  begin(): number {
    this.generation += 1
    return this.generation
  }

  invalidate(): void {
    this.generation += 1
  }

  isCurrent(generation: number): boolean {
    return generation === this.generation
  }
}

export interface PrimaryAudioTrackMetadata {
  sampleRate: number
  numberOfChannels: number
}

export async function getPrimaryAudioTrackMetadata(
  file: File,
): Promise<PrimaryAudioTrackMetadata | null> {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(file),
  })

  try {
    if (!(await input.canRead())) return null

    const track = await input.getPrimaryAudioTrack()
    if (!track) return null

    const [sampleRate, numberOfChannels] = await Promise.all([
      track.getSampleRate(),
      track.getNumberOfChannels(),
    ])

    return { sampleRate, numberOfChannels }
  } finally {
    input.dispose()
  }
}

export const MAX_DECODED_AUDIO_BYTES = 512 * 1024 * 1024
// R（他方保持）+ P（出力）+ P（decoderのPCM余裕）+ W（解析領域）。RSS上限ではない。
export const MAX_AUDIO_PROCESSING_BYTES = 2 * 1024 * 1024 * 1024

export function estimateDecodedAudioBytes(
  duration: number,
  sampleRate: number,
  numberOfChannels: number,
): number {
  if (duration <= 0 || sampleRate <= 0 || numberOfChannels <= 0) return 0
  return Math.ceil(duration * sampleRate) * numberOfChannels * Float32Array.BYTES_PER_ELEMENT
}

export function assertDecodedAudioSizeWithinLimit(
  duration: number,
  sampleRate: number,
  numberOfChannels: number,
  maxBytes = MAX_DECODED_AUDIO_BYTES,
): void {
  const estimatedBytes = estimateDecodedAudioBytes(duration, sampleRate, numberOfChannels)
  if (estimatedBytes <= maxBytes) return

  const requiredMiB = Math.ceil(estimatedBytes / (1024 * 1024))
  const limitMiB = Math.floor(maxBytes / (1024 * 1024))
  throw new Error(
    `Embedded audio analysis would require about ${requiredMiB} MiB of decoded PCM, exceeding the ${limitMiB} MiB safety limit.`,
  )
}

export function estimateAudioProcessingBytes(
  duration: number,
  sampleRate: number,
  numberOfChannels: number,
  retainedPcmBytes = 0,
): number {
  const pcmBytes = estimateDecodedAudioBytes(duration, sampleRate, numberOfChannels)
  const workspaceBytes = estimateAudioAnalysisBytes(
    Math.ceil(duration * sampleRate),
    sampleRate,
    numberOfChannels,
  )
  return retainedPcmBytes + 2 * pcmBytes + workspaceBytes
}

export function assertAudioProcessingSizeWithinLimit(
  duration: number,
  sampleRate: number,
  numberOfChannels: number,
  retainedPcmBytes = 0,
  maxBytes = MAX_AUDIO_PROCESSING_BYTES,
): void {
  const bytes = estimateAudioProcessingBytes(
    duration,
    sampleRate,
    numberOfChannels,
    retainedPcmBytes,
  )
  if (Number.isFinite(bytes) && bytes >= 0 && bytes <= maxBytes) return
  throw new Error(
    `Embedded audio processing would require about ${Math.ceil(bytes / (1024 * 1024))} MiB of PCM and analysis workspace, exceeding the ${Math.floor(maxBytes / (1024 * 1024))} MiB safety budget.`,
  )
}

export async function extractPrimaryAudioBuffer(
  file: File,
  signal?: AbortSignal,
  retainedPcmBytes = 0,
): Promise<AudioBuffer | null> {
  throwIfAudioAborted(signal)
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(file),
  })
  const abort = () => input.dispose()
  signal?.addEventListener('abort', abort, { once: true })

  try {
    if (!(await input.canRead())) return null
    throwIfAudioAborted(signal)
    const track = await input.getPrimaryAudioTrack()
    if (!track || !(await track.canDecode())) return null
    throwIfAudioAborted(signal)

    const [sampleRate, numberOfChannels, metadataDuration] = await Promise.all([
      track.getSampleRate(),
      track.getNumberOfChannels(),
      track.getDurationFromMetadata(),
    ])
    throwIfAudioAborted(signal)
    const computedDuration = await track.computeDuration()
    throwIfAudioAborted(signal)
    const duration = Math.max(
      metadataDuration !== null && Number.isFinite(metadataDuration) && metadataDuration > 0
        ? metadataDuration
        : 0,
      Number.isFinite(computedDuration) && computedDuration > 0 ? computedDuration : 0,
    )
    if (duration <= 0) return null
    assertDecodedAudioSizeWithinLimit(duration, sampleRate, numberOfChannels)
    assertAudioProcessingSizeWithinLimit(duration, sampleRate, numberOfChannels, retainedPcmBytes)

    const length = Math.max(1, Math.ceil(duration * sampleRate))
    const output = new AudioBuffer({ length, numberOfChannels, sampleRate })
    const sink = new AudioSampleSink(track)
    const yieldTask = createAudioTaskYield(signal)
    for await (const sample of sink.samples()) {
      try {
        throwIfAudioAborted(signal)
        let destinationOffset = Math.round(sample.timestamp * sampleRate)
        let sourceOffset = 0
        if (destinationOffset < 0) {
          sourceOffset = -destinationOffset
          destinationOffset = 0
        }
        const frames = Math.min(
          output.length - destinationOffset,
          sample.numberOfFrames - sourceOffset,
        )
        if (frames <= 0) continue
        const channelCount = Math.min(numberOfChannels, sample.numberOfChannels)
        for (let offset = 0; offset < frames; offset += 8192) {
          const frameCount = Math.min(8192, frames - offset)
          for (let channel = 0; channel < channelCount; channel++) {
            const destination = output
              .getChannelData(channel)
              .subarray(destinationOffset + offset, destinationOffset + offset + frameCount)
            sample.copyTo(destination, {
              planeIndex: channel,
              format: 'f32-planar',
              frameOffset: sourceOffset + offset,
              frameCount,
            })
          }
          const pending = yieldTask()
          if (pending) await pending
        }
      } finally {
        // 出力範囲外、例外、取消でも取り出した標本を解放する。
        sample.close()
      }
    }
    throwIfAudioAborted(signal)
    return output
  } catch (error) {
    // disposeで待機中のsinkが失敗しても、呼出元には同じ取消理由を返す。
    throwIfAudioAborted(signal)
    throw error
  } finally {
    signal?.removeEventListener('abort', abort)
    input.dispose()
  }
}
