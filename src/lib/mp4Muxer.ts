import {
  BufferTarget,
  EncodedPacket,
  EncodedVideoPacketSource,
  Mp4OutputFormat,
  Output,
} from 'mediabunny'

interface AvcMp4Muxer {
  addChunk: (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => void
  finalize: () => Promise<ArrayBuffer>
}

/**
 * Bridges a manually configured WebCodecs VideoEncoder to Mediabunny's MP4 writer.
 *
 * VideoEncoder output callbacks cannot await async work, so writes are serialized
 * through a promise chain to preserve packet order and writer backpressure.
 */
export async function createAvcMp4Muxer(): Promise<AvcMp4Muxer> {
  const target = new BufferTarget()
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target,
  })
  const source = new EncodedVideoPacketSource('avc')

  output.addVideoTrack(source)
  await output.start()

  let writeQueue = Promise.resolve()

  return {
    addChunk(chunk, meta) {
      const packet = EncodedPacket.fromEncodedChunk(chunk)
      writeQueue = writeQueue.then(() => source.add(packet, meta))
    },

    async finalize() {
      await writeQueue
      source.close()
      await output.finalize()

      if (!target.buffer) {
        throw new Error('MP4 muxing completed without producing an output buffer')
      }

      return target.buffer
    },
  }
}
