export type VideoFrameElement = HTMLVideoElement | HTMLCanvasElement
export type VisualFrameElement = VideoFrameElement | HTMLImageElement

export function isVideoFrameReady(source: VideoFrameElement | null): boolean {
  if (!source) return false
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

export function isVisualFrameReady(source: VisualFrameElement | null): boolean {
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
