import { create } from 'zustand'

import {
  appendRegions,
  DEFAULT_DIFFERENCE_OPTIONS,
  regionsFromBatches,
  validateOptions,
} from '../lib/difference/model'
import type {
  DifferenceBatch,
  DifferenceOptions,
  DifferenceRegion,
  DifferenceRequest,
  DifferenceWorkerMessage,
} from '../lib/difference/model'

type AnalysisStatus =
  | 'idle'
  | 'running'
  | 'complete'
  | 'cancelled'
  | 'stale'
  | 'error'
  | 'unsupported'
interface DifferenceStore {
  status: AnalysisStatus
  key: string | null
  jobId: number
  options: DifferenceOptions
  areaThreshold: number
  batches: DifferenceBatch[]
  regions: DifferenceRegion[]
  descriptions: string[]
  duration: number
  processedUntil: number
  compared: number
  unavailable: number
  error: string | null
  start: (request: DifferenceRequest) => void
  cancel: () => void
  invalidate: () => void
  setOptions: (options: Partial<DifferenceOptions>) => void
  setAreaThreshold: (threshold: number) => void
}
let activeWorker: Worker | null = null
let generation = 0
function releaseWorker(): void {
  activeWorker?.terminate()
  activeWorker = null
}
const emptyResult = {
  batches: [] as DifferenceBatch[],
  regions: [] as DifferenceRegion[],
  descriptions: [] as string[],
  processedUntil: 0,
  compared: 0,
  unavailable: 0,
  error: null,
}
export const useDifferenceStore = create<DifferenceStore>((set, get) => ({
  ...emptyResult,
  status: 'idle',
  key: null,
  jobId: 0,
  duration: 0,
  options: { ...DEFAULT_DIFFERENCE_OPTIONS },
  areaThreshold: 0.01,
  start: (request) => {
    releaseWorker()
    const jobId = ++generation
    set({ ...emptyResult, jobId, key: request.key, duration: request.duration, status: 'running' })
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
      set({
        status: 'unsupported',
        error: 'This browser does not support background frame analysis.',
      })
      return
    }
    try {
      validateOptions(request.options)
      const worker = new Worker(new URL('../workers/difference.worker.ts', import.meta.url), {
        type: 'module',
      })
      activeWorker = worker
      const isCurrent = () => generation === jobId && activeWorker === worker
      const fail = (message: string) => {
        if (!isCurrent()) return
        releaseWorker()
        set({ status: 'error', error: message })
      }
      worker.onmessage = (event: MessageEvent<DifferenceWorkerMessage>) => {
        const message = event.data
        if (!isCurrent() || message.jobId !== jobId) return
        if (message.type === 'progress') {
          set((state) => ({
            batches: [...state.batches, message.batch],
            regions: appendRegions(state.regions, message.batch.samples, state.areaThreshold),
            processedUntil: message.batch.processedUntil,
            compared:
              state.compared +
              message.batch.samples.filter((sample) => sample.state === 'compared').length,
            unavailable:
              state.unavailable +
              message.batch.samples.filter((sample) => sample.state !== 'compared').length,
          }))
        } else if (message.type === 'metadata') set({ descriptions: message.descriptions })
        else if (message.type === 'complete') {
          releaseWorker()
          set({ status: 'complete' })
        } else fail(message.message)
      }
      worker.onerror = (event) => fail(event.message || 'The analysis worker failed.')
      worker.onmessageerror = () => fail('The analysis worker returned an unreadable result.')
      worker.postMessage({ jobId, request })
    } catch (error) {
      releaseWorker()
      set({ status: 'error', error: error instanceof Error ? error.message : String(error) })
    }
  },
  cancel: () => {
    if (get().status !== 'running') return
    generation++
    // Termination also interrupts a decoder that is still awaiting a frame.
    releaseWorker()
    set({ status: 'cancelled' })
  },
  invalidate: () => {
    const hadResult = get().status !== 'idle'
    generation++
    releaseWorker()
    set({ ...emptyResult, key: null, status: hadResult ? 'stale' : 'idle' })
  },
  setOptions: (options) => {
    const next = { ...get().options, ...options }
    validateOptions(next)
    if (
      next.pixelThreshold === get().options.pixelThreshold &&
      next.resolution === get().options.resolution
    )
      return
    get().invalidate()
    set({ options: next })
  },
  setAreaThreshold: (threshold) => {
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) return
    set({ areaThreshold: threshold, regions: regionsFromBatches(get().batches, threshold) })
  },
}))
