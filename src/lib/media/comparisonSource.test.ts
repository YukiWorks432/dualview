import { describe, expect, it } from 'vitest'

import type { MediaFile, TimelineClip, TimelineTrack } from '../../types'
import { resolveVisualTrackSource } from './comparisonSource'

const first: TimelineClip = {
  id: 'first',
  mediaId: 'first-media',
  trackId: 'a',
  startTime: 2,
  endTime: 5,
  inPoint: 0,
  outPoint: 3,
}
const later: TimelineClip = {
  id: 'later',
  mediaId: 'later-media',
  trackId: 'a',
  startTime: 7,
  endTime: 10,
  inPoint: 2,
  outPoint: 5,
}
function track(type: 'a' | 'b', clips: TimelineClip[]): TimelineTrack {
  return {
    id: type,
    name: type,
    type,
    clips,
    acceptedTypes: ['video', 'image'],
    muted: false,
    locked: false,
  }
}
function media(id: string, overrides: Partial<MediaFile> = {}): MediaFile {
  return {
    id,
    name: id,
    type: 'video',
    url: `blob:${id}`,
    file: new File([], id),
    status: 'ready',
    ...overrides,
  }
}
const files = [media(first.mediaId), media(later.mediaId)]
const getFile = (id: string) => files.find((file) => file.id === id)

describe('比較面の素材解決', () => {
  it('トラックがない場合と空のトラックでは表示も解析対象もない', () => {
    for (const tracks of [[], [track('a', [])]]) {
      expect(resolveVisualTrackSource(tracks, 'a', 3, getFile)).toEqual({
        activeClip: null,
        displayClip: null,
        media: null,
      })
    }
  })

  it('A/Bそれぞれの現在クリップを使い、別トラックの素材を混ぜない', () => {
    const tracks = [track('b', [later]), track('a', [first])]
    expect(resolveVisualTrackSource(tracks, 'a', 3, getFile)).toEqual({
      activeClip: first,
      displayClip: first,
      media: files[0],
    })
    expect(resolveVisualTrackSource(tracks, 'b', 8, getFile)).toEqual({
      activeClip: later,
      displayClip: later,
      media: files[1],
    })
  })

  it.each([0, 5, 6, 10])('時刻%sの空白区間では表示素材があっても解析対象にしない', (time) => {
    expect(resolveVisualTrackSource([track('a', [first, later])], 'a', time, getFile)).toEqual({
      activeClip: null,
      displayClip: first,
      media: files[0],
    })
  })

  it('隣接境界は開始側のクリップに属し、先頭表示への代替に戻らない', () => {
    const adjacent = { ...later, startTime: first.endTime }
    expect(resolveVisualTrackSource([track('a', [first, adjacent])], 'a', 5, getFile)).toEqual({
      activeClip: adjacent,
      displayClip: adjacent,
      media: files[1],
    })
  })

  it.each([
    { type: 'video' as const, playbackBackend: 'native' as const },
    { type: 'video' as const, playbackBackend: 'mediabunny' as const, videoCodec: 'prores' },
    { type: 'image' as const, hasAlpha: true },
  ])('表示可能な素材の属性を保持する: %j', (attributes) => {
    const source = media(first.mediaId, attributes)
    expect(resolveVisualTrackSource([track('a', [first])], 'a', 3, () => source).media).toBe(source)
  })

  it('素材の差替えと削除を次の解決に反映し、古い素材を保持しない', () => {
    const tracks = [track('a', [first])]
    const replacement = media(first.mediaId, { type: 'image', url: 'blob:replacement' })
    expect(resolveVisualTrackSource(tracks, 'a', 3, getFile).media).toBe(files[0])
    expect(resolveVisualTrackSource(tracks, 'a', 3, () => replacement).media).toBe(replacement)
    expect(resolveVisualTrackSource(tracks, 'a', 3, () => undefined)).toEqual({
      activeClip: first,
      displayClip: first,
      media: null,
    })
  })

  it('型の範囲外の素材を映像解析へ渡さず、別素材への代替もしない', () => {
    // 保存データなどから型の範囲外の値が渡っても、既存の映像種別ガードを維持する。
    const audio = { ...media(later.mediaId), type: 'audio' } as unknown as MediaFile
    const lookup = (id: string) => (id === audio.id ? audio : getFile(id))
    expect(resolveVisualTrackSource([track('a', [first, later])], 'a', 8, lookup)).toEqual({
      activeClip: later,
      displayClip: later,
      media: null,
    })
  })
})
