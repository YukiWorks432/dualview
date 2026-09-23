import { ALL_FORMATS, BlobSource, CanvasSink, Input } from 'mediabunny'

export interface VideoProbeResult {
  codec: string | null
  duration: number
  width: number
  height: number
  hasAlpha: boolean
  decodable: boolean
  thumbnail?: string
}

let proResRegistration: Promise<void> | null = null

export function ensureProResDecoder(): Promise<void> {
  if (!proResRegistration) {
    proResRegistration = import('@mediabunny/prores')
      .then(({ registerProresDecoder }) => {
        registerProresDecoder()
      })
      .catch((error) => {
        proResRegistration = null
        throw error
      })
  }
  return proResRegistration
}

export async function probeVideoFile(file: File): Promise<VideoProbeResult> {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(file),
  })

  try {
    if (!(await input.canRead())) {
      throw new Error('Unsupported video container')
    }

    const track = await input.getPrimaryVideoTrack()
    if (!track) {
      throw new Error('No video track found')
    }

    const codec = await track.getCodec()
    if (codec === 'prores') {
      await ensureProResDecoder()
    }

    const [width, height, metadataDuration, hasAlpha, decodable] = await Promise.all([
      track.getDisplayWidth(),
      track.getDisplayHeight(),
      track.getDurationFromMetadata(),
      track.canBeTransparent(),
      track.canDecode(),
    ])

    const duration =
      metadataDuration !== null && Number.isFinite(metadataDuration) && metadataDuration > 0
        ? metadataDuration
        : await track.computeDuration()

    let thumbnail: string | undefined
    if (codec === 'prores' && decodable) {
      const sink = new CanvasSink(track, {
        width: 160,
        alpha: hasAlpha,
        poolSize: 1,
      })
      const firstTimestamp = Math.max(0, await track.getFirstTimestamp())
      const frame = await sink.getCanvas(firstTimestamp)
      if (frame?.canvas instanceof HTMLCanvasElement) {
        thumbnail = frame.canvas.toDataURL('image/jpeg', 0.7)
      }
    }

    return {
      codec,
      duration,
      width,
      height,
      hasAlpha,
      decodable,
      thumbnail,
    }
  } finally {
    input.dispose()
  }
}
