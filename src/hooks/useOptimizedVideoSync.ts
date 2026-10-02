/**
 * Optimized Video Sync Hook - Native Playback with Drift Correction
 *
 * KEY PRINCIPLES:
 * 1. Let videos play natively using video.play() - browser handles decoding efficiently
 * 2. Only intervene when drift exceeds threshold (smoother than constant currentTime updates)
 * 3. Use requestVideoFrameCallback for frame-accurate sync when available
 * 4. Master/slave pattern for multi-video sync
 */
import { useRef, useEffect, useCallback } from 'react'

import { seekNativeVideoTo, syncNativeClipPlayback } from '../lib/media/nativeClipPlayback'
import { usePlaybackStore } from '../stores/playbackStore'
import type { TimelineClip } from '../types'

export { calculateMediaTime } from '../lib/media/timeline'

// Drift threshold in seconds - only sync if videos drift more than this
const DRIFT_THRESHOLD = 0.05 // 50ms - good balance between smoothness and sync
const HARD_SYNC_THRESHOLD = 0.15 // 150ms - force immediate sync

interface SyncState {
  isPlaying: boolean
  lastSyncTime: number
  frameCallbackId: number | null
}

/**
 * Clip transport follows the shared playback snapshot. Discontinuous seeks are
 * observed even when paused or when a newly mounted clip missed the DOM event.
 */
export function useOptimizedClipSync(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  clip: TimelineClip | null,
): void {
  useEffect(() => {
    const video = videoRef.current
    if (!video || !clip) return
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.disableRemotePlayback = true

    const sync = (forceSeek = false) =>
      syncNativeClipPlayback(video, clip, usePlaybackStore.getState(), forceSeek)
    const unsubscribe = usePlaybackStore.subscribe((state, previous) => {
      if (
        state.currentTime !== previous.currentTime ||
        state.isPlaying !== previous.isPlaying ||
        state.playbackSpeed !== previous.playbackSpeed ||
        state.playbackDirection !== previous.playbackDirection ||
        state.seekRevision !== previous.seekRevision ||
        state.isExporting !== previous.isExporting
      )
        sync(state.seekRevision !== previous.seekRevision)
    })
    const handleLoaded = () => sync(true)
    video.addEventListener('loadeddata', handleLoaded)
    sync(true)

    let frameId: number | null = null
    let intervalId: ReturnType<typeof setInterval> | null = null
    if (typeof video.requestVideoFrameCallback === 'function') {
      const onFrame = () => {
        sync()
        frameId = video.requestVideoFrameCallback(onFrame)
      }
      frameId = video.requestVideoFrameCallback(onFrame)
    } else {
      intervalId = setInterval(sync, 33)
    }

    return () => {
      unsubscribe()
      video.removeEventListener('loadeddata', handleLoaded)
      if (frameId !== null) video.cancelVideoFrameCallback(frameId)
      if (intervalId !== null) clearInterval(intervalId)
      video.pause()
    }
  }, [videoRef, clip])
}

/**
 * Simple optimized video sync (no clip awareness)
 */
