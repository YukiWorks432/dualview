import { describe, expect, it, vi } from 'vitest'

import {
  assertDecodedAudioSizeWithinLimit,
  assertAudioProcessingSizeWithinLimit,
  AudioSourceRegistry,
  createAudioPlaybackSource,
  estimateAudioProcessingBytes,
  MAX_AUDIO_PROCESSING_BYTES,
  MAX_DECODED_AUDIO_BYTES,
  estimateDecodedAudioBytes,
  PlaybackRequestGate,
} from './audio'

describe('PlaybackRequestGate', () => {
  it('invalidates a start request that is still waiting to resume', async () => {
    const gate = new PlaybackRequestGate()
    const request = gate.begin()

    let releaseResume: (() => void) | undefined
    const resume = new Promise<void>((resolve) => {
      releaseResume = resolve
    })

    const canStartAfterResume = (async () => {
      await resume
      return gate.isCurrent(request)
    })()

    gate.invalidate()
    releaseResume?.()

    await expect(canStartAfterResume).resolves.toBe(false)
  })

  it('keeps only the newest start request current', () => {
    const gate = new PlaybackRequestGate()
    const first = gate.begin()
    const second = gate.begin()

    expect(gate.isCurrent(first)).toBe(false)
    expect(gate.isCurrent(second)).toBe(true)
  })
})

describe('decoded audio memory guard', () => {
  it('estimates Float32 PCM storage before allocating an AudioBuffer', () => {
    expect(estimateDecodedAudioBytes(60, 48_000, 2)).toBe(23_040_000)
  })

  it('rejects inputs above the configured decoded-audio limit', () => {
    expect(() => assertDecodedAudioSizeWithinLimit(60, 48_000, 2, 10_000_000)).toThrow(
      /safety limit/,
    )
  })
})

describe('音声解析の全体予算', () => {
  it('単体512MiBの境界を保ち、A/Bそれぞれが上限でも受け入れる', () => {
    const duration = MAX_DECODED_AUDIO_BYTES / (48_000 * 2 * 4)
    expect(() => assertDecodedAudioSizeWithinLimit(duration, 48_000, 2)).not.toThrow()
    expect(() => assertDecodedAudioSizeWithinLimit(duration + 1 / 48_000, 48_000, 2)).toThrow(
      /safety limit/,
    )
    expect(() =>
      assertAudioProcessingSizeWithinLimit(duration, 48_000, 2, MAX_DECODED_AUDIO_BYTES),
    ).not.toThrow()
    expect(estimateAudioProcessingBytes(duration, 48_000, 2, MAX_DECODED_AUDIO_BYTES)).toBeLessThan(
      MAX_AUDIO_PROCESSING_BYTES,
    )
  })

  it('他方PCM・出力・decode余裕・解析領域を合算し、総予算超過を確保前に拒否する', () => {
    const bytes = estimateAudioProcessingBytes(120, 48_000, 6, 1_000_000)
    expect(bytes).toBeGreaterThan(1_000_000 + 2 * 120 * 48_000 * 6 * 4)
    expect(() =>
      assertAudioProcessingSizeWithinLimit(120, 48_000, 6, 1_000_000, bytes),
    ).not.toThrow()
    expect(() =>
      assertAudioProcessingSizeWithinLimit(120, 48_000, 6, 1_000_000, bytes - 1),
    ).toThrow(/safety budget/)
  })

  it('低標本化周波数monoの長尺でも従来の入力上限を減らさない', () => {
    for (const rate of [3000, 8000, 44_100, 48_000, 96_000, 384_000]) {
      const duration = MAX_DECODED_AUDIO_BYTES / (rate * 4)
      expect(() =>
        assertAudioProcessingSizeWithinLimit(duration, rate, 1, MAX_DECODED_AUDIO_BYTES),
      ).not.toThrow()
    }
  })
})

describe('再生中PCMの解放', () => {
  it('素材切替の停止時にsourceとgainを切離し、buffer参照を消す', () => {
    const source = {
      buffer: null,
      playbackRate: { value: 1 },
      connect: vi.fn<() => void>(),
      disconnect: vi.fn<() => void>(),
      start: vi.fn<() => void>(),
      stop: vi.fn<() => void>(),
      onended: null,
    } as unknown as AudioBufferSourceNode
    const gain = {
      gain: { value: 1 },
      connect: vi.fn<() => void>(),
      disconnect: vi.fn<() => void>(),
    } as unknown as GainNode
    const context = {
      createBufferSource: () => source,
      createGain: () => gain,
      destination: {},
    } as unknown as AudioContext
    const buffer = { duration: 5 } as AudioBuffer
    const registry = new AudioSourceRegistry()
    registry.replace('a', createAudioPlaybackSource(context, buffer, 1, 1, 0))
    expect(source.buffer).toBe(buffer)
    registry.stop('a')
    expect(source.stop).toHaveBeenCalledOnce()
    expect(source.disconnect).toHaveBeenCalledOnce()
    expect(gain.disconnect).toHaveBeenCalledOnce()
    expect(source.buffer).toBeNull()
    registry.stopAll()
    expect(source.stop).toHaveBeenCalledOnce()
  })
})
