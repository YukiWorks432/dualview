import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const control = vi.hoisted(() => ({
  channels: 2,
  length: 8,
  sampleRate: 48000,
  disposed: 0,
  iteratorClosed: 0,
  samples: [] as {
    timestamp: number
    numberOfFrames: number
    numberOfChannels: number
    copyTo: (
      destination: Float32Array,
      options: { planeIndex: number; frameOffset: number; frameCount: number; format: string },
    ) => void
    close: () => void
  }[],
  waiting: null as Promise<void> | null,
  onDispose: null as (() => void) | null,
}))

vi.mock('mediabunny', () => ({
  ALL_FORMATS: [],
  BlobSource: class {},
  Input: class {
    closed = false
    canRead() {
      return Promise.resolve(true)
    }
    getPrimaryAudioTrack() {
      return Promise.resolve({
        canDecode: async () => true,
        getSampleRate: async () => control.sampleRate,
        getNumberOfChannels: async () => control.channels,
        getDurationFromMetadata: async () => control.length / control.sampleRate,
        computeDuration: async () => control.length / control.sampleRate,
      })
    }
    dispose() {
      if (!this.closed) {
        this.closed = true
        control.disposed++
        control.onDispose?.()
      }
    }
  },
  AudioSampleSink: class {
    async *samples() {
      try {
        for (const sample of control.samples) yield sample
        if (control.waiting) await control.waiting
      } finally {
        control.iteratorClosed++
      }
    }
  },
}))

import { extractPrimaryAudioBuffer, MAX_DECODED_AUDIO_BYTES } from './audio'

class TestAudioBuffer {
  readonly sampleRate: number
  readonly numberOfChannels: number
  readonly length: number
  readonly data: Float32Array[]
  constructor(options: AudioBufferOptions) {
    this.length = options.length
    this.sampleRate = options.sampleRate
    this.numberOfChannels = options.numberOfChannels ?? 1
    this.data = Array.from({ length: this.numberOfChannels }, () => new Float32Array(this.length))
  }
  getChannelData(channel: number) {
    return this.data[channel]
  }
}

function sample(timestampFrames: number, channels: number[][]) {
  return {
    timestamp: timestampFrames / control.sampleRate,
    numberOfFrames: channels[0].length,
    numberOfChannels: channels.length,
    copyTo: vi.fn<
      (
        destination: Float32Array,
        options: { planeIndex: number; frameOffset: number; frameCount: number; format: string },
      ) => void
    >(
      (
        destination: Float32Array,
        options: { planeIndex: number; frameOffset: number; frameCount: number; format: string },
      ) => {
        expect(options.format).toBe('f32-planar')
        expect(options.frameCount).toBeLessThanOrEqual(8192)
        destination.set(
          channels[options.planeIndex].slice(
            options.frameOffset,
            options.frameOffset + options.frameCount,
          ),
        )
      },
    ),
    close: vi.fn<() => void>(),
  }
}

beforeEach(() => {
  Object.assign(control, {
    channels: 2,
    length: 8,
    sampleRate: 48000,
    disposed: 0,
    iteratorClosed: 0,
    samples: [],
    waiting: null,
    onDispose: null,
  })
  vi.stubGlobal('AudioBuffer', TestAudioBuffer)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('埋込音声の直接コピーと所有権', () => {
  it('負時刻・隙間・末尾切詰めと多チャンネルを従来どおり配置する', async () => {
    control.channels = 6
    const first = sample(-2, [
      [1, 2, 3, 4],
      [10, 20, 30, 40],
    ])
    const second = sample(
      4,
      Array.from({ length: 6 }, (_, c) => [10, 11, 12, 13, 14, 15].map((value) => value + c * 10)),
    )
    const outside = sample(9, [[100]])
    control.samples = [first, second, outside]
    const output = await extractPrimaryAudioBuffer(new File([], 'fixture.mov'))
    expect(Array.from(output!.getChannelData(0))).toEqual([3, 4, 0, 0, 10, 11, 12, 13])
    expect(Array.from(output!.getChannelData(1))).toEqual([30, 40, 0, 0, 20, 21, 22, 23])
    expect(Array.from(output!.getChannelData(5))).toEqual([0, 0, 0, 0, 60, 61, 62, 63])
    for (const chunk of control.samples) expect(chunk.close).toHaveBeenCalledOnce()
    expect(outside.copyTo).not.toHaveBeenCalled()
    expect(control.disposed).toBe(1)
    expect(control.iteratorClosed).toBe(1)
  })

  it('decode待機中でも取消でInputを破棄し同じ取消理由を返す', async () => {
    const controller = new AbortController()
    const chunk = sample(0, [
      [1, 2],
      [3, 4],
    ])
    control.samples = [chunk]
    control.waiting = new Promise<void>((_, reject) => {
      control.onDispose = () => reject(new Error('Input disposed'))
    })
    const pending = extractPrimaryAudioBuffer(new File([], 'fixture.mov'), controller.signal)
    const rejected = pending.catch((error: unknown) => error)
    await vi.waitFor(() => expect(chunk.close).toHaveBeenCalledOnce())
    controller.abort()
    expect(await rejected).toMatchObject({ name: 'AbortError' })
    expect(control.disposed).toBe(1)
    expect(control.iteratorClosed).toBe(1)
  })

  it('コピー失敗でもsampleとInputを解放する', async () => {
    const chunk = sample(0, [[1], [2]])
    chunk.copyTo.mockImplementation(() => {
      throw new Error('copy failed')
    })
    control.samples = [chunk]
    await expect(extractPrimaryAudioBuffer(new File([], 'fixture.mov'))).rejects.toThrow(
      'copy failed',
    )
    expect(chunk.close).toHaveBeenCalledOnce()
    expect(control.disposed).toBe(1)
    expect(control.iteratorClosed).toBe(1)
  })

  it('512MiB超過を出力PCM確保前に拒否する', async () => {
    control.length = MAX_DECODED_AUDIO_BYTES / 8 + 1
    const allocate = vi.fn<() => void>()
    vi.stubGlobal(
      'AudioBuffer',
      class {
        constructor() {
          allocate()
        }
      },
    )
    await expect(extractPrimaryAudioBuffer(new File([], 'fixture.mov'))).rejects.toThrow(
      /safety limit/,
    )
    expect(allocate).not.toHaveBeenCalled()
    expect(control.disposed).toBe(1)
    expect(control.iteratorClosed).toBe(0)
  })

  it('開始前の取消ではInputもAudioBufferも作らない', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      extractPrimaryAudioBuffer(new File([], 'fixture.mov'), controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(control.disposed).toBe(0)
  })
})
