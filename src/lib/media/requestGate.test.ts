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

  it('keeps the current request valid without beginning a newer request', () => {
    const gate = new LatestRequestGate()
    const request = gate.begin()

    expect(gate.isCurrent(request)).toBe(true)
  })

  it('invalidates pending results when disposed', () => {
    const gate = new LatestRequestGate()
    const request = gate.begin()

    gate.invalidate()

    expect(gate.isCurrent(request)).toBe(false)
  })
})
