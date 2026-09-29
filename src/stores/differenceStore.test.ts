import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DifferenceRequest, DifferenceWorkerMessage } from '../lib/difference/model'
import { useDifferenceStore } from './differenceStore'
class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: MessageEvent<DifferenceWorkerMessage>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: (() => void) | null = null
  terminate = vi.fn()
  postMessage = vi.fn()
  constructor() {
    FakeWorker.instances.push(this)
  }
  emit(message: DifferenceWorkerMessage) {
    this.onmessage?.({ data: message } as MessageEvent<DifferenceWorkerMessage>)
  }
}
const request: DifferenceRequest = {
  key: 'project-a',
  duration: 1,
  clipsA: [],
  clipsB: [],
  media: [],
  options: { pixelThreshold: 0.1, resolution: 'standard' },
}
const batch = {
  samples: [{ start: 0, end: 0.5, ratio: 0.05, state: 'compared' as const }],
  processedUntil: 0.5,
}
beforeEach(() => {
  useDifferenceStore.getState().cancel()
  useDifferenceStore.setState(useDifferenceStore.getInitialState())
  FakeWorker.instances = []
  vi.stubGlobal('Worker', FakeWorker)
  vi.stubGlobal('OffscreenCanvas', class {})
})
afterEach(() => {
  useDifferenceStore.getState().cancel()
  vi.unstubAllGlobals()
})
describe('difference analysis lifecycle', () => {
  it('changes the area threshold from stored scores without starting another decoder', () => {
    useDifferenceStore.getState().start(request)
    const worker = FakeWorker.instances[0]
    const jobId = useDifferenceStore.getState().jobId
    worker.emit({ type: 'progress', jobId, batch })
    expect(useDifferenceStore.getState().regions).toHaveLength(1)
    useDifferenceStore.getState().setAreaThreshold(0.1)
    expect(useDifferenceStore.getState().regions).toHaveLength(0)
    expect(worker.postMessage).toHaveBeenCalledTimes(1)
    expect(FakeWorker.instances).toHaveLength(1)
    worker.emit({ type: 'complete', jobId })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it('keeps partial coverage when stopped and rejects a late completion', () => {
    useDifferenceStore.getState().start(request)
    const worker = FakeWorker.instances[0]
    const jobId = useDifferenceStore.getState().jobId
    worker.emit({ type: 'progress', jobId, batch })
    useDifferenceStore.getState().cancel()
    worker.emit({ type: 'complete', jobId })
    expect(useDifferenceStore.getState().status).toBe('cancelled')
    expect(useDifferenceStore.getState().processedUntil).toBe(0.5)
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it('clears obsolete results and ignores late messages from a previous job', () => {
    useDifferenceStore.getState().start(request)
    const oldWorker = FakeWorker.instances[0]
    const oldId = useDifferenceStore.getState().jobId
    oldWorker.emit({ type: 'progress', jobId: oldId, batch })
    useDifferenceStore.getState().invalidate()
    expect(useDifferenceStore.getState().regions).toHaveLength(0)
    expect(useDifferenceStore.getState().status).toBe('stale')
    useDifferenceStore.getState().start({ ...request, key: 'project-b' })
    oldWorker.emit({ type: 'progress', jobId: oldId, batch })
    expect(useDifferenceStore.getState().batches).toHaveLength(0)
    expect(useDifferenceStore.getState().key).toBe('project-b')
  })
  it('invalidates decoding settings without automatically re-running', () => {
    useDifferenceStore.getState().start(request)
    useDifferenceStore.getState().setOptions({ pixelThreshold: 0.2 })
    expect(useDifferenceStore.getState().status).toBe('stale')
    expect(FakeWorker.instances).toHaveLength(1)
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce()
  })
  it('reports missing capabilities rather than a successful zero-difference scan', () => {
    vi.stubGlobal('OffscreenCanvas', undefined)
    useDifferenceStore.getState().start(request)
    expect(useDifferenceStore.getState().status).toBe('unsupported')
    expect(useDifferenceStore.getState().error).toBeTruthy()
    expect(FakeWorker.instances).toHaveLength(0)
  })
})
