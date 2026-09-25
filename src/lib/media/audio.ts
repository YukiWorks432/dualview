import { ALL_FORMATS, AudioBufferSink, BlobSource, Input } from 'mediabunny'

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

  if (safeDuration === undefined) {
    source.start(0, safeOffset)
  } else {
    source.start(0, safeOffset, safeDuration)
  }
  return source
}

export type AudioTrackKey = 'a' | 'b'

export class AudioSourceRegistry {
  private sources = new Map<AudioTrackKey, AudioBufferSourceNode>()

  replace(track: AudioTrackKey, source: AudioBufferSourceNode | null): void {
    this.stop(track)
    if (!source) return

    this.sources.set(track, source)
    source.onended = () => {
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

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  throw signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError')
}

export const MAX_DECODED_AUDIO_BYTES = 512 * 1024 * 1024

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

export async function extractPrimaryAudioBuffer(
  file: File,
  signal?: AbortSignal,
): Promise<AudioBuffer | null> {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(file),
  })

  try {
    throwIfAborted(signal)
    if (!(await input.canRead())) return null

    const track = await input.getPrimaryAudioTrack()
    if (!track || !(await track.canDecode())) return null

    const [sampleRate, numberOfChannels, metadataDuration] = await Promise.all([
      track.getSampleRate(),
      track.getNumberOfChannels(),
      track.getDurationFromMetadata(),
    ])
    throwIfAborted(signal)

    const computedDuration = await track.computeDuration()
    throwIfAborted(signal)

    const duration = Math.max(
      metadataDuration !== null && Number.isFinite(metadataDuration) && metadataDuration > 0
        ? metadataDuration
        : 0,
      Number.isFinite(computedDuration) && computedDuration > 0 ? computedDuration : 0,
    )
    if (duration <= 0) return null

    assertDecodedAudioSizeWithinLimit(duration, sampleRate, numberOfChannels)

    const length = Math.max(1, Math.ceil(duration * sampleRate))
    const output = new AudioBuffer({ length, numberOfChannels, sampleRate })
    const sink = new AudioBufferSink(track)

    for await (const chunk of sink.buffers()) {
      throwIfAborted(signal)

      let destinationOffset = Math.round(chunk.timestamp * sampleRate)
      let sourceOffset = 0

      if (destinationOffset < 0) {
        sourceOffset = -destinationOffset
        destinationOffset = 0
      }

      if (destinationOffset >= output.length) continue

      const availableFrames = output.length - destinationOffset
      const sourceFrames = chunk.buffer.length - sourceOffset
      const framesToCopy = Math.min(availableFrames, sourceFrames)
      if (framesToCopy <= 0) continue

      const channelCount = Math.min(numberOfChannels, chunk.buffer.numberOfChannels)
      for (let channel = 0; channel < channelCount; channel++) {
        const source = chunk.buffer
          .getChannelData(channel)
          .subarray(sourceOffset, sourceOffset + framesToCopy)
        output.copyToChannel(source, channel, destinationOffset)
      }
    }

    throwIfAborted(signal)
    return output
  } finally {
    input.dispose()
  }
}
