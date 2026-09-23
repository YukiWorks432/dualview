import {
  forwardRef,
  useCallback,
  useRef,
  type CSSProperties,
  type ForwardedRef,
  type MouseEvent,
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
}

function assignRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') {
    ref(value)
  } else if (ref) {
    ref.current = value
  }
}

export const VideoSurface = forwardRef<VideoFrameElement, VideoSurfaceProps>(function VideoSurface(
  { media, clip, className, style, dataTrack, onClick },
  forwardedRef,
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const useMediabunny = media.playbackBackend === 'mediabunny'

  useOptimizedClipSync(videoRef, useMediabunny ? null : clip)
  useProResClipSync(canvasRef, useMediabunny ? media : null, useMediabunny ? clip : null)

  const setVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node
      assignRef(forwardedRef, node)
    },
    [forwardedRef],
  )

  const setCanvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      canvasRef.current = node
      assignRef(forwardedRef, node)
    },
    [forwardedRef],
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
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
    />
  )
})
