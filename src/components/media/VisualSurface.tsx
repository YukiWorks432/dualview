import { forwardRef, type CSSProperties, type ForwardedRef, type MouseEvent } from 'react'

import type { VisualFrameElement } from '../../lib/media/frameSource'
import type { MediaFile, TimelineClip } from '../../types'
import { VideoSurface } from './VideoSurface'

interface VisualSurfaceProps {
  media: MediaFile
  clip: TimelineClip | null
  className?: string
  style?: CSSProperties
  dataTrack?: string
  alt?: string
  onClick?: (event: MouseEvent<VisualFrameElement>) => void
  onFrameReady?: () => void
}

function assignRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') {
    ref(value)
  } else if (ref) {
    ref.current = value
  }
}

export const VisualSurface = forwardRef<VisualFrameElement, VisualSurfaceProps>(
  function VisualSurface(
    { media, clip, className, style, dataTrack, alt = '', onClick, onFrameReady },
    forwardedRef,
  ) {
    if (media.type === 'image') {
      return (
        <img
          ref={(node) => assignRef(forwardedRef, node)}
          src={media.url}
          className={className}
          style={style}
          data-track={dataTrack}
          alt={alt}
          draggable={false}
          onLoad={onFrameReady}
          onClick={onClick}
        />
      )
    }

    return (
      <VideoSurface
        ref={(node) => assignRef(forwardedRef, node)}
        media={media}
        clip={clip}
        className={className}
        style={style}
        dataTrack={dataTrack}
        onClick={onClick}
        onFrameReady={onFrameReady}
      />
    )
  },
)
