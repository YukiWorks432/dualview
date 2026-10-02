import type { TimelineClip } from '../../types'
import {
  NATIVE_SEEK_SETTLE_EPSILON_SECONDS,
  VIDEO_FRAME_SEEK_REQUEST_EVENT,
} from './presentedVideoFrame'
import { calculateMediaTime } from './timeline'

export interface ClipPlaybackState {
  currentTime: number
  isPlaying: boolean
  playbackSpeed: number
  playbackDirection: 1 | -1
  isExporting: boolean
}

export function seekNativeVideoTo(
  video: HTMLVideoElement,
  targetTime: number,
  forceSeek = false,
): void {
  const tolerance = forceSeek ? 0.000001 : NATIVE_SEEK_SETTLE_EPSILON_SECONDS
  if (!video.seeking && Math.abs(video.currentTime - targetTime) <= tolerance) return
  video.dispatchEvent(new CustomEvent(VIDEO_FRAME_SEEK_REQUEST_EVENT, { detail: { targetTime } }))
  video.currentTime = targetTime
}

/** Apply the shared clock to a native video, including paused and reverse seeks. */
export function syncNativeClipPlayback(
  video: HTMLVideoElement,
  clip: TimelineClip,
  state: ClipPlaybackState,
  forceSeek = false,
): void {
  if (state.isExporting) return
  const mediaTime = calculateMediaTime(state.currentTime, clip)
  if (mediaTime === null) {
    if (!video.paused) video.pause()
    return
  }

  const rate = state.playbackSpeed * (clip.speed || 1)
  const direction = state.playbackDirection * (clip.reverse ? -1 : 1)
  // HTMLVideoElement cannot play backwards. Seek from the same timeline clock
  // instead, also covering positive rates outside the browser's supported range.
  if (!state.isPlaying || direction < 0 || rate < 0.0625 || rate > 16) {
    if (!video.paused) video.pause()
    seekNativeVideoTo(video, mediaTime, forceSeek)
    return
  }

  const drift = Math.abs(video.currentTime - mediaTime)
  if (forceSeek || video.paused || drift > 0.15) {
    seekNativeVideoTo(video, mediaTime, forceSeek)
    video.playbackRate = rate
  } else if (drift > 0.05) {
    video.playbackRate = Math.max(
      0.0625,
      Math.min(16, rate * (video.currentTime < mediaTime ? 1.05 : 0.95)),
    )
  } else {
    video.playbackRate = rate
  }
  if (video.paused) void video.play().catch(() => {})
}
