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
  dispose: () => Promise<void>
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
  try {
    await output.start()
  } catch (error) {
    await output.cancel()
    throw error
  }

  let writeQueue = Promise.resolve()
  let writeError: unknown
  let disposed = false
  let finalization: Promise<ArrayBuffer> | undefined

  return {
    addChunk(chunk, meta) {
      const packet = EncodedPacket.fromEncodedChunk(chunk)
      writeQueue = writeQueue
        .then(async () => {
          if (disposed || writeError) return
          await source.add(packet, meta)
        })
        .catch((error) => {
          writeError = error
        })
    },

    finalize() {
      finalization ??= (async () => {
        await writeQueue
        if (writeError) throw writeError
        if (disposed) throw new Error('MP4 export cancelled')
        source.close()
        await output.finalize()

        if (!target.buffer) {
          throw new Error('MP4 muxing completed without producing an output buffer')
        }

        return target.buffer
      })()
      return finalization
    },

    async dispose() {
      if (disposed) return
      disposed = true
      source.close()
      if (output.state !== 'finalized') await output.cancel()
      await writeQueue
      // Mediabunny cannot cancel a finalization already in progress. Keep ownership
      // until it settles, including its failure cleanup, before releasing the job.
      await finalization?.catch(() => {})
    },
  }
}
