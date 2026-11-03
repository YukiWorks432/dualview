/**
 * FIX-001: Undo/Redo System
 * Tracks history of timeline state for undo/redo operations
 */
import { create } from 'zustand'

import type { ClipKeyframes } from '../lib/keyframes'
import { projectSession } from '../lib/projectSession'
import type { TimelineTrack } from '../types'
import { useKeyframeStore } from './keyframeStore'
import { useTimelineStore, type LoopRegion } from './timelineStore'

interface HistoryState {
  session: number
  tracks: TimelineTrack[]
  loopRegion: LoopRegion | null
  keyframes: Map<string, ClipKeyframes>
}

interface HistoryStore {
  past: HistoryState[]
  future: HistoryState[]
  maxHistory: number

  // Actions
  pushState: () => void
  runWithHistory: (action: () => void) => boolean
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  clear: () => void
}

const MAX_HISTORY = 50

// Deep clone tracks to avoid reference issues
const cloneTracks = (tracks: TimelineTrack[]): TimelineTrack[] => {
  return tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => ({ ...clip })),
  }))
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  past: [],
  future: [],
  maxHistory: MAX_HISTORY,

  pushState: () => {
    const timelineState = useTimelineStore.getState()
    const currentState: HistoryState = {
      session: projectSession.capture(),
      tracks: cloneTracks(timelineState.tracks),
      loopRegion: timelineState.loopRegion && { ...timelineState.loopRegion },
      keyframes: structuredClone(useKeyframeStore.getState().clipKeyframes),
    }

    set((state) => ({
      past: [...state.past.slice(-MAX_HISTORY + 1), currentState],
      future: [], // Clear future when new action is performed
    }))
  },

  runWithHistory: (action) => {
    const before = useTimelineStore.getState().tracks
    const beforeLoop = useTimelineStore.getState().loopRegion
    const beforeKeyframes = useKeyframeStore.getState().clipKeyframes
    const session = projectSession.capture()
    action()
    const afterLoop = useTimelineStore.getState().loopRegion
    if (
      useTimelineStore.getState().tracks === before &&
      beforeLoop?.inPoint === afterLoop?.inPoint &&
      beforeLoop?.outPoint === afterLoop?.outPoint &&
      useKeyframeStore.getState().clipKeyframes === beforeKeyframes
    )
      return false
    set((state) => ({
      past: [
        ...state.past.slice(-MAX_HISTORY + 1),
        {
          session,
          tracks: cloneTracks(before),
          loopRegion: beforeLoop && { ...beforeLoop },
          keyframes: structuredClone(beforeKeyframes),
        },
      ],
      future: [],
    }))
    return true
  },

  undo: () => {
    const { past } = get()
    if (past.length === 0) return
    if (!projectSession.isCurrent(past[past.length - 1].session)) {
      get().clear()
      return
    }

    const timelineState = useTimelineStore.getState()
    const currentState: HistoryState = {
      session: projectSession.capture(),
      tracks: cloneTracks(timelineState.tracks),
      loopRegion: timelineState.loopRegion && { ...timelineState.loopRegion },
      keyframes: structuredClone(useKeyframeStore.getState().clipKeyframes),
    }

    const previousState = past[past.length - 1]
    const newPast = past.slice(0, -1)

    // Apply previous state to timeline
    useKeyframeStore.setState({
      clipKeyframes: structuredClone(previousState.keyframes),
      selectedKeyframeId: null,
    })
    useTimelineStore.getState().restoreTracks(cloneTracks(previousState.tracks))
    useTimelineStore.setState({
      loopRegion: previousState.loopRegion && { ...previousState.loopRegion },
    })

    set({
      past: newPast,
      future: [currentState, ...get().future],
    })
  },

  redo: () => {
    const { future } = get()
    if (future.length === 0) return
    if (!projectSession.isCurrent(future[0].session)) {
      get().clear()
      return
    }

    const timelineState = useTimelineStore.getState()
    const currentState: HistoryState = {
      session: projectSession.capture(),
      tracks: cloneTracks(timelineState.tracks),
      loopRegion: timelineState.loopRegion && { ...timelineState.loopRegion },
      keyframes: structuredClone(useKeyframeStore.getState().clipKeyframes),
    }

    const nextState = future[0]
    const newFuture = future.slice(1)

    // Apply next state to timeline
    useKeyframeStore.setState({
      clipKeyframes: structuredClone(nextState.keyframes),
      selectedKeyframeId: null,
    })
    useTimelineStore.getState().restoreTracks(cloneTracks(nextState.tracks))
    useTimelineStore.setState({
      loopRegion: nextState.loopRegion && { ...nextState.loopRegion },
    })

    set({
      past: [...get().past, currentState],
      future: newFuture,
    })
  },

  canUndo: () => {
    const previous = get().past.at(-1)
    return previous !== undefined && projectSession.isCurrent(previous.session)
  },
  canRedo: () => {
    const next = get().future[0]
    return next !== undefined && projectSession.isCurrent(next.session)
  },

  clear: () => set({ past: [], future: [] }),
}))

// Hook to wrap timeline actions with history tracking
export function useHistoryAction() {
  const pushState = useHistoryStore((state) => state.pushState)

  return {
    withHistory: <T extends (...args: unknown[]) => unknown>(action: T) => {
      return ((...args: Parameters<T>) => {
        pushState()
        return action(...args)
      }) as T
    },
    pushState,
  }
}