export function useOptimizedVideoSync(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: { timeOffset?: number; muted?: boolean } = {},
) {
  const { timeOffset = 0, muted = true } = options
  const syncStateRef = useRef<SyncState>({
    isPlaying: false,
    lastSyncTime: 0,
    frameCallbackId: null,
  })

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.muted = muted
    video.playsInline = true
    video.preload = 'auto'
    video.disableRemotePlayback = true

    const { currentTime } = usePlaybackStore.getState()
    seekNativeVideoTo(video, Math.max(0, currentTime + timeOffset))
  }, [videoRef, timeOffset, muted])

  // Frame-accurate sync
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype

    const checkAndSync = () => {
      const { currentTime, isPlaying, playbackSpeed, isExporting } = usePlaybackStore.getState()

      // Don't interfere during export
      if (isExporting) return

      const targetTime = Math.max(0, currentTime + timeOffset)
      const drift = Math.abs(video.currentTime - targetTime)

      if (isPlaying) {
        if (video.paused) {
          seekNativeVideoTo(video, targetTime)
          video.play().catch(() => {})
        } else if (drift > HARD_SYNC_THRESHOLD) {
          seekNativeVideoTo(video, targetTime)
        } else if (drift > DRIFT_THRESHOLD) {
          const correction = video.currentTime < targetTime ? 1.05 : 0.95
          video.playbackRate = playbackSpeed * correction
        } else {
          if (Math.abs(video.playbackRate - playbackSpeed) > 0.01) {
            video.playbackRate = playbackSpeed
          }
        }
      } else {
        if (!video.paused) video.pause()
        if (drift > 0.01) seekNativeVideoTo(video, targetTime)
      }
    }

    if (hasRVFC) {
      const syncState = syncStateRef.current
      const onFrame = () => {
        checkAndSync()
        syncState.frameCallbackId = video.requestVideoFrameCallback(onFrame)
      }
      syncState.frameCallbackId = video.requestVideoFrameCallback(onFrame)

      return () => {
        if (syncState.frameCallbackId !== null) {
          video.cancelVideoFrameCallback(syncState.frameCallbackId)
        }
      }
    } else {
      const intervalId = setInterval(checkAndSync, 33)
      return () => clearInterval(intervalId)
    }
  }, [videoRef, timeOffset])

  // Handle seek
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleSeek = (e: CustomEvent<{ time: number }>) => {
      // Don't interfere during export
      if (usePlaybackStore.getState().isExporting) return
      seekNativeVideoTo(video, Math.max(0, e.detail.time + timeOffset))
    }

    window.addEventListener('playback-seek', handleSeek as EventListener)
    return () => window.removeEventListener('playback-seek', handleSeek as EventListener)
  }, [videoRef, timeOffset])

  // Handle play/pause
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleUpdate = (e: CustomEvent<{ time: number; isPlaying: boolean }>) => {
      // Don't interfere during export
      if (usePlaybackStore.getState().isExporting) return

      const { time, isPlaying } = e.detail
      const targetTime = Math.max(0, time + timeOffset)

      if (isPlaying && video.paused) {
        seekNativeVideoTo(video, targetTime)
        video.play().catch(() => {})
      } else if (!isPlaying && !video.paused) {
        video.pause()
        seekNativeVideoTo(video, targetTime)
      }
    }

    window.addEventListener('playback-update', handleUpdate as EventListener)
    return () => window.removeEventListener('playback-update', handleUpdate as EventListener)
  }, [videoRef, timeOffset])

  // Handle speed
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleSpeed = (e: CustomEvent<{ speed: number }>) => {
      video.playbackRate = e.detail.speed
    }

    window.addEventListener('playback-speed', handleSpeed as EventListener)
    return () => window.removeEventListener('playback-speed', handleSpeed as EventListener)
  }, [videoRef])

  const seekTo = useCallback(
    (time: number) => {
      const video = videoRef.current
      if (!video) return
      seekNativeVideoTo(video, Math.max(0, time + timeOffset))
      usePlaybackStore.getState().seek(time)
    },
    [videoRef, timeOffset],
  )

  return { seekTo }
}

/**
 * Dual video sync with master/slave pattern
 * Video A is master, Video B syncs to it
 */
export function useOptimizedDualSync(
  videoARef: React.RefObject<HTMLVideoElement | null>,
  videoBRef: React.RefObject<HTMLVideoElement | null>,
) {
  const syncA = useOptimizedVideoSync(videoARef, { timeOffset: 0 })
  const syncB = useOptimizedVideoSync(videoBRef, { timeOffset: 0 })

  // Additional master/slave sync - B follows A
  useEffect(() => {
    const videoA = videoARef.current
    const videoB = videoBRef.current
    if (!videoA || !videoB) return

    const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype
    let frameId: number | null = null

    const syncBToA = () => {
      if (!videoA.paused && !videoB.paused) {
        const drift = Math.abs(videoA.currentTime - videoB.currentTime)
        if (drift > DRIFT_THRESHOLD) {
          // B drifted from A - correct it
          if (drift > HARD_SYNC_THRESHOLD) {
            seekNativeVideoTo(videoB, videoA.currentTime)
          } else {
            // Gentle correction
            const correction = videoB.currentTime < videoA.currentTime ? 1.03 : 0.97
            videoB.playbackRate = videoA.playbackRate * correction
          }
        } else {
          // In sync
          if (Math.abs(videoB.playbackRate - videoA.playbackRate) > 0.01) {
            videoB.playbackRate = videoA.playbackRate
          }
        }
      }
    }

    if (hasRVFC) {
      const onFrame = () => {
        syncBToA()
        frameId = videoA.requestVideoFrameCallback(onFrame)
      }
      frameId = videoA.requestVideoFrameCallback(onFrame)

      return () => {
        if (frameId !== null) {
          videoA.cancelVideoFrameCallback(frameId)
        }
      }
    } else {
      const intervalId = setInterval(syncBToA, 50)
      return () => clearInterval(intervalId)
    }
  }, [videoARef, videoBRef])

  const seekBoth = useCallback(
    (time: number) => {
      syncA.seekTo(time)
      syncB.seekTo(time)
    },
    [syncA, syncB],
  )

  return { seekBoth, seekA: syncA.seekTo, seekB: syncB.seekTo }
}
