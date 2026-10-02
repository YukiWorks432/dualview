export interface PresentedVideoFrame {
  mediaId: string
  clipId: string
  mediaTime: number
  currentTime: number
  seekGeneration: number
}

export interface PresentedVideoFrameTarget {
  mediaId: string
  clipId: string
  mediaTime: number
  currentTime: number
  seekGeneration: number
}

// nativeのシーク完了位置は要求したdouble値から数µs丸められることがある。
// 明示的な移動先の比較とは分け、完了済みの同じ位置へ再要求し続けない。
export const NATIVE_SEEK_SETTLE_EPSILON_SECONDS = 0.00001
const VIDEO_POSITION_TOLERANCE_SECONDS = 0.01
const MEDIA_TIME_EPSILON_SECONDS = 0.000001
export const VIDEO_FRAME_SEEK_REQUEST_EVENT = 'dualview:video-seek-request'

export function isVideoFrameRequestCurrent(
  requestGeneration: number,
  currentGeneration: number,
): boolean {
  return requestGeneration === currentGeneration
}

export function isPresentedVideoFrameCandidateCurrent(
  requestGeneration: number,
  currentGeneration: number,
  presentedCurrentTime: number,
  targetCurrentTime: number,
): boolean {
  return (
    isVideoFrameRequestCurrent(requestGeneration, currentGeneration) &&
    Number.isFinite(presentedCurrentTime) &&
    Number.isFinite(targetCurrentTime) &&
    Math.abs(presentedCurrentTime - targetCurrentTime) <= VIDEO_POSITION_TOLERANCE_SECONDS
  )
}

/**
 * Confirms that the frame submitted for display belongs to the current source,
 * clip, seek, and paused media position. `mediaTime` is the frame PTS; it may
 * precede the seek position by that frame's duration, so no fixed frame rate is
 * assumed.
 */
export function isPresentedVideoFrameCurrent(
  frame: PresentedVideoFrame | null,
  target: PresentedVideoFrameTarget,
): boolean {
  return (
    frame !== null &&
    frame.mediaId === target.mediaId &&
    frame.clipId === target.clipId &&
    Number.isFinite(frame.mediaTime) &&
    Number.isFinite(frame.currentTime) &&
    Number.isFinite(frame.seekGeneration) &&
    frame.seekGeneration === target.seekGeneration &&
    frame.mediaTime <= target.mediaTime + MEDIA_TIME_EPSILON_SECONDS &&
    Math.abs(frame.currentTime - target.mediaTime) <= VIDEO_POSITION_TOLERANCE_SECONDS &&
    Math.abs(target.currentTime - target.mediaTime) <= VIDEO_POSITION_TOLERANCE_SECONDS
  )
}
