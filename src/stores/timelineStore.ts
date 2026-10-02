import { create, type StateCreator, type StoreApi, type UseBoundStore } from 'zustand'

import { calculateTimelineDuration, sliceClip } from '../lib/media/timeline'
import { generateId, snapTimeToFrame } from '../lib/utils'
import type { TimelineTrack, TimelineClip, MediaType, TrackType } from '../types'
import { useKeyframeStore } from './keyframeStore'
import { useMediaStore } from './mediaStore'
import { usePlaybackStore } from './playbackStore'

// Track colors for visual distinction
const TRACK_COLORS: Record<TrackType, string> = {
  a: '#f97316', // orange
  b: '#a3e635', // lime
  audio: '#60a5fa', // blue
  text: '#c084fc', // purple
  media: '#4ade80', // green
}

interface LoopRegion {
  inPoint: number
  outPoint: number
}

export interface TimelineMarker {
  id: string
  time: number
  label: string
  color?: string
}

interface TimelineStore {
  tracks: TimelineTrack[]
  // Read-only playback projection. Use playback actions to change these values.
  currentTime: number
  duration: number
  isPlaying: boolean
  zoom: number
  selectedClipId: string | null
  selectedClipIds: string[] // TL-004: Multi-clip selection
  playbackSpeed: number
  loopRegion: LoopRegion | null
  frameRate: number
  markers: TimelineMarker[]
  shuttleSpeed: number // For J/K/L controls: negative = reverse, 0 = pause
  snapEnabled: boolean // TL-003: Snap to grid
  snapThreshold: number // TL-003: Snap threshold in seconds
  rippleEnabled: boolean // TL-007: Ripple edit mode
  clipboardClipId: string | null // TL-002: Copy/paste clipboard

  // Playback controls
  play: () => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  setDuration: (duration: number) => void

  // Frame navigation (VID-001)
  stepFrame: (direction: 1 | -1) => void
  getCurrentFrame: () => number

  // Speed control (VID-002)
  setPlaybackSpeed: (speed: number) => void

  // Loop region (VID-003)
  setLoopIn: () => void
  setLoopOut: () => void
  clearLoop: () => void

  // J/K/L Shuttle controls (TL-005)
  shuttleForward: () => void
  shuttleBackward: () => void
  shuttleStop: () => void

  // Zoom controls
  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void

  // Track operations
  addTrack: (type: TrackType, name?: string) => TimelineTrack
  removeTrack: (id: string) => void
  toggleTrackMute: (id: string) => void
  toggleTrackLock: (id: string) => void
  setTrackAcceptedTypes: (id: string, types: MediaType[]) => void
  renameTrack: (id: string, name: string) => void
  reorderTracks: (fromIndex: number, toIndex: number) => void

  editError: string | null
  clearEditError: () => void

  // Clip operations
  restoreTracks: (tracks: TimelineTrack[]) => void
  addClip: (trackId: string, mediaId: string, startTime: number, duration: number) => TimelineClip
  removeClip: (clipId: string) => void
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void
  selectClip: (clipId: string | null) => void
  moveClip: (clipId: string, newTrackId: string, newStartTime: number) => void
  trimClip: (clipId: string, side: 'start' | 'end', newTime: number) => void
  splitClip: (clipId: string, splitTime: number) => TimelineClip | null // TL-001
  splitAndKeepLeft: (clipId: string, splitTime: number) => void // TL-001: Split and delete right portion
  splitAndKeepRight: (clipId: string, splitTime: number) => void // TL-001: Split and delete left portion
  duplicateClip: (clipId: string) => TimelineClip | null // TL-002
  copyClip: (clipId: string) => void // TL-002
  pasteClip: (trackId: string, time: number) => TimelineClip | null // TL-002
  pasteAtPlayhead: () => TimelineClip | null // Paste at current playhead with overlap resolution
  replaceClipMedia: (clipId: string, newMediaId: string, newDuration?: number) => void // Replace media keeping position
  separateAudio: (clipId: string) => string | null // Extract audio to new track, returns new clip id

  // TL-003: Snap
  toggleSnap: () => void
  setSnapThreshold: (threshold: number) => void
  getSnapPoint: (time: number, excludeClipId?: string) => number | null
  getZoomAwareSnapThreshold: () => number // Snap threshold adjusted for zoom level

