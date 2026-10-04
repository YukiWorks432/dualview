import { describe, expect, it } from 'vitest'

import { summarizeTrial, summarizeGroups } from './production-ui-summary.mjs'

describe('production UI evidence boundaries', () => {
  it('uses the active analysis signal, excludes unrelated aborts, and keeps window edges', () => {
    const events = [
      { kind: 'ui:measurement-start', at: 0 },
      {
        kind: 'dom:click',
        at: 10,
        label: 'Slider comparison mode',
        active: [{ name: 'analyzeAudio', call: 2, signalId: 3 }],
      },
      { kind: 'controller:abort-call', at: 11, signalId: 9 },
      { kind: 'controller:abort-call', at: 20, signalId: 3 },
      { kind: 'analyzeAudio:rejected', at: 25, call: 2, errorName: 'AbortError' },
      { kind: 'queue:release', at: 26 },
      { kind: 'ui:slider-frame-2', at: 30 },
      { kind: 'timer:heartbeat', at: 40 },
      { kind: 'ui:measurement-end', at: 100 },
    ]
    expect(summarizeTrial({ valid: true, cancel: true, observation: { events } })).toEqual({
      domToAbortMs: 10,
      abortToRejectionMs: 5,
      domToQueueReleaseMs: 16,
      domToFrameOpportunityMs: 20,
      audioEntryToResultsOpportunityMs: null,
      maxHeartbeatGapMs: 60,
    })
  })
  it('does not turn missing, failed or reversed boundaries into zero latency', () => {
    expect(summarizeTrial({ valid: false })).toBeNull()
    expect(summarizeTrial({ valid: true, error: 'timeout' })).toBeNull()
    expect(summarizeTrial({ valid: true, pageErrors: ['error'] })).toBeNull()
    const result = summarizeTrial({
      valid: true,
      cancel: true,
      observation: {
        events: [
          { kind: 'dom:click', label: 'Slider comparison mode', at: 50 },
          { kind: 'ui:slider-frame-2', at: 40 },
        ],
      },
    })
    expect(Object.values(result).every((value) => value === null)).toBe(true)
  })
  it('reports failures and missing observations without pooling CPU conditions', () => {
    const groups = summarizeGroups([
      { rate: 1, cancel: true, metrics: { domToAbortMs: 9 } },
      { rate: 1, cancel: true, metrics: null },
      { rate: 1, cancel: true, metrics: { domToAbortMs: 3 } },
      { rate: 4, cancel: true, metrics: { domToAbortMs: 90 } },
    ])
    expect(groups[0]).toMatchObject({
      attempted: 3,
      valid: 2,
      metrics: {
        domToAbortMs: {
          n: 2,
          missing: 1,
          values: [9, 3],
          min: 3,
          median: 6,
          max: 9,
        },
      },
    })
    expect(groups[2].metrics.domToAbortMs.median).toBe(90)
  })
})
