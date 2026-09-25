import { describe, expect, it } from 'vitest'

import { LatestRequestGate } from './requestGate'

describe('LatestRequestGate', () => {
  it('rejects a frame result after a newer request starts', () => {
    const gate = new LatestRequestGate()
    const first = gate.begin()
    const second = gate.begin()

    expect(gate.isCurrent(first)).toBe(false)
    expect(gate.isCurrent(second)).toBe(true)
  })

  it('keeps delayed frames in the same playback sequence presentable', () => {
    const gate = new LatestRequestGate()
    const playbackGeneration = gate.begin()

    const firstDecodedFrame = playbackGeneration
    const laterDecodedFrame = playbackGeneration

    expect(gate.isCurrent(firstDecodedFrame)).toBe(true)
    expect(gate.isCurrent(laterDecodedFrame)).toBe(true)
  })

  it('invalidates the previous playback sequence after a discontinuous seek', () => {
    const gate = new LatestRequestGate()
    const previousSequence = gate.begin()

    const seekSequence = gate.begin()

    expect(gate.isCurrent(previousSequence)).toBe(false)
    expect(gate.isCurrent(seekSequence)).toBe(true)
  })

  it('invalidates pending results when disposed', () => {
    const gate = new LatestRequestGate()
    const request = gate.begin()

    gate.invalidate()

    expect(gate.isCurrent(request)).toBe(false)
  })
})
