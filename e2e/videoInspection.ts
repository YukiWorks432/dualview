import { ALL_FORMATS, BlobSource, Input, VideoSampleSink } from 'mediabunny'

/** 試験専用。表示要素のシーク完了ではなく、要求時刻の復号済みサンプルを読む。
 * https://mediabunny.dev/api/VideoSampleSink
 */
export async function inspectEncodedVideo(bytes: number[], mime: string, time: number) {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(new Blob([new Uint8Array(bytes)], { type: mime })),
  })
  try {
    const track = await input.getPrimaryVideoTrack()
    if (!track || !(await track.canDecode()))
      throw new Error('Artifact has no decodable video track')
    const sample = await new VideoSampleSink(track).getSample(time)
    if (!sample) throw new Error(`Artifact has no frame at ${time}`)
    try {
      if (sample.timestamp > time || time >= sample.timestamp + sample.duration) {
        throw new Error(
          `Artifact frame [${sample.timestamp}, ${sample.timestamp + sample.duration}) does not contain ${time}`,
        )
      }
      const canvas = document.createElement('canvas')
      canvas.width = sample.displayWidth
      canvas.height = sample.displayHeight
      const context = canvas.getContext('2d')!
      sample.draw(context, 0, 0)
      const pixel = (x: number) =>
        Array.from(
          context.getImageData(Math.round(canvas.width * x), Math.round(canvas.height * 0.5), 1, 1)
            .data,
        )
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      let coloredPixels = 0
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (
          Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]) -
            Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]) >
          30
        )
          coloredPixels++
      }
      return {
        coloredPixels,
        width: canvas.width,
        height: canvas.height,
        duration: await input.computeDuration(),
        left: pixel(0.2),
        right: pixel(0.9),
        frameTimestamp: sample.timestamp,
        frameDuration: sample.duration,
      }
    } finally {
      sample.close()
    }
  } finally {
    input.dispose()
  }
}
