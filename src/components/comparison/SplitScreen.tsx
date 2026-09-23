import { useRef } from 'react'

import { useSyncedZoom } from '../../hooks/useSyncedZoom'
import type { VideoFrameElement } from '../../lib/media/frameSource'
import { cn } from '../../lib/utils'
import { useMediaStore } from '../../stores/mediaStore'
import { useProjectStore } from '../../stores/projectStore'
import { useTimelineStore } from '../../stores/timelineStore'
import type { SplitLayout } from '../../types'
import { VideoSurface } from '../media/VideoSurface'

const layoutClasses: Record<SplitLayout, string> = {
  '2x1': 'grid-cols-2 grid-rows-1',
  '1x2': 'grid-cols-1 grid-rows-2',
  '2x2': 'grid-cols-2 grid-rows-2',
}

export function SplitScreen() {
  const videoARef = useRef<VideoFrameElement>(null)
  const videoBRef = useRef<VideoFrameElement>(null)
  const videoCRef = useRef<VideoFrameElement>(null)
  const videoDRef = useRef<VideoFrameElement>(null)

  const { splitLayout } = useProjectStore()
  const { tracks } = useTimelineStore()
  const { getFile } = useMediaStore()
  const { zoom, resetZoom, getTransformStyle, containerProps } = useSyncedZoom()

  const trackA = tracks.find((t) => t.type === 'a')
  const trackB = tracks.find((t) => t.type === 'b')
  const clipA = trackA?.clips[0]
  const clipB = trackB?.clips[0]
  // Only use video/image, not audio
  const rawMediaA = clipA ? getFile(clipA.mediaId) : null
  const rawMediaB = clipB ? getFile(clipB.mediaId) : null
  const mediaA = rawMediaA?.type === 'video' || rawMediaA?.type === 'image' ? rawMediaA : null
  const mediaB = rawMediaB?.type === 'video' || rawMediaB?.type === 'image' ? rawMediaB : null

  const slots = splitLayout === '2x2' ? 4 : 2
  const clipList = [clipA, clipB, null, null].slice(0, slots)
  const mediaList = [mediaA, mediaB, null, null].slice(0, slots)
  const videoRefs = [videoARef, videoBRef, videoCRef, videoDRef].slice(0, slots)

  const transformStyle = getTransformStyle()

  return (
    <div
      className={cn('w-full h-full grid gap-1 bg-black relative', layoutClasses[splitLayout])}
      {...containerProps}
    >
      {/* Zoom indicator (IMG-002) */}
      {zoom > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/70 backdrop-blur-sm px-3 py-1 flex items-center gap-2">
          <span className="text-xs text-text-primary font-medium">{Math.round(zoom * 100)}%</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              resetZoom()
            }}
            className="text-[10px] text-text-muted hover:text-text-primary"
          >
            Reset
          </button>
        </div>
      )}

      {mediaList.map((media, index) => (
        <div key={index} className="relative bg-surface overflow-hidden">
          <div className="w-full h-full" style={transformStyle}>
            {media ? (
              media.type === 'video' ? (
                <VideoSurface
                  ref={videoRefs[index]}
                  media={media}
                  clip={clipList[index]}
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={media.url}
                  className="w-full h-full object-contain"
                  alt={`Slot ${index + 1}`}
                  draggable={false}
                />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-muted">
                <span>Slot {index + 1}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