  // Overlap detection
  checkOverlap: (
    trackId: string,
    startTime: number,
    endTime: number,
    excludeClipId?: string,
  ) => boolean
  getOverlappingClips: (
    trackId: string,
    startTime: number,
    endTime: number,
    excludeClipId?: string,
  ) => TimelineClip[]

  // TL-004: Multi-clip selection
  selectClips: (clipIds: string[]) => void
  addToSelection: (clipId: string) => void
  toggleSelection: (clipId: string) => void
  selectAllClips: () => void
  clearSelection: () => void

  // TL-007: Ripple edit
  toggleRipple: () => void

  // Cascade operations (for media deletion)
  removeClipsByMediaId: (mediaId: string) => void

  // Getters
  getClipAtTime: (trackId: string, time: number) => TimelineClip | undefined
  getTrack: (id: string) => TimelineTrack | undefined

  // Markers (VID-006)
  addMarker: (label?: string) => TimelineMarker
  removeMarker: (id: string) => void
  updateMarker: (id: string, updates: Partial<TimelineMarker>) => void
  jumpToMarker: (id: string) => void
  getMarkerAtTime: (time: number) => TimelineMarker | undefined
}

const KEYFRAME_EDIT_ERROR =
  'このクリップにはキーフレームが含まれています。時刻変換の仕様が未定義のため、分割・先頭トリム・右側だけ残す操作は現在利用できません。データは保持されています。'

function hasClipKeyframes(clipId: string): boolean {
  return (
    useKeyframeStore
      .getState()
      .clipKeyframes.get(clipId)
      ?.tracks.some((track) => track.keyframes.length > 0) ?? false
  )
}

function cloneClipKeyframes(sourceId: string, targetId: string): void {
  const state = useKeyframeStore.getState()
  const source = state.clipKeyframes.get(sourceId)
  if (!source) return
  const copy = structuredClone(source)
  copy.clipId = targetId
  for (const track of copy.tracks) {
    for (const keyframe of track.keyframes) keyframe.id = generateId()
  }
  useKeyframeStore.setState({ clipKeyframes: new Map(state.clipKeyframes).set(targetId, copy) })
}

function replaceEditedClip(
  tracks: TimelineTrack[],
  original: TimelineClip,
  edited: TimelineClip,
  ripple: boolean,
): TimelineTrack[] {
  const delta = edited.endTime - original.endTime
  return tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => {
      if (clip.id === original.id) return edited
      if (ripple && track.id === original.trackId && clip.startTime >= original.endTime) {
        return { ...clip, startTime: clip.startTime + delta, endTime: clip.endTime + delta }
      }
      return clip
    }),
  }))
}

type TimelineHook = UseBoundStore<StoreApi<TimelineStore>>

