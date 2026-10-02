/**
 * Owns the playback clock, transport and discontinuous seek notifications.
 * Timeline playback fields are a read-only compatibility projection; commands
 * always enter here, including commands initiated by timeline markers or edits.
 */
import { create, type StoreApi, type UseBoundStore } from 'zustand'

import { useTimelineStore } from './timelineStore'

interface PlaybackStore {
  currentTime: number
  isPlaying: boolean
  playbackSpeed: number
  playbackDirection: 1 | -1
  isShuttling: boolean
  seekRevision: number
  volume: number
  isMuted: boolean
  previousVolume: number
  isExporting: boolean
  _animationFrameId: number | null
  _lastUpdateTime: number | null

  play: () => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  setSpeed: (speed: number) => void
  shuttleForward: () => void
  shuttleBackward: () => void
  shuttleStop: () => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  setExporting: (exporting: boolean) => void
  stepFrame: (direction: 1 | -1) => void
  getCurrentFrame: () => number
  snapTimeToFrame: (time: number) => number
  getEffectiveDuration: () => number
}

declare global {
  interface WindowEventMap {
    'playback-seek': CustomEvent<{ time: number }>
    'playback-update': CustomEvent<{ time: number; isPlaying: boolean }>
    'playback-speed': CustomEvent<{ speed: number }>
  }
}

type PlaybackHook = UseBoundStore<StoreApi<PlaybackStore>>

