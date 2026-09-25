import {
  forwardRef,
  useCallback,
  useRef,
  type CSSProperties,
  type ForwardedRef,
  type MouseEvent,
  type SyntheticEvent,
} from 'react'

import { useOptimizedClipSync } from '../../hooks/useOptimizedVideoSync'
import { useProResClipSync } from '../../hooks/useProResClipSync'
import type { VideoFrameElement } from '../../lib/media/frameSource'
import type { MediaFile, TimelineClip } from '../../types'

interface VideoSurfaceProps {
  media: MediaFile
  clip: TimelineClip | null
  className?: string
  style?: CSSProperties
  dataTrack?: string
  onClick?: (event: MouseEvent<VideoFrameElement>) => void
  onFrameReady?: () => void
}

function assignRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') {
    ref(value)
  } else if (ref) {
    ref.current = value
  }
}

export const VideoSurface = forwardRef<VideoFrameElement, VideoSurfaceProps>(function VideoSurface(
  { media, clip, className, style, dataTrack, onClick, onFrameReady },
  forwardedRef,
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const useMediabunny = media.playbackBackend === 'mediabunny'

  useOptimizedClipSync(videoRef, useMediabunny ? null : clip)
  useProResClipSync(
    canvasRef,
    useMediabunny ? media : null,
    useMediabunny ? clip : null,
    onFrameReady,
  )

  const setVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node
      if (node && node.dataset.frameReady === undefined) {
        node.dataset.frameReady = 'false'
      }
      assignRef(forwardedRef, node)
    },
    [forwardedRef],
  )

  const setCanvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      canvasRef.current = node
      if (node && node.dataset.frameReady === undefined) {
        node.dataset.frameReady = 'false'
      }
      assignRef(forwardedRef, node)
    },
    [forwardedRef],
  )

  const handleNativeFramePending = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      event.currentTarget.dataset.frameReady = 'false'
      onFrameReady?.()
    },
    [onFrameReady],
  )

  const handleNativeFrameReady = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      event.currentTarget.dataset.frameReady = 'true'
      onFrameReady?.()
    },
    [onFrameReady],
  )

  if (useMediabunny) {
    return (
      <canvas
        ref={setCanvasRef}
        className={className}
        style={style}
        data-track={dataTrack}
        onClick={onClick}
      />
    )
  }

  return (
    <video
      ref={setVideoRef}
      src={media.url}
      className={className}
      style={style}
      data-track={dataTrack}
      onClick={onClick}
      onLoadedData={handleNativeFrameReady}
      onSeeking={handleNativeFramePending}
      onSeeked={handleNativeFrameReady}
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
    />
  )
})
