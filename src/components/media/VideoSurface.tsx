import {
  forwardRef,
  useCallback,
  useLayoutEffect,
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

const SEEK_TIME_EPSILON_SECONDS = 0.000001

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
  const onFrameReadyRef = useRef(onFrameReady)
  const useMediabunny = media.playbackBackend === 'mediabunny'
  const hasFrameReadyCallback = onFrameReady !== undefined

  useLayoutEffect(() => {
    onFrameReadyRef.current = onFrameReady
  }, [onFrameReady])

  useOptimizedClipSync(videoRef, useMediabunny ? null : clip)
  useProResClipSync(
    canvasRef,
    useMediabunny ? media : null,
    useMediabunny ? clip : null,
    onFrameReady,
  )

  useLayoutEffect(() => {
    const video = videoRef.current
    if (!video || !onFrameReadyRef.current) return

    const requestVideoFrameCallback = video.requestVideoFrameCallback
    const cancelVideoFrameCallback = video.cancelVideoFrameCallback
    if (typeof requestVideoFrameCallback !== 'function') {
      video.dataset.framePresentedSupported = 'false'
      onFrameReadyRef.current?.()
      return
    }

    let disposed = false
    let callbackId: number | null = null
    let seekGeneration = 0
    let seekingTargetTime: number | null = null

    const beginSeek = (targetTime: number) => {
      if (
        seekingTargetTime === null ||
        Math.abs(seekingTargetTime - targetTime) > SEEK_TIME_EPSILON_SECONDS
      ) {
        seekGeneration += 1
        seekingTargetTime = targetTime
        video.dataset.frameSeekGeneration = String(seekGeneration)
      }
    }

    const clearPresentedFrame = (clearMetadata: boolean) => {
      video.dataset.frameReady = 'false'
      video.dataset.frameSeekGeneration = String(seekGeneration)
      if (clearMetadata) {
        delete video.dataset.framePresentedMediaTime
        delete video.dataset.framePresentedCurrentTime
        delete video.dataset.framePresentedMediaId
        delete video.dataset.framePresentedClipId
        delete video.dataset.framePresentedSeekGeneration
      }
    }

    const requestNextFrame = () => {
      if (disposed || callbackId !== null) return
      callbackId = requestVideoFrameCallback.call(video, handleVideoFrame)
    }

    const handleVideoFrame: VideoFrameRequestCallback = (_now, metadata) => {
      callbackId = null
      if (disposed) return
      if (video.seeking) beginSeek(video.currentTime)

      video.dataset.frameReady = video.seeking ? 'false' : 'true'
      video.dataset.framePresentedMediaTime = String(metadata.mediaTime)
      video.dataset.framePresentedCurrentTime = String(video.currentTime)
      video.dataset.framePresentedMediaId = media.id
      video.dataset.framePresentedClipId = clip?.id ?? ''
      video.dataset.framePresentedSeekGeneration = String(seekGeneration)

      if (!video.seeking && video.paused) onFrameReadyRef.current?.()
      requestNextFrame()
    }

    const handleLoadStart = () => {
      seekGeneration += 1
      seekingTargetTime = null
      clearPresentedFrame(true)
      if (callbackId !== null) {
        cancelVideoFrameCallback?.call(video, callbackId)
        callbackId = null
      }
      onFrameReadyRef.current?.()
    }

    const handleSeeking = () => {
      beginSeek(video.currentTime)
      clearPresentedFrame(false)
      onFrameReadyRef.current?.()
    }

    const requestFrameAfterLoadOrSeek = () => {
      if (!video.seeking) {
        const presentedGeneration = Number(video.dataset.framePresentedSeekGeneration)
        if (
          video.dataset.framePresentedMediaTime !== undefined &&
          presentedGeneration === seekGeneration
        ) {
          // A callback can land while a seek is in progress. Pair its PTS with
          // the settled media position after that seek completes.
          video.dataset.framePresentedCurrentTime = String(video.currentTime)
          video.dataset.frameReady = 'true'
        }
        seekingTargetTime = null
      }
      requestNextFrame()
      onFrameReadyRef.current?.()
    }

    const handlePause = () => {
      if (
        video.dataset.frameReady === 'true' &&
        Number(video.dataset.framePresentedSeekGeneration) === seekGeneration
      ) {
        // No new frame is submitted just because playback pauses. The last
        // submitted frame remains visible at the media element's paused time.
        video.dataset.framePresentedCurrentTime = String(video.currentTime)
      }
      onFrameReadyRef.current?.()
    }

    video.dataset.framePresentedSupported = 'true'
    clearPresentedFrame(true)
    video.addEventListener('loadstart', handleLoadStart)
    video.addEventListener('seeking', handleSeeking)
    video.addEventListener('loadeddata', requestFrameAfterLoadOrSeek)
    video.addEventListener('seeked', requestFrameAfterLoadOrSeek)
    video.addEventListener('pause', handlePause)
    requestNextFrame()

    return () => {
      disposed = true
      video.removeEventListener('loadstart', handleLoadStart)
      video.removeEventListener('seeking', handleSeeking)
      video.removeEventListener('loadeddata', requestFrameAfterLoadOrSeek)
      video.removeEventListener('seeked', requestFrameAfterLoadOrSeek)
      video.removeEventListener('pause', handlePause)
      if (callbackId !== null) cancelVideoFrameCallback?.call(video, callbackId)
    }
  }, [hasFrameReadyCallback, clip?.id, clip?.mediaId, media.id, media.url, useMediabunny])

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

  const handleNativeFramePending = useCallback((event: SyntheticEvent<HTMLVideoElement>) => {
    event.currentTarget.dataset.frameReady = 'false'
    if (event.type === 'loadstart') {
      delete event.currentTarget.dataset.framePresentedMediaTime
      delete event.currentTarget.dataset.framePresentedCurrentTime
      delete event.currentTarget.dataset.framePresentedMediaId
      delete event.currentTarget.dataset.framePresentedClipId
      delete event.currentTarget.dataset.framePresentedSeekGeneration
    }
  }, [])

  const handleNativeFrameReady = useCallback((event: SyntheticEvent<HTMLVideoElement>) => {
    if (!onFrameReadyRef.current) event.currentTarget.dataset.frameReady = 'true'
  }, [])

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
      onLoadStart={handleNativeFramePending}
      onLoadedData={handleNativeFrameReady}
      onPause={handleNativeFrameReady}
      onSeeking={handleNativeFramePending}
      onSeeked={handleNativeFrameReady}
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
    />
  )
})
