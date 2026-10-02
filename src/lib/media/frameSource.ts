import type { TimelineClip } from '../../types'
import { isPresentedVideoFrameCurrent, type PresentedVideoFrame } from './presentedVideoFrame'
import { calculateMediaTime } from './timeline'

export type VideoFrameElement = HTMLVideoElement | HTMLCanvasElement
export type VisualFrameElement = VideoFrameElement | HTMLImageElement

export function isVideoFrameReady(source: VideoFrameElement | null): source is VideoFrameElement {
  if (!source || source.dataset.frameReady === 'false') return false
  if (source instanceof HTMLVideoElement) {
    return source.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
  }
  return source.width > 0 && source.height > 0
}

export function getVideoFrameDimensions(source: VideoFrameElement | null): {
  width: number
  height: number
} {
  if (!source) return { width: 0, height: 0 }
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight }
  }
  return { width: source.width, height: source.height }
}

export function isVisualFrameReady(
  source: VisualFrameElement | null,
): source is VisualFrameElement {
  if (!source) return false
  if (source instanceof HTMLImageElement) {
    return source.complete && source.naturalWidth > 0 && source.naturalHeight > 0
  }
  return isVideoFrameReady(source)
}

export function getVisualFrameDimensions(source: VisualFrameElement | null): {
  width: number
  height: number
} {
  if (!source) return { width: 0, height: 0 }
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight }
  }
  return getVideoFrameDimensions(source)
}

export function isPausedVisualFrameReady(
  source: VisualFrameElement,
  clip: TimelineClip,
  timelineTime: number,
): boolean {
  const expectedMediaTime = calculateMediaTime(timelineTime, clip)
  if (expectedMediaTime === null) return false

  // 通知APIがないブラウザーのプレビューは、現在の素材・クリップ・時刻と
  // 通常のシーク完了から判定する。差分矩形のAPI必須条件は利用側で維持する。
  if (source instanceof HTMLVideoElement && source.dataset.framePresentedSupported === 'false') {
    return (
      isVisualFrameReady(source) &&
      source.paused &&
      !source.seeking &&
      source.dataset.frameSourceMediaId === clip.mediaId &&
      source.dataset.frameSourceClipId === clip.id &&
      Math.abs(source.currentTime - expectedMediaTime) <= 0.000001
    )
  }

  // 新しいフレーム通知が来ない停止動画も、素材・クリップ・シーク世代と
  // デコード完了が一致する場合に限って採用する。
  if (source instanceof HTMLVideoElement && source.dataset.frameReady !== 'true') {
    const seekGeneration = source.dataset.frameSeekGeneration
    const hasDrawablePausedFrame =
      source.paused &&
      !source.seeking &&
      source.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      Math.abs(source.currentTime - expectedMediaTime) <= 0.000001 &&
      source.dataset.frameSourceMediaId === clip.mediaId &&
      source.dataset.frameSourceClipId === clip.id &&
      Number.isFinite(Number(seekGeneration)) &&
      (source.dataset.frameInitialFrameGeneration === seekGeneration ||
        source.dataset.frameSeekedGeneration === seekGeneration)

    if (hasDrawablePausedFrame) return true
  }

  if (!isVisualFrameReady(source)) return false

  if (source instanceof HTMLCanvasElement) {
    const frameStart = Number(source.dataset.frameMediaTime)
    const frameEnd = Number(source.dataset.frameMediaEndTime)
    const requestedMediaTime = Number(source.dataset.frameRequestedMediaTime)
    const seekGeneration = Number(source.dataset.frameSeekGeneration)
    const presentedGeneration = Number(source.dataset.framePresentedGeneration)
    return (
      Number.isFinite(frameStart) &&
      Number.isFinite(frameEnd) &&
      Number.isFinite(requestedMediaTime) &&
      Number.isFinite(seekGeneration) &&
      presentedGeneration === seekGeneration &&
      source.dataset.frameMediaId === clip.mediaId &&
      source.dataset.frameClipId === clip.id &&
      Math.abs(requestedMediaTime - expectedMediaTime) <= 0.000001 &&
      expectedMediaTime >= frameStart - 0.000001
    )
  }

  if (!(source instanceof HTMLVideoElement)) return true
  if (source.seeking || !source.paused) return false

  const presentedFrame: PresentedVideoFrame = {
    mediaId: source.dataset.framePresentedMediaId ?? '',
    clipId: source.dataset.framePresentedClipId ?? '',
    mediaTime: Number(source.dataset.framePresentedMediaTime),
    currentTime: Number(source.dataset.framePresentedCurrentTime),
    seekGeneration: Number(source.dataset.framePresentedSeekGeneration),
  }

  return isPresentedVideoFrameCurrent(presentedFrame, {
    mediaId: clip.mediaId,
    clipId: clip.id,
    mediaTime: expectedMediaTime,
    currentTime: source.currentTime,
    seekGeneration: Number(source.dataset.frameSeekGeneration),
  })
}
