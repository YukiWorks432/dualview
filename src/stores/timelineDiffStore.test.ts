import { describe, expect, it } from 'vitest'

import { useTimelineDiffStore } from './timelineDiffStore'

describe('timeline difference session results', () => {
  it('keeps inspected frames on cancellation and clears results when analysis inputs change', () => {
    const store = useTimelineDiffStore.getState()
    store.beginAnalysis('cancelled-job', 'input-fingerprint')
    store.appendFrames(
      'cancelled-job',
      [
        {
          startTime: 0,
          endTime: 0.5,
          sampleTime: 0.25,
          differenceRate: 0.2,
          status: 'compared',
          clipAId: 'a',
          clipBId: 'b',
        },
      ],
      1,
      4,
    )
    store.requestCancellation('cancelled-job')
    store.finishAnalysis('cancelled-job', 'partial', 'Stopped by user')

    expect(useTimelineDiffStore.getState().status).toBe('partial')
    expect(useTimelineDiffStore.getState().frames).toHaveLength(1)
    expect(useTimelineDiffStore.getState().segments).toHaveLength(1)

    useTimelineDiffStore.getState().setColorThreshold(0.2)

    expect(useTimelineDiffStore.getState().status).toBe('stale')
    expect(useTimelineDiffStore.getState().frames).toHaveLength(0)
    expect(useTimelineDiffStore.getState().segments).toHaveLength(0)
  })
})
