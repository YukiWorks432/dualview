import { ALL_FORMATS, AudioBufferSink, BlobSource, Input } from 'mediabunny'

export function createAudioPlaybackSource(
  context: AudioContext,
  buffer: AudioBuffer | null,
  playbackRate: number,
  volume: number,
  offset: number,
): AudioBufferSourceNode | null {
  if (!buffer || offset >= buffer.duration) return null

  const source = context.createBufferSource()
  const gain = context.createGain()
  source.buffer = buffer
  source.playbackRate.value = playbackRate
  gain.gain.value = volume
  source.connect(gain)
  gain.connect(context.destination)
  source.start(0, Math.max(0, offset))
  return source
}

export class AudioSourceRegistry {
  private sources = new Set<AudioBufferSourceNode>()

  track(...sources: Array<AudioBufferSourceNode | null>): void {
    for (const source of sources) {
      if (!source) continue
      this.sources.add(source)
      source.onended = () => {
        this.sources.delete(source)
      }
    }
  }

  stopAll(): void {
    for (const source of this.sources) {
      try {
        source.stop()
      } catch {
        // The source may already have ended.
      }
    }
    this.sources.clear()
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

export async function extractPrimaryAudioBuffer(file: File): Promise<AudioBuffer | null> {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(file),
  })

  try {
    if (!(await input.canRead())) return null

    const track = await input.getPrimaryAudioTrack()
    if (!track || !(await track.canDecode())) return null

    const [sampleRate, numberOfChannels] = await Promise.all([
      track.getSampleRate(),
      track.getNumberOfChannels(),
    ])
    const sink = new AudioBufferSink(track)
    const chunks: Array<{ buffer: AudioBuffer; timestamp: number; duration: number }> = []
    let endTimestamp = 0

    for await (const chunk of sink.buffers()) {
      chunks.push(chunk)
      endTimestamp = Math.max(endTimestamp, chunk.timestamp + chunk.duration)
    }

    if (chunks.length === 0 || endTimestamp <= 0) return null

    const length = Math.max(1, Math.ceil(endTimestamp * sampleRate))
    const output = new AudioBuffer({ length, numberOfChannels, sampleRate })

    for (const chunk of chunks) {
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

    return output
  } finally {
    input.dispose()
  }
}
