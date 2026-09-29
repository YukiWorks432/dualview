import { create } from 'zustand'

export type DifferenceNoiseFilter = 'off' | 'low' | 'medium' | 'high'
export type DifferenceAnalysisQuality = 'auto' | 'full'
export type DifferenceRuntimeStatus =
  | 'idle'
  | 'syncing'
  | 'analyzing'
  | 'same'
  | 'different'
  | 'unavailable'

export interface DifferenceRuntimeState {
  status: DifferenceRuntimeStatus
  message: string
  approximate: boolean
}

interface DifferenceHighlightStore {
  enabled: boolean
  sensitivity: number
  noiseFilter: DifferenceNoiseFilter
  analysisQuality: DifferenceAnalysisQuality
  runtime: DifferenceRuntimeState
  setEnabled: (enabled: boolean) => void
  setSensitivity: (sensitivity: number) => void
  setNoiseFilter: (noiseFilter: DifferenceNoiseFilter) => void
  setAnalysisQuality: (analysisQuality: DifferenceAnalysisQuality) => void
  setRuntime: (runtime: DifferenceRuntimeState) => void
}

export const DEFAULT_DIFFERENCE_RUNTIME: DifferenceRuntimeState = {
  status: 'idle',
  message: 'Ready to compare the current A/B frames',
  approximate: false,
}

export const useDifferenceHighlightStore = create<DifferenceHighlightStore>((set) => ({
  enabled: false,
  sensitivity: 60,
  noiseFilter: 'low',
  analysisQuality: 'auto',
  runtime: DEFAULT_DIFFERENCE_RUNTIME,
  setEnabled: (enabled) =>
    set({
      enabled,
      runtime: enabled
        ? DEFAULT_DIFFERENCE_RUNTIME
        : {
            status: 'idle',
            message: 'Difference region highlighting is off',
            approximate: false,
          },
    }),
  setSensitivity: (sensitivity) =>
    set({ sensitivity: Math.max(0, Math.min(100, Math.round(sensitivity))) }),
  setNoiseFilter: (noiseFilter) => set({ noiseFilter }),
  setAnalysisQuality: (analysisQuality) => set({ analysisQuality }),
  setRuntime: (runtime) => set({ runtime }),
}))
