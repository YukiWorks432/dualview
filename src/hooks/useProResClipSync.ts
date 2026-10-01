import { ALL_FORMATS, BlobSource, CanvasSink, Input } from 'mediabunny'
import { useEffect } from 'react'

import { ensureProResDecoder } from '../lib/media/prores'
import { LatestRequestGate } from '../lib/media/requestGate'
import { calculateMediaTime } from '../lib/media/timeline'
import { usePlaybackStore } from '../stores/playbackStore'
import type { MediaFile, TimelineClip } from '../types'

export function useProResClipSync(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  media: MediaFile | null,
  clip: TimelineClip | null,
  onFrameReady?: () => void,
): void {
  useEffect(() => {
    if (!media || media.playbackBackend !== 'mediabunny' || !clip) return

    let disposed = false
    let input: Input | null = null
    let sink: CanvasSink | null = null
    let rendering = false
    let queuedRequest: { timelineTime: number; generation: number } | null = null
    const requestGate = new LatestRequestGate()
    let requestGeneration = requestGate.begin()

    const clearFrame = () => {
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (canvas) {
        canvas.dataset.frameReady = 'false'
        delete canvas.dataset.frameMediaTime
        delete canvas.dataset.frameMediaEndTime
        delete canvas.dataset.frameRequestedMediaTime
        delete canvas.dataset.frameMediaId
        delete canvas.dataset.frameClipId
        delete canvas.dataset.framePresentedGeneration
      }
      if (canvas && context) {
        context.clearRect(0, 0, canvas.width, canvas.height)
      }
      if (!usePlaybackStore.getState().isPlaying) {
        onFrameReady?.()
      }
    }

    const renderQueuedFrame = async () => {
      if (rendering || !sink) return
      rendering = true

      try {
        while (!disposed && queuedRequest !== null) {
          const request = queuedRequest
          queuedRequest = null

          const mediaTime = calculateMediaTime(request.timelineTime, clip)
          if (mediaTime === null) {
            clearFrame()
            continue
          }

          const frame = await sink.getCanvas(mediaTime)
          if (disposed || !frame || !requestGate.isCurrent(request.generation)) continue

          const frameStart = frame.timestamp
          const frameEnd = frame.timestamp + frame.duration
          const frameMatchesRequest =
            Number.isFinite(frameStart) &&
            Number.isFinite(frameEnd) &&
            frameEnd > frameStart &&
            mediaTime >= frameStart - 0.000001 &&
            mediaTime <= frameEnd + 0.000001

          const canvas = canvasRef.current
          if (!canvas) continue

          const source = frame.canvas
          if (canvas.width !== source.width || canvas.height !== source.height) {
            canvas.width = source.width
            canvas.height = source.height
          }

          const context = canvas.getContext('2d', { alpha: media.hasAlpha ?? false })
          if (!context) continue

          context.clearRect(0, 0, canvas.width, canvas.height)
          context.drawImage(source, 0, 0, canvas.width, canvas.height)
          canvas.dataset.frameReady = 'true'
          if (frameMatchesRequest) {
            canvas.dataset.frameMediaTime = String(frameStart)
            canvas.dataset.frameMediaEndTime = String(frameEnd)
            canvas.dataset.frameRequestedMediaTime = String(mediaTime)
            canvas.dataset.frameMediaId = media.id
            canvas.dataset.frameClipId = clip.id
            canvas.dataset.framePresentedGeneration = String(request.generation)
          } else {
            delete canvas.dataset.frameMediaTime
            delete canvas.dataset.frameMediaEndTime
            delete canvas.dataset.frameRequestedMediaTime
            delete canvas.dataset.frameMediaId
            delete canvas.dataset.frameClipId
            delete canvas.dataset.framePresentedGeneration
          }

          if (!usePlaybackStore.getState().isPlaying) {
            onFrameReady?.()
          }
        }
      } catch (error) {
        if (!disposed) {
          console.error('Failed to decode ProRes frame:', error)
        }
      } finally {
        rendering = false
        if (!disposed && queuedRequest !== null) {
          void renderQueuedFrame()
        }
      }
    }

    const requestFrame = (timelineTime: number, invalidateInFlight = false) => {
      if (invalidateInFlight) {
        requestGeneration = requestGate.begin()
      }

      if (!usePlaybackStore.getState().isPlaying) {
        clearFrame()
      }

      const canvas = canvasRef.current
      if (canvas) canvas.dataset.frameSeekGeneration = String(requestGeneration)

      queuedRequest = { timelineTime, generation: requestGeneration }
      void renderQueuedFrame()
    }

    clearFrame()
    if (canvasRef.current) {
      canvasRef.current.dataset.frameSeekGeneration = String(requestGeneration)
    }

    const initialize = async () => {
      try {
        await ensureProResDecoder()
        if (disposed) return

        input = new Input({
          formats: ALL_FORMATS,
          source: new BlobSource(media.file),
        })

        const track = await input.getPrimaryVideoTrack()
        if (!track) {
          throw new Error('No video track found')
        }

        sink = new CanvasSink(track, {
          alpha: media.hasAlpha ?? false,
          poolSize: 3,
        })

        requestFrame(usePlaybackStore.getState().currentTime)
      } catch (error) {
        if (!disposed) {
          console.error('Failed to initialize ProRes decoder:', error)
        }
      }
    }

    const unsubscribe = usePlaybackStore.subscribe((state, previousState) => {
      if (state.currentTime !== previousState.currentTime) {
        requestFrame(state.currentTime, !state.isPlaying)
      } else if (previousState.isPlaying && !state.isPlaying) {
        requestFrame(state.currentTime, true)
      }
    })

    const handlePlaybackSeek = (event: CustomEvent<{ time: number }>) => {
      requestFrame(event.detail.time, true)
    }

    window.addEventListener('playback-seek', handlePlaybackSeek as EventListener)
    void initialize()

    return () => {
      disposed = true
      requestGate.invalidate()
      queuedRequest = null
      unsubscribe()
      window.removeEventListener('playback-seek', handlePlaybackSeek as EventListener)
      input?.dispose()
    }
  }, [canvasRef, media, clip, onFrameReady])
}
