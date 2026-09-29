import { create } from 'zustand'

import {
  appendTimelineDiffSegments,
  buildTimelineDiffSegments,
  type TimelineDiffFrameScore,
  type TimelineDiffSegment,
} from '../lib/media/timelineDiff'

export type TimelineDiffResolution = 'standard' | 'detailed'
export type TimelineDiffAnalysisStatus =
  | 'idle'
  | 'analyzing'
  | 'cancelling'
  | 'complete'
  | 'partial'
  | 'stale'
  | 'unsupported'
  | 'error'

interface TimelineDiffStore {
  colorThreshold: number
  areaThreshold: number
  resolution: TimelineDiffResolution
  status: TimelineDiffAnalysisStatus
  message: string | null
  progress: number
  completedFrames: number
  totalFrames: number
  jobId: string | null
  sourceFingerprint: string | null
  frames: TimelineDiffFrameScore[]
  segments: TimelineDiffSegment[]

  setColorThreshold: (threshold: number) => void
  setAreaThreshold: (threshold: number) => void
  setResolution: (resolution: TimelineDiffResolution) => void
  beginAnalysis: (jobId: string, sourceFingerprint: string) => void
  appendFrames: (
    jobId: string,
    frames: TimelineDiffFrameScore[],
    completedFrames: number,
    totalFrames: number,
  ) => void
  requestCancellation: (jobId: string) => void
  finishAnalysis: (
    jobId: string,
    status: 'complete' | 'partial' | 'unsupported' | 'error',
    message?: string,
  ) => void
  invalidate: (message?: string) => void
}

function clampThreshold(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function markSettingsStale(
  state: TimelineDiffStore,
  updates: Partial<Pick<TimelineDiffStore, 'colorThreshold' | 'resolution'>>,
) {
  const hasAnalysis = state.status !== 'idle' || state.frames.length > 0
  return {
    ...updates,
    ...(hasAnalysis
      ? {
          status: 'stale' as const,
          message: 'Analysis settings changed. Run the comparison again.',
          progress: 0,
          completedFrames: 0,
          totalFrames: 0,
          jobId: null,
          sourceFingerprint: null,
          frames: [],
          segments: [],
        }
      : {}),
  }
}

export const useTimelineDiffStore = create<TimelineDiffStore>((set) => ({
  colorThreshold: 0.1,
  areaThreshold: 0.01,
  resolution: 'standard',
  status: 'idle',
  message: null,
  progress: 0,
  completedFrames: 0,
  totalFrames: 0,
  jobId: null,
  sourceFingerprint: null,
  frames: [],
  segments: [],

  setColorThreshold: (threshold) =>
    set((state) => {
      const colorThreshold = clampThreshold(threshold)
      return colorThreshold === state.colorThreshold
        ? state
        : markSettingsStale(state, { colorThreshold })
    }),

  setAreaThreshold: (threshold) =>
    set((state) => {
      const areaThreshold = clampThreshold(threshold)
      if (areaThreshold === state.areaThreshold) return state
      return {
        areaThreshold,
        segments: buildTimelineDiffSegments(state.frames, areaThreshold),
      }
    }),

  setResolution: (resolution) =>
    set((state) =>
      resolution === state.resolution ? state : markSettingsStale(state, { resolution }),
    ),

  beginAnalysis: (jobId, sourceFingerprint) =>
    set({
      status: 'analyzing',
      message: null,
      progress: 0,
      completedFrames: 0,
      totalFrames: 0,
      jobId,
      sourceFingerprint,
      frames: [],
      segments: [],
    }),

  appendFrames: (jobId, batch, completedFrames, totalFrames) =>
    set((state) => {
      if (state.jobId !== jobId) return state
      const frames = state.frames.concat(batch)
      return {
        frames,
        segments: appendTimelineDiffSegments(
          state.segments,
          state.frames,
          batch,
          state.areaThreshold,
        ),
        completedFrames,
        totalFrames,
        progress: totalFrames > 0 ? Math.min(100, (completedFrames / totalFrames) * 100) : 0,
      }
    }),

  requestCancellation: (jobId) =>
    set((state) =>
      state.jobId === jobId && state.status === 'analyzing'
        ? { status: 'cancelling', message: 'Stopping analysis…' }
        : state,
    ),

  finishAnalysis: (jobId, status, message) =>
    set((state) =>
      state.jobId === jobId
        ? {
            status,
            message: message ?? null,
            jobId: null,
            progress: status === 'complete' ? 100 : state.progress,
          }
        : state,
    ),

  invalidate: (message = 'Timeline or media changed. Run the comparison again.') =>
    set((state) => {
      const hasAnalysis = state.status !== 'idle' || state.frames.length > 0
      if (!hasAnalysis) return state
      return {
        status: 'stale',
        message,
        progress: 0,
        completedFrames: 0,
        totalFrames: 0,
        jobId: null,
        sourceFingerprint: null,
        frames: [],
        segments: [],
      }
    }),
}))
