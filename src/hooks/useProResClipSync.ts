import { ALL_FORMATS, BlobSource, CanvasSink, Input } from 'mediabunny'
import { useEffect } from 'react'

import { ensureProResDecoder } from '../lib/media/prores'
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
    let queuedTimelineTime: number | null = null

    const clearFrame = () => {
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (canvas) {
        canvas.dataset.frameReady = 'false'
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
        while (!disposed && queuedTimelineTime !== null) {
          const timelineTime = queuedTimelineTime
          queuedTimelineTime = null

          const mediaTime = calculateMediaTime(timelineTime, clip)
          if (mediaTime === null) {
            clearFrame()
            continue
          }

          const frame = await sink.getCanvas(mediaTime)
          if (disposed || !frame) continue

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
        if (!disposed && queuedTimelineTime !== null) {
          void renderQueuedFrame()
        }
      }
    }

    const requestFrame = (timelineTime: number) => {
      if (!usePlaybackStore.getState().isPlaying) {
        clearFrame()
      }
      queuedTimelineTime = timelineTime
      void renderQueuedFrame()
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
        requestFrame(state.currentTime)
      }
    })

    void initialize()

    return () => {
      disposed = true
      queuedTimelineTime = null
      unsubscribe()
      input?.dispose()
    }
  }, [
    canvasRef,
    media?.id,
    media?.file,
    media?.playbackBackend,
    media?.hasAlpha,
    clip?.id,
    clip?.startTime,
    clip?.endTime,
    clip?.inPoint,
    clip?.outPoint,
    clip?.speed,
    clip?.reverse,
    onFrameReady,
  ])
}
