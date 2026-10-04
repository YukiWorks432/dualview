import { describe, expect, it } from 'vitest'

import { browserProcessSample, summarizeMemory } from './process-memory.mjs'

describe('dedicated browser resident-memory evidence', () => {
  it('includes all generations even when rows are unordered, and excludes other browsers', () => {
    expect(
      browserProcessSample('40 30 50\n10 1 100\n30 20 25\n20 10 200\n11 1 999\n12 11 888', 10),
    ).toEqual({
      processes: [
        { pid: 40, ppid: 30, rssKiB: 50 },
        { pid: 10, ppid: 1, rssKiB: 100 },
        { pid: 30, ppid: 20, rssKiB: 25 },
        { pid: 20, ppid: 10, rssKiB: 200 },
      ],
      rssBytes: 384000,
    })
  })
  it('rejects a missing browser or unreadable RSS instead of reporting a zero peak', () => {
    expect(() => browserProcessSample('11 1 999', 10)).toThrow('missing')
    expect(() => browserProcessSample('10 1 ? ', 10)).toThrow('Malformed')
  })
  it('preserves missing phases and excludes samples spanning a phase transition', () => {
    const summary = summarizeMemory([
      { phase: 'completed', phaseAtEnd: 'completed', rssBytes: 100 },
      { phase: 'completed', phaseAtEnd: 'completed', rssBytes: null, error: 'ps failed' },
      { phase: 'completed', phaseAtEnd: 'exited', rssBytes: 1000 },
      { phase: 'exited', phaseAtEnd: 'exited', rssBytes: 80 },
    ])
    expect(summary.completed).toEqual({
      samples: 2,
      missing: 1,
      observedMaxRssBytes: 100,
      observedMinRssBytes: 100,
    })
    expect(summary['before-audio'].observedMaxRssBytes).toBeNull()
    expect(summary.exited.observedMaxRssBytes).toBe(80)
    expect(summary.overall).toEqual({
      samples: 4,
      missing: 1,
      observedMaxRssBytes: 1000,
      observedMinRssBytes: 80,
    })
  })
})
