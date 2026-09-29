import type { MediaType } from '../../types'

export const MEDIA_DRAG_TYPE = 'application/x-dualview-media'

export interface MediaDragData {
  mediaId: string
  mediaType: MediaType
  duration: number
  name: string
}
