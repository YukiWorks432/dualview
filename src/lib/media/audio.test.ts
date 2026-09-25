import { describe, expect, it } from 'vitest'

import {
  assertDecodedAudioSizeWithinLimit,
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
