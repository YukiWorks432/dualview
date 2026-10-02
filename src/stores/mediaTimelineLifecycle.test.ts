import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { useHistoryStore as history } from './historyStore'
import { useKeyframeStore as keyframes } from './keyframeStore'
import { useMediaStore as media } from './mediaStore'
import { usePlaybackStore as playback } from './playbackStore'
import { useTimelineStore as timeline } from './timelineStore'

const clips = () => timeline.getState().tracks.flatMap((track) => track.clips)

beforeEach(() => {
  vi.stubGlobal('window', { dispatchEvent: vi.fn<(event: unknown) => boolean>(() => true) })
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  )
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  timeline.setState(timeline.getInitialState())
  playback.setState(playback.getInitialState())
  keyframes.setState(keyframes.getInitialState())
  history.getState().clear()
  media.setState({
    files: ['long', 'short'].map((id) => ({
      id,
      name: id,
      type: 'video' as const,
      duration: id === 'long' ? 75 : 10,
      file: new File(['fixture'], id),
      url: `blob:integration-${id}`,
      status: 'ready' as const,
    })),
    selectedIds: ['long'],
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it.each(['remove', 'clear'] as const)(
  '素材の%s後も時間範囲・選択・複製元・キーフレーム・履歴を整合させる',
  (action) => {
    const long = timeline.getState().addClip('track-a', 'long', 0, 75)
    const short = timeline.getState().addClip('track-b', 'short', 0, 10)
    timeline.getState().selectClips([long.id])
    timeline.getState().copyClip(long.id)
    keyframes.getState().addKeyframeToClip(long.id, 'opacity', 1, 0.5)
    history.getState().runWithHistory(() => timeline.getState().moveClip(long.id, 'track-a', 5))
    playback.getState().seek(79)

    if (action === 'remove') media.getState().removeFile('long')
    else media.getState().clearFiles()

    const duration = action === 'remove' ? 10 : 1
    const verify = () => {
      expect(clips().map((clip) => clip.id)).toEqual(action === 'remove' ? [short.id] : [])
      expect(timeline.getState()).toMatchObject({
        duration,
        selectedClipId: null,
        selectedClipIds: [],
        clipboardClipId: null,
      })
      expect(playback.getState().currentTime).toBeLessThan(duration)
      expect(timeline.getState().currentTime).toBe(playback.getState().currentTime)
      expect(keyframes.getState().clipKeyframes.has(long.id)).toBe(false)
      expect(timeline.getState().pasteClip('track-a', 0)).toBeNull()
    }
    verify()
    history.getState().undo()
    verify()
    history.getState().redo()
    verify()
    const revokedIds = action === 'clear' ? ['long', 'short'] : ['long']
    expect(vi.mocked(URL.revokeObjectURL).mock.calls.map(([url]) => url)).toEqual(
      revokedIds.map((id) => `blob:integration-${id}`),
    )
  },
)
