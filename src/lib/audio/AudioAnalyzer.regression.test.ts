import { describe, expect, it } from 'vitest'

import { analyzeAudio } from './AudioAnalyzer'
import examples from './known-pcm.fixture.json'

// daf3ac0の実装で採取した出力。期待値にLUFSやステレオ計算式を複製しない。
function pcm(example: (typeof examples)[number]): AudioBuffer {
  const samples = Array.from({ length: example.channels }, (_, channel) =>
    Float32Array.from({ length: example.length }, (_, index) => {
      if (example.pattern === 'silence') return 0
      if (example.pattern === 'tone') {
        return (
          (channel % 2 === 0 ? 1 : -1) *
          Math.sin((2 * Math.PI * 997 * index) / example.sampleRate) *
          0.25
        )
      }
      return (
        ((((index * 17 + channel * 23) % 257) - 128) / 256) *
        (index < example.sampleRate ? 0.01 : index < example.sampleRate * 2 ? 0.5 : 0.25)
      )
    }),
  )
  return {
    sampleRate: example.sampleRate,
    numberOfChannels: example.channels,
    length: example.length,
    duration: example.length / example.sampleRate,
    getChannelData: (channel: number) => samples[channel],
  } as AudioBuffer
}

function expectMetrics(actual: object, expected: object): void {
  for (const [key, value] of Object.entries(expected)) {
    const measured = (actual as Record<string, number>)[key]
    const target = Number(value)
    const difference = Number.isFinite(target)
      ? Math.abs(measured - target)
      : Object.is(measured, target)
        ? 0
        : Infinity
    expect(difference).toBeLessThanOrEqual(1e-9)
  }
}

describe('段階解析と既知PCMの互換性', () => {
  for (const example of examples) {
    it(`${example.name}の数値と波形を旧版と一致させる`, async () => {
      const result = await analyzeAudio(pcm(example))
      expectMetrics(result.loudness, example.expected.loudness)
      expectMetrics(result.stereo, example.expected.stereo)
      const bytes = Uint8Array.from(atob(example.expected.waveformBase64), (char) =>
        char.charCodeAt(0),
      )
      expect(result.waveformPeaks).toEqual(new Float32Array(bytes.buffer))
      expect(result.loudness.truePeak).toBe(result.loudness.samplePeak)
    })
  }

  it('開始前の取消は標本データを読む前に拒否する', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(analyzeAudio({} as AudioBuffer, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
  })

  it('長尺解析の途中で入力イベントを処理し、結果を返さず取り消す', async () => {
    const buffer = pcm({ ...examples[1], length: 48000 * 120 })
    const controller = new AbortController()
    let eventHandled = false
    const timer = setTimeout(() => {
      eventHandled = true
      controller.abort()
    }, 0)
    try {
      await expect(analyzeAudio(buffer, controller.signal)).rejects.toMatchObject({
        name: 'AbortError',
      })
      expect(eventHandled).toBe(true)
    } finally {
      clearTimeout(timer)
    }
  })
})
