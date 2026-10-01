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
import {
  isPresentedVideoFrameCandidateCurrent,
  isVideoFrameRequestCurrent,
  VIDEO_FRAME_SEEK_REQUEST_EVENT,
} from '../../lib/media/presentedVideoFrame'
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
    if (
      typeof requestVideoFrameCallback !== 'function' ||
      typeof cancelVideoFrameCallback !== 'function'
    ) {
      video.dataset.framePresentedSupported = 'false'
      onFrameReadyRef.current?.()
      return
    }

    let disposed = false
    let callbackId: number | null = null
    let callbackToken = 0
    let seekGeneration = 0
    let hasRequestedSeek = false
    let requestedSeekTarget: number | null = null
    let seekingFrame: {
      mediaTime: number
      currentTime: number
      mediaId: string
      clipId: string
      seekGeneration: number
    } | null = null

    const clearPresentedFrame = () => {
      video.dataset.frameReady = 'false'
      video.dataset.frameSeekGeneration = String(seekGeneration)
      delete video.dataset.framePresentedMediaTime
      delete video.dataset.framePresentedCurrentTime
      delete video.dataset.framePresentedMediaId
      delete video.dataset.framePresentedClipId
      delete video.dataset.framePresentedSeekGeneration
    }

    const markInitialFramePosition = () => {
      if (hasRequestedSeek || video.seeking || video.currentTime !== 0) {
        delete video.dataset.frameInitialFrameGeneration
        return
      }

      video.dataset.frameInitialFrameGeneration = String(seekGeneration)
    }

    const cancelPendingFrameCallback = () => {
      if (callbackId === null) return
      cancelVideoFrameCallback.call(video, callbackId)
      callbackId = null
      callbackToken += 1
    }

    let requestNextFrame: (allowWhileSeeking?: boolean) => void = () => {}

    const beginSeek = (targetTime: number) => {
      if (
        requestedSeekTarget !== null &&
        Math.abs(requestedSeekTarget - targetTime) <= SEEK_TIME_EPSILON_SECONDS
      ) {
        return
      }

      hasRequestedSeek = true
      delete video.dataset.frameInitialFrameGeneration
      seekGeneration += 1
      requestedSeekTarget = targetTime
      seekingFrame = null
      clearPresentedFrame()
      cancelPendingFrameCallback()
      requestNextFrame(true)
      onFrameReadyRef.current?.()
    }

    const commitPresentedFrame = (frame: NonNullable<typeof seekingFrame>) => {
      video.dataset.frameReady = 'true'
      video.dataset.framePresentedMediaTime = String(frame.mediaTime)
      video.dataset.framePresentedCurrentTime = String(frame.currentTime)
      video.dataset.framePresentedMediaId = frame.mediaId
      video.dataset.framePresentedClipId = frame.clipId
      video.dataset.framePresentedSeekGeneration = String(frame.seekGeneration)
    }

    const handleVideoFrame = (requestGeneration: number, metadata: VideoFrameCallbackMetadata) => {
      callbackId = null
      if (disposed) return
      if (!isVideoFrameRequestCurrent(requestGeneration, seekGeneration)) {
        if (!video.seeking) requestNextFrame()
        return
      }

      const frame = {
        mediaTime: metadata.mediaTime,
        currentTime: video.currentTime,
        mediaId: media.id,
        clipId: clip?.id ?? '',
        seekGeneration: requestGeneration,
      }
      if (video.seeking) {
        seekingFrame = frame
        return
      }

      commitPresentedFrame(frame)

      if (video.paused) onFrameReadyRef.current?.()
      requestNextFrame()
    }

    requestNextFrame = (allowWhileSeeking = false) => {
      if (disposed || callbackId !== null || (video.seeking && !allowWhileSeeking)) return
      const requestGeneration = seekGeneration
      const requestToken = ++callbackToken
      callbackId = requestVideoFrameCallback.call(video, (_now, metadata) => {
        if (requestToken !== callbackToken) return
        handleVideoFrame(requestGeneration, metadata)
      })
    }

    const handleLoadStart = () => {
      seekGeneration += 1
      requestedSeekTarget = null
      seekingFrame = null
      clearPresentedFrame()
      markInitialFramePosition()
      cancelPendingFrameCallback()
      onFrameReadyRef.current?.()
    }

    const handleSeeking = () => {
      beginSeek(video.currentTime)
    }

    const handleSeekRequest = (event: Event) => {
      const { targetTime } = (event as CustomEvent<{ targetTime: number }>).detail
      if (Number.isFinite(targetTime)) beginSeek(targetTime)
    }

    const handleLoadedData = () => {
      if (!video.seeking) requestNextFrame()
      onFrameReadyRef.current?.()
    }

    const handleSeeked = () => {
      if (video.seeking) return
      requestedSeekTarget = null
      const candidate = seekingFrame
      seekingFrame = null
      if (
        candidate &&
        isPresentedVideoFrameCandidateCurrent(
          candidate.seekGeneration,
          seekGeneration,
          candidate.currentTime,
          video.currentTime,
        )
      ) {
        commitPresentedFrame(candidate)
      }
      requestNextFrame()
      onFrameReadyRef.current?.()
    }

    const handlePause = () => {
      onFrameReadyRef.current?.()
    }

    video.dataset.framePresentedSupported = 'true'
    clearPresentedFrame()
    markInitialFramePosition()
    video.addEventListener(VIDEO_FRAME_SEEK_REQUEST_EVENT, handleSeekRequest)
    video.addEventListener('loadstart', handleLoadStart)
    video.addEventListener('seeking', handleSeeking)
    video.addEventListener('loadeddata', handleLoadedData)
    video.addEventListener('seeked', handleSeeked)
    video.addEventListener('pause', handlePause)
    if (video.seeking) beginSeek(video.currentTime)
    else requestNextFrame()

    return () => {
      disposed = true
      video.removeEventListener(VIDEO_FRAME_SEEK_REQUEST_EVENT, handleSeekRequest)
      video.removeEventListener('loadstart', handleLoadStart)
      video.removeEventListener('seeking', handleSeeking)
      video.removeEventListener('loadeddata', handleLoadedData)
      video.removeEventListener('seeked', handleSeeked)
      video.removeEventListener('pause', handlePause)
      cancelPendingFrameCallback()
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
      data-frame-source-media-id={media.id}
      data-frame-source-clip-id={clip?.id ?? ''}
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