export const usePlaybackStore: PlaybackHook = create<PlaybackStore>((set, get) => {
  const publish = (update: Partial<PlaybackStore>) => {
    set(update)
    const state = get()
    useTimelineStore.setState({
      currentTime: state.currentTime,
      isPlaying: state.isPlaying,
      playbackSpeed: state.playbackSpeed,
      shuttleSpeed:
        state.isPlaying && state.isShuttling ? state.playbackSpeed * state.playbackDirection : 0,
    })
  }

  const notifyUpdate = () => {
    const { currentTime: time, isPlaying } = get()
    window.dispatchEvent(new CustomEvent('playback-update', { detail: { time, isPlaying } }))
  }

  const notifySeek = () => {
    window.dispatchEvent(new CustomEvent('playback-seek', { detail: { time: get().currentTime } }))
  }

  const frameRate = () => useTimelineStore.getState().frameRate || 30
  const lastFrameTime = () =>
    Math.max(
      0,
      (Math.ceil(get().getEffectiveDuration() * frameRate() - 0.000001) - 1) / frameRate(),
    )

  const activeLoop = () => {
    const loop = useTimelineStore.getState().loopRegion
    if (!loop) return null
    const duration = get().getEffectiveDuration()
    const inPoint = Math.max(0, Math.min(loop.inPoint, duration))
    const outPoint = Math.max(0, Math.min(loop.outPoint, duration))
    return inPoint < outPoint ? { inPoint, outPoint } : null
  }

  const advance = (now: number) => {
    const state = get()
    if (!state.isPlaying) return
    const delta = Math.max(0, now - (state._lastUpdateTime ?? now)) / 1000
    let time = state.currentTime + delta * state.playbackSpeed * state.playbackDirection
    const loop = activeLoop()
    let wrapped = false
    let isPlaying = true

    if (loop && loop.inPoint < loop.outPoint) {
      if (
        (state.playbackDirection > 0 && time >= loop.outPoint) ||
        (state.playbackDirection < 0 && time < loop.inPoint)
      ) {
        const length = loop.outPoint - loop.inPoint
        time = loop.inPoint + ((((time - loop.inPoint) % length) + length) % length)
        wrapped = true
      }
    } else if (state.playbackDirection > 0 && time >= lastFrameTime()) {
      time = lastFrameTime()
      isPlaying = false
    } else if (state.playbackDirection < 0 && time <= 0) {
      time = 0
      isPlaying = false
    }

    publish({
      currentTime: Math.max(0, Math.min(time, state.getEffectiveDuration())),
      isPlaying,
      _lastUpdateTime: isPlaying ? now : null,
      seekRevision: state.seekRevision + (wrapped ? 1 : 0),
    })
    if (wrapped) notifySeek()
    notifyUpdate()
  }

  const updatePlayback = (now: number) => {
    set({ _animationFrameId: null })
    advance(now)
    if (get().isPlaying) set({ _animationFrameId: requestAnimationFrame(updatePlayback) })
  }

  const shuttle = (direction: 1 | -1) => {
    advance(performance.now())
    const state = get()
    const speed =
      state.isPlaying && state.isShuttling && state.playbackDirection === direction
        ? Math.min(8, state.playbackSpeed * 2)
        : 1
    publish({ playbackSpeed: speed, playbackDirection: direction, isShuttling: true })
    window.dispatchEvent(new CustomEvent('playback-speed', { detail: { speed } }))
    if (get().isPlaying) notifyUpdate()
    else get().play()
  }

  return {
    currentTime: 0,
    isPlaying: false,
    playbackSpeed: 1,
    playbackDirection: 1,
    isShuttling: false,
    seekRevision: 0,
    volume: 1,
    isMuted: false,
    previousVolume: 1,
    isExporting: false,
    _animationFrameId: null,
    _lastUpdateTime: null,

    play: () => {
      const state = get()
      if (state.isPlaying || state.isExporting) return
      const loop = activeLoop()
      if (
        loop &&
        loop.inPoint < loop.outPoint &&
        (state.currentTime < loop.inPoint || state.currentTime >= loop.outPoint)
      ) {
        state.seek(state.playbackDirection > 0 ? loop.inPoint : loop.outPoint - 1 / frameRate())
      } else if (state.playbackDirection > 0 && state.currentTime >= lastFrameTime()) {
        state.seek(0)
      } else if (state.playbackDirection < 0 && state.currentTime <= 0) {
        state.seek(lastFrameTime())
      }
      publish({ isPlaying: true, _lastUpdateTime: performance.now() })
      notifyUpdate()
      if (get()._animationFrameId === null) {
        set({ _animationFrameId: requestAnimationFrame(updatePlayback) })
      }
    },

    pause: () => {
      advance(performance.now())
      const state = get()
      if (state._animationFrameId !== null) cancelAnimationFrame(state._animationFrameId)
      publish({ isPlaying: false, _animationFrameId: null, _lastUpdateTime: null })
      notifyUpdate()
    },

    togglePlay: () => (get().isPlaying ? get().pause() : get().play()),

    seek: (time) => {
      if (!Number.isFinite(time)) return
      const state = get()
      const currentTime = Math.max(0, Math.min(state.snapTimeToFrame(time), lastFrameTime()))
      publish({
        currentTime,
        seekRevision: state.seekRevision + 1,
        _lastUpdateTime: state.isPlaying ? performance.now() : null,
      })
      notifySeek()
    },

    setSpeed: (speed) => {
      if (!Number.isFinite(speed)) return
      advance(performance.now())
      const clampedSpeed = Math.max(0.1, Math.min(8, speed))
      publish({ playbackSpeed: clampedSpeed, playbackDirection: 1, isShuttling: false })
      window.dispatchEvent(new CustomEvent('playback-speed', { detail: { speed: clampedSpeed } }))
      notifyUpdate()
    },

    shuttleForward: () => shuttle(1),
    shuttleBackward: () => shuttle(-1),
    shuttleStop: () => {
      get().pause()
      get().setSpeed(1)
    },

    setVolume: (volume) => {
      const clampedVolume = Math.max(0, Math.min(1, volume))
      set({ volume: clampedVolume, isMuted: clampedVolume === 0 })
    },
    toggleMute: () => {
      const state = get()
      if (state.isMuted) set({ isMuted: false, volume: state.previousVolume || 1 })
      else set({ isMuted: true, previousVolume: state.volume, volume: 0 })
    },
    setExporting: (isExporting) => {
      if (isExporting) get().pause()
      set({ isExporting })
    },
    stepFrame: (direction) => get().seek(get().currentTime + direction / frameRate()),
    getCurrentFrame: () => Math.floor(get().currentTime * frameRate() + 0.000001),
    snapTimeToFrame: (time) => Math.round(time * frameRate()) / frameRate(),
    getEffectiveDuration: () => {
      const timeline = useTimelineStore.getState()
      let duration = timeline.duration
      for (const track of timeline.tracks) {
        for (const clip of track.clips) duration = Math.max(duration, clip.endTime)
      }
      return Math.max(duration, 1)
    },
  }
})