const createTimelineState: StateCreator<TimelineStore> = (set, get) => ({
  tracks: [
    {
      id: 'track-a',
      name: 'Track A',
      type: 'a',
      acceptedTypes: ['video', 'image'],
      clips: [],
      muted: false,
      locked: false,
    },
    {
      id: 'track-b',
      name: 'Track B',
      type: 'b',
      acceptedTypes: ['video', 'image'],
      clips: [],
      muted: false,
      locked: false,
    },
  ],
  currentTime: 0,
  duration: 30,
  isPlaying: false,
  zoom: 1,
  selectedClipId: null,
  selectedClipIds: [],
  playbackSpeed: 1,
  loopRegion: null,
  frameRate: 30, // Default framerate, can be updated based on video
  markers: [],
  shuttleSpeed: 0,
  snapEnabled: true,
  snapThreshold: 0.1, // 100ms snap threshold
  rippleEnabled: false,
  clipboardClipId: null,
  editError: null,
  clearEditError: () => set({ editError: null }),

  play: () => usePlaybackStore.getState().play(),
  pause: () => usePlaybackStore.getState().pause(),
  togglePlay: () => usePlaybackStore.getState().togglePlay(),
  seek: (time) => usePlaybackStore.getState().seek(time),
  setDuration: (duration) => set({ duration }),
  stepFrame: (direction) => usePlaybackStore.getState().stepFrame(direction),
  getCurrentFrame: () => usePlaybackStore.getState().getCurrentFrame(),
  setPlaybackSpeed: (speed) => usePlaybackStore.getState().setSpeed(speed),

  // Loop region (VID-003)
  setLoopIn: () => {
    const { loopRegion } = get()
    const { currentTime } = usePlaybackStore.getState()
    if (loopRegion) {
      set({ loopRegion: { ...loopRegion, inPoint: currentTime } })
    } else {
      set({ loopRegion: { inPoint: currentTime, outPoint: currentTime + 1 } })
    }
  },

  setLoopOut: () => {
    const { loopRegion } = get()
    const { currentTime } = usePlaybackStore.getState()
    if (loopRegion) {
      set({ loopRegion: { ...loopRegion, outPoint: currentTime } })
    } else {
      set({ loopRegion: { inPoint: Math.max(0, currentTime - 1), outPoint: currentTime } })
    }
  },

  clearLoop: () => set({ loopRegion: null }),

  shuttleForward: () => usePlaybackStore.getState().shuttleForward(),
  shuttleBackward: () => usePlaybackStore.getState().shuttleBackward(),
  shuttleStop: () => usePlaybackStore.getState().shuttleStop(),

  setZoom: (zoom: number) => set({ zoom: Math.max(0.1, Math.min(10, zoom)) }),
  zoomIn: () => set((state) => ({ zoom: Math.min(10, state.zoom * 1.2) })),
  zoomOut: () => set((state) => ({ zoom: Math.max(0.1, state.zoom / 1.2) })),

  restoreTracks: (tracks) => {
    const mediaIds = new Set(useMediaStore.getState().files.map((file) => file.id))
    set({
      tracks: tracks.map((track) => ({
        ...track,
        clips: track.clips.filter((clip) => mediaIds.has(clip.mediaId)),
      })),
    })
  },

  // Add new track
  addTrack: (type: TrackType, name?: string) => {
    const state = get()
    const existingTracks = state.tracks.filter(
      (t) => t.type === type || (type === 'media' && !['a', 'b'].includes(t.type)),
    )
    const trackNumber = existingTracks.length + 1

    // Generate track name if not provided
    const trackName =
      name ||
      (() => {
        switch (type) {
          case 'media':
            return `Track ${state.tracks.length + 1}`
          case 'audio':
            return `Audio ${trackNumber}`
          case 'text':
            return `Text ${trackNumber}`
          default:
            return `Track ${trackNumber}`
        }
      })()

    // Determine accepted types based on track type
    const acceptedTypes: MediaType[] = (() => {
      switch (type) {
        case 'audio':
          return ['video']
        case 'text':
          return []
        case 'media':
          return ['video', 'image']
        default:
          return ['video', 'image']
      }
    })()

    const newTrack: TimelineTrack = {
      id: generateId(),
      name: trackName,
      type,
      acceptedTypes,
      clips: [],
      muted: false,
      locked: false,
      color: TRACK_COLORS[type],
    }

    set({ tracks: [...state.tracks, newTrack] })
    return newTrack
  },

  removeTrack: (id: string) => {
    const state = get()
    // Prevent removing the last comparison track
    const track = state.tracks.find((t) => t.id === id)
    if (track && (track.type === 'a' || track.type === 'b')) {
      const comparisonTracks = state.tracks.filter((t) => t.type === 'a' || t.type === 'b')
      if (comparisonTracks.length <= 2) {
        console.warn('Cannot remove comparison tracks A or B')
        return
      }
    }
    set({ tracks: state.tracks.filter((t) => t.id !== id) })
  },

  toggleTrackMute: (id: string) => {
    set((state) => ({
      tracks: state.tracks.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t)),
    }))
  },

  toggleTrackLock: (id: string) => {
    set((state) => ({
      tracks: state.tracks.map((t) => (t.id === id ? { ...t, locked: !t.locked } : t)),
    }))
  },

  setTrackAcceptedTypes: (id: string, types: MediaType[]) => {
    set((state) => ({
      tracks: state.tracks.map((t) => (t.id === id ? { ...t, acceptedTypes: types } : t)),
    }))
  },

  renameTrack: (id: string, name: string) => {
    set((state) => ({
      tracks: state.tracks.map((t) => (t.id === id ? { ...t, name } : t)),
    }))
  },

  reorderTracks: (fromIndex: number, toIndex: number) => {
    const state = get()
    const newTracks = [...state.tracks]
    const [removed] = newTracks.splice(fromIndex, 1)
    newTracks.splice(toIndex, 0, removed)
    set({ tracks: newTracks })
  },

  addClip: (trackId: string, mediaId: string, startTime: number, clipDuration: number) => {
    const { frameRate } = get()
    // TL-002: Snap clip times to frame boundaries
    const snappedStart = snapTimeToFrame(startTime, frameRate)
    const snappedDuration = snapTimeToFrame(clipDuration, frameRate)

    const clip: TimelineClip = {
      id: generateId(),
      mediaId,
      trackId,
      startTime: snappedStart,
      endTime: snappedStart + snappedDuration,
      inPoint: 0,
      outPoint: snappedDuration,
    }

    const updatedTracks = get().tracks.map((t) =>
      t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
    )

    set({ tracks: updatedTracks })

    return clip
  },

  removeClip: (clipId: string) => {
    const state = get()

    // TL-012: Find the clip being removed for ripple calculation
    let removedClip: TimelineClip | undefined
    let removedTrackId: string | undefined

    for (const track of state.tracks) {
      const clip = track.clips.find((c) => c.id === clipId)
      if (clip) {
        removedClip = clip
        removedTrackId = track.id
        break
      }
    }

    const updatedTracks = state.tracks.map((t) => {
      // Remove the clip
      let clips = t.clips.filter((c) => c.id !== clipId)

      // TL-012: Ripple edit - shift subsequent clips left on same track
      if (state.rippleEnabled && removedClip && t.id === removedTrackId) {
        const removedDuration = removedClip.endTime - removedClip.startTime
        clips = clips.map((c) => {
          if (c.startTime >= removedClip!.endTime) {
            // Shift clip left by the removed clip's duration
            return {
              ...c,
              startTime: c.startTime - removedDuration,
              endTime: c.endTime - removedDuration,
            }
          }
          return c
        })
      }

      return { ...t, clips }
    })

    set({
      tracks: updatedTracks,
      selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
    })
  },

  updateClip: (clipId: string, updates: Partial<TimelineClip>) => {
    if (updates.speed !== undefined && (!Number.isFinite(updates.speed) || updates.speed <= 0))
      return
    const state = get()
    const original = state.tracks.flatMap((track) => track.clips).find((clip) => clip.id === clipId)
    if (!original) return
    if (updates.mediaId !== undefined && !useMediaStore.getState().getFile(updates.mediaId)) return
    const updated = { ...original, ...updates, id: original.id, trackId: original.trackId }
    if (updates.speed !== undefined && updates.endTime === undefined) {
      updated.endTime = updated.startTime + (updated.outPoint - updated.inPoint) / updated.speed!
    }
    set({ tracks: replaceEditedClip(state.tracks, original, updated, state.rippleEnabled) })
  },

  selectClip: (clipId: string | null) => {
    set({ selectedClipId: clipId })
  },

  moveClip: (clipId: string, newTrackId: string, newStartTime: number) => {
    const state = get()
    const { frameRate } = state
    let clip: TimelineClip | undefined
    if (!state.tracks.some((track) => track.id === newTrackId)) return

    // Find and remove clip from current track
    const tracks = state.tracks.map((t) => {
      const foundClip = t.clips.find((c) => c.id === clipId)
      if (foundClip) {
        clip = { ...foundClip }
        return { ...t, clips: t.clips.filter((c) => c.id !== clipId) }
      }
      return t
    })

    if (!clip) return

    // TL-002: Snap to frame boundary
    const clipDuration = clip.endTime - clip.startTime
    clip.startTime = snapTimeToFrame(Math.max(0, newStartTime), frameRate)
    clip.endTime = clip.startTime + clipDuration
    clip.trackId = newTrackId

    // Add to new track
    const updatedTracks = tracks.map((t) =>
      t.id === newTrackId ? { ...t, clips: [...t.clips, clip!] } : t,
    )

    set({ tracks: updatedTracks })
  },

  trimClip: (clipId: string, side: 'start' | 'end', newTime: number) => {
    const state = get()
    if (!Number.isFinite(newTime)) return
    const track = state.tracks.find((track) => track.clips.some((clip) => clip.id === clipId))
    const original = track?.clips.find((clip) => clip.id === clipId)
    if (!original || !track) return
    const speed = original.speed || 1
    const minDuration = 1 / state.frameRate
    const media = useMediaStore.getState().getFile(original.mediaId)
    const mediaEnd = media?.type === 'video' ? media.duration : undefined
    const earliest =
      original.startTime -
      (original.reverse
        ? ((mediaEnd ?? original.outPoint) - original.outPoint) / speed
        : original.inPoint / speed)
    const latest =
      original.startTime +
      (original.reverse
        ? original.outPoint / speed
        : ((mediaEnd ?? Infinity) - original.inPoint) / speed)
    const snapped = snapTimeToFrame(newTime, state.frameRate)
    const start =
      side === 'start'
        ? Math.max(0, earliest, Math.min(snapped, original.endTime - minDuration))
        : original.startTime
    const end =
      side === 'end'
        ? Math.min(latest, Math.max(original.startTime + minDuration, snapped))
        : original.endTime
    if (end <= start || (start === original.startTime && end === original.endTime)) return
    if (side === 'start' && hasClipKeyframes(clipId)) {
      set({ editError: KEYFRAME_EDIT_ERROR })
      return
    }
    const trimmed = sliceClip(original, start, end)
    const delta = end - original.endTime
    set({
      tracks: state.tracks.map((item) =>
        item.id !== track.id
          ? item
          : {
              ...item,
              clips: item.clips.map((clip) => {
                if (clip.id === clipId) return trimmed
                if (state.rippleEnabled && side === 'end' && clip.startTime >= original.endTime) {
                  return {
                    ...clip,
                    startTime: clip.startTime + delta,
                    endTime: clip.endTime + delta,
                  }
                }
                return clip
              }),
            },
      ),
    })
  },

  // TL-001: Split Clip at Playhead
  splitClip: (clipId: string, splitTime: number) => {
    const state = get()
    const { frameRate } = state
    let newClip: TimelineClip | null = null

    // TL-002: Snap split time to frame boundary
    const snappedSplitTime = snapTimeToFrame(splitTime, frameRate)

    // Find the clip and its track
    for (const track of state.tracks) {
      const clip = track.clips.find((c) => c.id === clipId)
      if (!clip) continue

      // Check if split time is within the clip
      if (snappedSplitTime <= clip.startTime || snappedSplitTime >= clip.endTime) {
        return null // Can't split outside clip bounds
      }

      if (hasClipKeyframes(clipId)) {
        set({ editError: KEYFRAME_EDIT_ERROR })
        return null
      }
      newClip = { ...sliceClip(clip, snappedSplitTime, clip.endTime), id: generateId() }
      set({
        tracks: state.tracks.map((t) =>
          t.id !== track.id
            ? t
            : {
                ...t,
                clips: [
                  ...t.clips.map((c) =>
                    c.id === clipId ? sliceClip(c, c.startTime, snappedSplitTime) : c,
                  ),
                  newClip!,
                ],
              },
        ),
      })

      return newClip
    }

    return null
  },

  // TL-001: Split and keep left (delete everything after split point)
  splitAndKeepLeft: (clipId: string, splitTime: number) => {
    const state = get()
    const clip = state.tracks.flatMap((track) => track.clips).find((clip) => clip.id === clipId)
    const time = snapTimeToFrame(splitTime, state.frameRate)
    if (!clip || time <= clip.startTime || time >= clip.endTime) return
    get().trimClip(clipId, 'end', time)
  },

  // TL-001: Split and keep right (delete everything before split point)
  splitAndKeepRight: (clipId: string, splitTime: number) => {
    const state = get()
    const time = snapTimeToFrame(splitTime, state.frameRate)
    const track = state.tracks.find((track) => track.clips.some((clip) => clip.id === clipId))
    const clip = track?.clips.find((clip) => clip.id === clipId)
    if (!clip || !track || time <= clip.startTime || time >= clip.endTime) return
    if (hasClipKeyframes(clipId)) {
      set({ editError: KEYFRAME_EDIT_ERROR })
      return
    }
    const kept = sliceClip(clip, time, clip.endTime)
    const delta = time - clip.startTime
    set({
      tracks: state.tracks.map((item) =>
        item.id !== track.id
          ? item
          : {
              ...item,
              clips: item.clips.map((other) => {
                if (other.id === clipId)
                  return state.rippleEnabled
                    ? { ...kept, startTime: clip.startTime, endTime: kept.endTime - delta }
                    : kept
                if (state.rippleEnabled && other.startTime >= clip.endTime) {
                  return {
                    ...other,
                    startTime: other.startTime - delta,
                    endTime: other.endTime - delta,
                  }
                }
                return other
              }),
            },
      ),
    })
  },

  // TL-002: Duplicate Clip
  duplicateClip: (clipId: string) => {
    const state = get()
    let newClip: TimelineClip | null = null

    for (const track of state.tracks) {
      const clip = track.clips.find((c) => c.id === clipId)
      if (!clip) continue

      // Create duplicate immediately after the original
      newClip = {
        ...clip,
        id: generateId(),
        mediaId: clip.mediaId,
        trackId: track.id,
        startTime: clip.endTime,
        endTime: clip.endTime + (clip.endTime - clip.startTime),
        inPoint: clip.inPoint,
        outPoint: clip.outPoint,
      }

      cloneClipKeyframes(clip.id, newClip.id)
      set({
        tracks: state.tracks.map((t) => {
          if (t.id !== track.id) return t
          return {
            ...t,
            clips: [...t.clips, newClip!],
          }
        }),
      })

      return newClip
    }

    return null
  },

  // TL-002: Copy/Paste
  copyClip: (clipId: string) => {
    set({ clipboardClipId: clipId })
  },

  pasteClip: (trackId: string, time: number) => {
    const state = get()
    if (!state.clipboardClipId || !state.tracks.some((track) => track.id === trackId)) return null
    time = snapTimeToFrame(Math.max(0, time), state.frameRate)

    // Find the original clip
    for (const track of state.tracks) {
      const clip = track.clips.find((c) => c.id === state.clipboardClipId)
      if (!clip) continue

      const newClip: TimelineClip = {
        ...clip,
        id: generateId(),
        mediaId: clip.mediaId,
        trackId: trackId,
        startTime: time,
        endTime: time + (clip.endTime - clip.startTime),
        inPoint: clip.inPoint,
        outPoint: clip.outPoint,
      }

      cloneClipKeyframes(clip.id, newClip.id)
      set({
        tracks: state.tracks.map((t) => {
          if (t.id !== trackId) return t
          return { ...t, clips: [...t.clips, newClip] }
        }),
      })

      return newClip
    }

    return null
  },

  // Paste at playhead with overlap resolution
  pasteAtPlayhead: () => {
    const state = get()
    if (!state.clipboardClipId) return null

    // Find the original clip and its track type
    for (const track of state.tracks) {
      const clip = track.clips.find((c) => c.id === state.clipboardClipId)
      if (!clip) continue

      // Find a compatible track (same type or first available)
      const targetTrack = state.tracks.find((t) => t.type === track.type) || state.tracks[0]
      if (!targetTrack) return null

      const clipDuration = clip.endTime - clip.startTime
      let pasteTime = usePlaybackStore.getState().currentTime

      // 元クリップを含め、後続の重なりもなくなるまで貼り付け位置を進める。
      for (const existing of [...targetTrack.clips].sort((a, b) => a.startTime - b.startTime)) {
        if (existing.startTime < pasteTime + clipDuration && existing.endTime > pasteTime) {
          pasteTime = existing.endTime
        }
      }

      const newClip: TimelineClip = {
        ...clip,
        id: generateId(),
        mediaId: clip.mediaId,
        trackId: targetTrack.id,
        startTime: pasteTime,
        endTime: pasteTime + clipDuration,
        inPoint: clip.inPoint,
        outPoint: clip.outPoint,
      }

      cloneClipKeyframes(clip.id, newClip.id)
      const updatedTracks = state.tracks.map((t) => {
        if (t.id !== targetTrack.id) return t
        return { ...t, clips: [...t.clips, newClip] }
      })

      set({ tracks: updatedTracks })

      return newClip
    }

    return null
  },

  // 開始位置とinPointを保ち、新素材の末尾まで使う。
  replaceClipMedia: (clipId: string, newMediaId: string, newDuration?: number) => {
    const state = get()
    const original = state.tracks.flatMap((track) => track.clips).find((clip) => clip.id === clipId)
    const media = useMediaStore.getState().getFile(newMediaId)
    if (!original || !media) return
    const outPoint = newDuration ?? (media.type === 'video' ? media.duration : original.outPoint)
    if (outPoint === undefined || !Number.isFinite(outPoint) || outPoint <= original.inPoint) {
      set({
        editError:
          '差し替える素材がトリム開始位置より短いため、差し替えできません。元の素材と編集内容は保持されています。',
      })
      return
    }
    const edited = {
      ...original,
      mediaId: newMediaId,
      outPoint,
      endTime: original.startTime + (outPoint - original.inPoint) / (original.speed || 1),
    }
    set({ tracks: replaceEditedClip(state.tracks, original, edited, state.rippleEnabled) })
  },

  // Separate audio from video clip to new audio track
  separateAudio: (clipId: string) => {
    const state = get()

    // Find the clip
    let sourceClip: TimelineClip | undefined
    let sourceTrack: TimelineTrack | undefined

    for (const track of state.tracks) {
      const clip = track.clips.find((c) => c.id === clipId)
      if (clip) {
        sourceClip = clip
        sourceTrack = track
        break
      }
    }

    if (!sourceClip || !sourceTrack) return null

    // Find or create an audio track
    let audioTrack = state.tracks.find((t) => t.type === 'audio')

    if (!audioTrack) {
      // Create a new audio track
      audioTrack = {
        id: generateId(),
        name: 'Audio',
        type: 'audio',
        acceptedTypes: ['video'],
        clips: [],
        muted: false,
        locked: false,
        color: TRACK_COLORS['audio'],
      }
    }

    // Create new audio clip with same timing
    const newClip: TimelineClip = {
      ...sourceClip,
      id: generateId(),
      mediaId: sourceClip.mediaId, // Same media, player will extract audio
      trackId: audioTrack.id,
      startTime: sourceClip.startTime,
      endTime: sourceClip.endTime,
      inPoint: sourceClip.inPoint,
      outPoint: sourceClip.outPoint,
      label: `${sourceClip.label || 'Clip'} (audio)`,
    }

    // Update tracks
    const existingAudioTrack = state.tracks.find((t) => t.type === 'audio')
    let updatedTracks: TimelineTrack[]

    if (existingAudioTrack) {
      updatedTracks = state.tracks.map((t) => {
        if (t.id === audioTrack!.id) {
          return { ...t, clips: [...t.clips, newClip] }
        }
        return t
      })
    } else {
      updatedTracks = [...state.tracks, { ...audioTrack, clips: [newClip] }]
    }

    cloneClipKeyframes(sourceClip.id, newClip.id)
    set({ tracks: updatedTracks })

    return newClip.id
  },

  // TL-003: Snap
  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),

  setSnapThreshold: (threshold: number) => set({ snapThreshold: threshold }),

  getSnapPoint: (time: number, excludeClipId?: string) => {
    const state = get()
    if (!state.snapEnabled) return null

    const snapPoints: number[] = [
      0, // Start of timeline
      usePlaybackStore.getState().currentTime, // Playhead
      ...state.markers.map((m) => m.time), // Markers
    ]

    // Add clip edges
    for (const track of state.tracks) {
      for (const clip of track.clips) {
        if (clip.id === excludeClipId) continue
        snapPoints.push(clip.startTime, clip.endTime)
      }
    }

    // Find closest snap point
    for (const point of snapPoints) {
      if (Math.abs(time - point) <= state.snapThreshold) {
        return point
      }
    }

    return null
  },

  // Zoom-aware snap threshold (threshold in pixels / pixels per second)
  getZoomAwareSnapThreshold: () => {
    const state = get()
    const pixelsPerSecond = 50 * state.zoom
    const thresholdPixels = 10 // 10 pixels snap threshold
    return thresholdPixels / pixelsPerSecond
  },

  // Check if a time range overlaps with existing clips on a track
  checkOverlap: (trackId: string, startTime: number, endTime: number, excludeClipId?: string) => {
    const state = get()
    const track = state.tracks.find((t) => t.id === trackId)
    if (!track) return false

    return track.clips.some(
      (clip) => clip.id !== excludeClipId && clip.startTime < endTime && clip.endTime > startTime,
    )
  },

  // Get all clips that overlap with a time range
  getOverlappingClips: (
    trackId: string,
    startTime: number,
    endTime: number,
    excludeClipId?: string,
  ) => {
    const state = get()
    const track = state.tracks.find((t) => t.id === trackId)
    if (!track) return []

    return track.clips.filter(
      (clip) => clip.id !== excludeClipId && clip.startTime < endTime && clip.endTime > startTime,
    )
  },

  // TL-004: Multi-clip selection
  selectClips: (clipIds: string[]) =>
    set({ selectedClipIds: clipIds, selectedClipId: clipIds[0] || null }),

  addToSelection: (clipId: string) => {
    const { selectedClipIds } = get()
    if (!selectedClipIds.includes(clipId)) {
      set({ selectedClipIds: [...selectedClipIds, clipId], selectedClipId: clipId })
    }
  },

  toggleSelection: (clipId: string) => {
    const { selectedClipIds } = get()
    if (selectedClipIds.includes(clipId)) {
      const newSelection = selectedClipIds.filter((id) => id !== clipId)
      set({ selectedClipIds: newSelection, selectedClipId: newSelection[0] || null })
    } else {
      set({ selectedClipIds: [...selectedClipIds, clipId], selectedClipId: clipId })
    }
  },

  selectAllClips: () => {
    const { tracks } = get()
    const allClipIds = tracks.flatMap((t) => t.clips.map((c) => c.id))
    set({ selectedClipIds: allClipIds, selectedClipId: allClipIds[0] || null })
  },

  clearSelection: () => set({ selectedClipIds: [], selectedClipId: null }),

  // TL-007: Ripple edit
  toggleRipple: () => set((state) => ({ rippleEnabled: !state.rippleEnabled })),

  // Cascade delete: remove all clips using a specific mediaId
  removeClipsByMediaId: (mediaId: string) => {
    const state = get()

    // Find all clip IDs that use this media and clear from selection
    const clipIdsToRemove = state.tracks.flatMap((t) =>
      t.clips.filter((c) => c.mediaId === mediaId).map((c) => c.id),
    )

    set({
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.filter((c) => c.mediaId !== mediaId),
      })),
      selectedClipId: clipIdsToRemove.includes(state.selectedClipId || '')
        ? null
        : state.selectedClipId,
      selectedClipIds: state.selectedClipIds.filter((id) => !clipIdsToRemove.includes(id)),
    })
  },

  getClipAtTime: (trackId: string, time: number) => {
    const track = get().tracks.find((t) => t.id === trackId)
    return track?.clips.find((c) => time >= c.startTime && time < c.endTime)
  },

  getTrack: (id: string) => {
    return get().tracks.find((t) => t.id === id)
  },

  // Markers (VID-006)
  addMarker: (label?: string) => {
    const { markers } = get()
    const { currentTime } = usePlaybackStore.getState()
    const marker: TimelineMarker = {
      id: generateId(),
      time: currentTime,
      label: label || `Marker ${markers.length + 1}`,
    }
    set({ markers: [...markers, marker].sort((a, b) => a.time - b.time) })
    return marker
  },

  removeMarker: (id: string) => {
    set((state) => ({
      markers: state.markers.filter((m) => m.id !== id),
    }))
  },

  updateMarker: (id: string, updates: Partial<TimelineMarker>) => {
    set((state) => ({
      markers: state.markers
        .map((m) => (m.id === id ? { ...m, ...updates } : m))
        .sort((a, b) => a.time - b.time),
    }))
  },

  jumpToMarker: (id: string) => {
    const marker = get().markers.find((m) => m.id === id)
    if (marker) {
      get().seek(marker.time)
    }
  },

  getMarkerAtTime: (time: number) => {
    return get().markers.find((m) => Math.abs(m.time - time) < 0.1)
  },
})

