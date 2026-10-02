import { describe, expect, it, vi } from 'vitest'

import type { TimelineClip } from '../../types'
import { syncNativeClipPlayback, type ClipPlaybackState } from './nativeClipPlayback'

const clip: TimelineClip = {
  id: 'clip',
  mediaId: 'media',
  trackId: 'a',
  startTime: 2,
  endTime: 6,
  inPoint: 1,
  outPoint: 9,
  speed: 2,
}
const state: ClipPlaybackState = {
  currentTime: 3,
  isPlaying: false,
  playbackSpeed: 1,
  playbackDirection: 1,
  isExporting: false,
}
function makeVideo() {
  const video = {
    paused: true,
    seeking: false,
    currentTime: 0,
    playbackRate: 1,
    dispatchEvent: vi.fn<(event: CustomEvent<{ targetTime: number }>) => void>(),
    pause: vi.fn<() => void>(() => {
      video.paused = true
    }),
    play: vi.fn<() => Promise<void>>(async () => {
      video.paused = false
    }),
  }
  return video as typeof video & HTMLVideoElement
}

describe('native media follows the playback clock', () => {
  it('maps a paused seek through clip placement, trim and speed', () => {
    const video = makeVideo()
    syncNativeClipPlayback(video, clip, state, true)
    expect(video.currentTime).toBe(3)
    expect(video.play).not.toHaveBeenCalled()
    expect(video.dispatchEvent.mock.calls[0][0].detail.targetTime).toBe(3)
  })

  it('starts at the combined clip and transport rate and applies speed changes immediately', () => {
    const video = makeVideo()
    syncNativeClipPlayback(video, clip, { ...state, isPlaying: true, playbackSpeed: 2 })
    expect(video.playbackRate).toBe(4)
    expect(video.play).toHaveBeenCalledOnce()
    syncNativeClipPlayback(video, clip, { ...state, isPlaying: true, playbackSpeed: 0.5 })
    expect(video.playbackRate).toBe(1)
  })

  it('seeks backwards from the shared clock instead of allowing native forward playback', () => {
    const video = makeVideo()
    syncNativeClipPlayback(video, clip, { ...state, isPlaying: true })
    syncNativeClipPlayback(video, clip, {
      ...state,
      isPlaying: true,
      playbackDirection: -1,
      currentTime: 2.9,
    })
    expect(video.paused).toBe(true)
    expect(video.currentTime).toBeCloseTo(2.8)
    syncNativeClipPlayback(video, clip, {
      ...state,
      isPlaying: true,
      playbackDirection: -1,
      currentTime: 2.8,
    })
    expect(video.currentTime).toBeCloseTo(2.6)
    expect(video.play).toHaveBeenCalledOnce()
  })

  it('honors reversed clips and stops old media when crossing a clip boundary', () => {
    const video = makeVideo()
    syncNativeClipPlayback(video, { ...clip, reverse: true }, { ...state, isPlaying: true })
    expect(video.currentTime).toBe(7)
    expect(video.paused).toBe(true)
    syncNativeClipPlayback(video, clip, { ...state, isPlaying: true })
    syncNativeClipPlayback(video, clip, { ...state, isPlaying: true, currentTime: 6 })
    expect(video.paused).toBe(true)
  })

  it('does not change videos owned by export', () => {
    const video = makeVideo()
    syncNativeClipPlayback(video, clip, { ...state, isPlaying: true, isExporting: true }, true)
    expect(video.currentTime).toBe(0)
    expect(video.play).not.toHaveBeenCalled()
    expect(video.dispatchEvent).not.toHaveBeenCalled()
  })

  it('丸められた停止位置へ再シークし続けず、別の明示位置への移動は保つ', () => {
    const video = makeVideo()
    const requests: number[] = []
    let position = 2
    Object.defineProperty(video, 'currentTime', {
      get: () => position,
      set: (time: number) => {
        requests.push(time)
        // 実Chromiumで観測した、要求と約2µs違うシーク完了位置。
        position = 2.032538
      },
    })
    const untrimmed = { ...clip, startTime: 0, endTime: 4, inPoint: 0, outPoint: 4, speed: 1 }
    const paused = { ...state, currentTime: 2.032539999999106 }
    syncNativeClipPlayback(video, untrimmed, paused, true)
    for (let count = 0; count < 20; count++) syncNativeClipPlayback(video, untrimmed, paused)
    expect(requests).toEqual([2.032539999999106])
    // 明示シークに10µsの完了許容差を流用しない。
    syncNativeClipPlayback(video, untrimmed, { ...paused, currentTime: 2.032542 }, true)
    expect(requests).toEqual([2.032539999999106, 2.032542])
  })
})
