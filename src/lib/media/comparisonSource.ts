import type { MediaFile, TimelineTrack } from '../../types'
import { findActiveClip } from './timeline'

/** 表示用の先頭クリップ代替を、解析の可否に使う現在クリップと分けて解決する。 */
export function resolveVisualTrackSource(
  tracks: readonly TimelineTrack[],
  trackType: 'a' | 'b',
  currentTime: number,
  getFile: (id: string) => MediaFile | undefined,
) {
  const clips = tracks.find((track) => track.type === trackType)?.clips ?? []
  const activeClip = findActiveClip(clips, currentTime)
  const displayClip = activeClip ?? clips[0] ?? null
  const rawMedia = displayClip ? getFile(displayClip.mediaId) : undefined
  const media = rawMedia?.type === 'video' || rawMedia?.type === 'image' ? rawMedia : null

  return { activeClip, displayClip, media }
}
