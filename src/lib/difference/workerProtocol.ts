import type { NormalizedDifferenceRegion } from './regions'

export interface DifferenceWorkerRequest {
  type: 'analyze'
  id: number
  a: ArrayBuffer
  b: ArrayBuffer
  width: number
  height: number
  threshold: number
  minPixels: number
  mergeGap: number
  padding: number
  maxRegions: number
}

export type DifferenceWorkerResponse =
  | {
      type: 'result'
      id: number
      diffPixelCount: number
      regions: NormalizedDifferenceRegion[]
    }
  | {
      type: 'error'
      id: number
      message: string
    }