export const useTimelineStore: TimelineHook = create<TimelineStore>((rawSet, get, api) => {
  // 全編集経路で派生値と選択・コピー元の参照を同じ変更内に更新する。
  const set: StoreApi<TimelineStore>['setState'] = (update) => {
    const state = get()
    const changes = typeof update === 'function' ? update(state) : update
    if (!changes.tracks) {
      rawSet(changes)
      return
    }
    const next = { ...state, ...changes }
    const ids = new Set(next.tracks.flatMap((track) => track.clips.map((clip) => clip.id)))
    const duration = calculateTimelineDuration(next.tracks)
    rawSet({
      ...changes,
      duration,
      editError: null,
      selectedClipId:
        next.selectedClipId && ids.has(next.selectedClipId) ? next.selectedClipId : null,
      selectedClipIds: next.selectedClipIds.filter((id) => ids.has(id)),
      clipboardClipId:
        next.clipboardClipId && ids.has(next.clipboardClipId) ? next.clipboardClipId : null,
    })
    const keyframes = useKeyframeStore.getState()
    const retained = new Map([...keyframes.clipKeyframes].filter(([id]) => ids.has(id)))
    if (retained.size !== keyframes.clipKeyframes.size) {
      const selectedExists = [...retained.values()].some((clip) =>
        clip.tracks.some((track) =>
          track.keyframes.some((keyframe) => keyframe.id === keyframes.selectedKeyframeId),
        ),
      )
      useKeyframeStore.setState({
        clipKeyframes: retained,
        selectedKeyframeId: selectedExists ? keyframes.selectedKeyframeId : null,
      })
    }
    const playback = usePlaybackStore.getState()
    if (duration < state.duration && playback.currentTime >= duration) {
      playback.seek(
        Math.max(0, (Math.ceil(duration * next.frameRate - 0.000001) - 1) / next.frameRate),
      )
    }
  }
  return createTimelineState(set, get, api)
})
