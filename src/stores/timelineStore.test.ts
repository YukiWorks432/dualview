import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { calculateMediaTime, findActiveClip } from '../lib/media/timeline'
import type { MediaFile, TimelineClip } from '../types'
import { useHistoryStore as history } from './historyStore'
import { useKeyframeStore as keyframes } from './keyframeStore'
import { useMediaStore as media } from './mediaStore'
import { usePlaybackStore as playback } from './playbackStore'
import { useTimelineStore as timeline } from './timelineStore'

function source(id: string, duration = 100): MediaFile {
  return {
    id,
    name: id,
    type: 'video',
    duration,
    file: new File([''], id),
    url: '',
    status: 'ready',
  }
}
function seed(overrides: Partial<TimelineClip> = {}) {
  const clip: TimelineClip = {
    id: 'clip',
    mediaId: 'source',
    trackId: 'track-a',
    label: '比較用',
    startTime: 10,
    endTime: 18,
    inPoint: 4,
    outPoint: 12,
    speed: 1,
    reverse: false,
    ...overrides,
  }
  timeline.setState({
    tracks: timeline
      .getInitialState()
      .tracks.map((track) => ({ ...track, clips: track.id === 'track-a' ? [clip] : [] })),
    duration: clip.endTime,
  })
  return clip
}
function clips() {
  return timeline.getState().tracks.flatMap((track) => track.clips)
}
function at(time: number) {
  const clip = findActiveClip(clips(), time)
  return clip ? calculateMediaTime(time, clip) : null
}
function expectReferences() {
  const state = timeline.getState()
  const ids = clips().map((clip) => clip.id)
  expect(state.selectedClipIds.every((id) => ids.includes(id))).toBe(true)
  expect(state.selectedClipId === null || ids.includes(state.selectedClipId)).toBe(true)
  expect(state.clipboardClipId === null || ids.includes(state.clipboardClipId)).toBe(true)
  expect(
    clips().every((clip) => media.getState().files.some((file) => file.id === clip.mediaId)),
  ).toBe(true)
  expect(state.duration).toBe(playback.getState().getEffectiveDuration())
}

beforeEach(() => {
  vi.stubGlobal('window', { dispatchEvent: vi.fn<(event: Event) => boolean>(() => true) })
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  )
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  timeline.setState(timeline.getInitialState())
  playback.setState(playback.getInitialState())
  keyframes.setState(keyframes.getInitialState())
  history.getState().clear()
  media.setState({ files: [source('source'), source('replacement', 10), source('short', 3)] })
})
afterEach(() => vi.unstubAllGlobals())

describe('クリップの素材時刻を保つ編集', () => {
  it.each([
    {
      speed: 1,
      reverse: false,
      end: 18,
      times: [10, 11, 12, 13],
      expected: [4, 5, 6, 7],
      bounds: [
        [4, 6],
        [6, 12],
      ],
    },
    {
      speed: 2,
      reverse: false,
      end: 14,
      times: [10, 11, 12, 13],
      expected: [4, 6, 8, 10],
      bounds: [
        [4, 8],
        [8, 12],
      ],
    },
    {
      speed: 0.5,
      reverse: false,
      end: 26,
      times: [10, 11, 12, 13],
      expected: [4, 4.5, 5, 5.5],
      bounds: [
        [4, 5],
        [5, 12],
      ],
    },
    {
      speed: 1,
      reverse: true,
      end: 18,
      times: [10, 11, 12, 13],
      expected: [12, 11, 10, 9],
      bounds: [
        [10, 12],
        [4, 10],
      ],
    },
    {
      speed: 2,
      reverse: true,
      end: 14,
      times: [10, 11, 12, 13],
      expected: [12, 10, 8, 6],
      bounds: [
        [8, 12],
        [4, 8],
      ],
    },
    {
      speed: 0.5,
      reverse: true,
      end: 26,
      times: [10, 11, 12, 13],
      expected: [12, 11.5, 11, 10.5],
      bounds: [
        [11, 12],
        [4, 11],
      ],
    },
  ])(
    '分割後も既知フレームが一致する $speed 倍・逆再生 $reverse',
    ({ speed, reverse, end, times, expected, bounds }) => {
      seed({ speed, reverse, endTime: end })
      expect(times.map(at)).toEqual(expected)
      const right = timeline.getState().splitClip('clip', 12)!
      expect(times.map(at)).toEqual(expected)
      expect(clips().map((clip) => [clip.inPoint, clip.outPoint])).toEqual(bounds)
      expect(right).toMatchObject({ speed, reverse, label: '比較用', mediaId: 'source' })
      expect(timeline.getState().duration).toBe(end)
    },
  )

  it.each([false, true])('先頭・末尾の1フレームを残す分割（逆再生 %s）', (reverse) => {
    seed({ startTime: 0, endTime: 1, inPoint: 4, outPoint: 6, speed: 2, reverse })
    timeline.getState().splitClip('clip', 1 / 30)
    const tail = timeline.getState().splitClip(clips()[1].id, 29 / 30)!
    expect(clips()).toHaveLength(3)
    expect(clips()[0].endTime).toBeCloseTo(1 / 30)
    expect(tail.endTime - tail.startTime).toBeCloseTo(1 / 30)
    expect(at(0)).toBe(reverse ? 6 : 4)
    expect(at(29 / 30)).toBeCloseTo(reverse ? 4.0666666667 : 5.9333333333)
    const before = clips()
    expect(timeline.getState().splitClip('clip', 0)).toBeNull()
    expect(clips()).toEqual(before)
  })

  it('旧データに末尾の静止区間があっても分割で別の素材フレームを出さない', () => {
    seed({ speed: 2 })
    expect(at(16)).toBe(12)
    timeline.getState().splitClip('clip', 12)
    expect([at(11), at(12), at(16)]).toEqual([6, 8, 12])
  })

  it.each([
    { reverse: false, reset: false, frame: 12 },
    { reverse: true, reset: false, frame: 4 },
    { reverse: false, reset: true, frame: 12 },
    { reverse: true, reset: true, frame: 4 },
  ])(
    '末尾静止区間の分割・速度変更・Undo/Redoで表示時間を保持する（逆再生 $reverse、リセット $reset）',
    ({ reverse, reset, frame }) => {
      seed({ startTime: 0, endTime: 8, inPoint: 4, outPoint: 12, speed: 2, reverse })
      let right: TimelineClip | null = null
      history.getState().runWithHistory(() => {
        right = timeline.getState().splitClip('clip', 6)
      })
      const rightId = right!.id
      expect(clips().find((clip) => clip.id === rightId)).toMatchObject({
        startTime: 6,
        endTime: 8,
        inPoint: frame,
        outPoint: frame,
      })
      history
        .getState()
        .runWithHistory(() =>
          timeline
            .getState()
            .updateClip(rightId, reset ? { speed: 1, reverse: false } : { speed: 1 }),
        )
      expect(clips().find((clip) => clip.id === rightId)).toMatchObject({
        startTime: 6,
        endTime: 8,
        speed: 1,
      })
      expect(at(6.5)).toBe(frame)
      expect(timeline.getState().duration).toBe(8)
      history.getState().undo()
      expect(clips().find((clip) => clip.id === rightId)).toMatchObject({
        endTime: 8,
        speed: 2,
        reverse,
      })
      expect(at(6.5)).toBe(frame)
      history.getState().undo()
      expect(clips()).toHaveLength(1)
      expect(at(6.5)).toBe(frame)
      history.getState().redo()
      history.getState().redo()
      expect(clips().find((clip) => clip.id === rightId)).toMatchObject({
        startTime: 6,
        endTime: 8,
        speed: 1,
      })
      expect(at(6.5)).toBe(frame)
      expect(timeline.getState().duration).toBe(8)
    },
  )

  describe.each([
    { reverse: false, tailOnly: false, heldFrame: 12 },
    { reverse: true, tailOnly: false, heldFrame: 4 },
    { reverse: false, tailOnly: true, heldFrame: 12 },
    { reverse: true, tailOnly: true, heldFrame: 4 },
  ])(
    '旧静止末尾を指定境界で切る（逆再生 $reverse、静止専用 $tailOnly）',
    ({ reverse, tailOnly, heldFrame }) => {
      it.each(['trim-end', 'keep-left', 'trim-start', 'keep-right'] as const)(
        '%s で既存の表示時間とフレームを保つ',
        (operation) => {
          media.setState({ files: [source('source', 12)] })
          seed({ startTime: 0, endTime: 8, inPoint: 4, outPoint: 12, speed: 2, reverse })
          const id = tailOnly ? timeline.getState().splitClip('clip', 6)!.id : 'clip'
          history.getState().runWithHistory(() => {
            if (operation === 'trim-end') timeline.getState().trimClip(id, 'end', 7)
            if (operation === 'keep-left') timeline.getState().splitAndKeepLeft(id, 7)
            if (operation === 'trim-start') timeline.getState().trimClip(id, 'start', 7)
            if (operation === 'keep-right') timeline.getState().splitAndKeepRight(id, 7)
          })
          const kept = clips().find((clip) => clip.id === id)!
          const trimsEnd = operation === 'trim-end' || operation === 'keep-left'
          expect(kept).toMatchObject({
            startTime: trimsEnd ? (tailOnly ? 6 : 0) : 7,
            endTime: trimsEnd ? 7 : 8,
            inPoint: trimsEnd && !tailOnly ? 4 : heldFrame,
            outPoint: trimsEnd && !tailOnly ? 12 : heldFrame,
          })
          expect(at(trimsEnd ? 6.5 : 7.5)).toBe(heldFrame)
          expect(timeline.getState().duration).toBe(trimsEnd ? 7 : 8)
          history.getState().undo()
          expect(clips().find((clip) => clip.id === id)!.endTime).toBe(8)
          expect(at(7.5)).toBe(heldFrame)
          history.getState().redo()
          expect(clips().find((clip) => clip.id === id)).toEqual(kept)
        },
      )
    },
  )

  it.each(['duplicate', 'paste', 'playhead'] as const)(
    '複製経路 %s は属性・相対時刻のキーフレームを保持しUndo/Redoできる',
    (operation) => {
      seed({ speed: 2, reverse: true, endTime: 14 })
      keyframes.getState().addKeyframeToClip('clip', 'opacity', 1, 0.25, 'bezier')
      const originalKeyframes = structuredClone(keyframes.getState().clipKeyframes.get('clip'))
      history.getState().pushState()
      timeline.getState().copyClip('clip')
      const copy =
        operation === 'duplicate'
          ? timeline.getState().duplicateClip('clip')!
          : operation === 'paste'
            ? timeline.getState().pasteClip('track-b', 20)!
            : timeline.getState().pasteAtPlayhead()!
      expect(copy).toMatchObject({
        speed: 2,
        reverse: true,
        label: '比較用',
        inPoint: 4,
        outPoint: 12,
      })
      expect(calculateMediaTime(copy.startTime + 1, copy)).toBe(10)
      expect(keyframes.getState().clipKeyframes.get(copy.id)).toMatchObject({
        clipId: copy.id,
        tracks: [{ property: 'opacity', keyframes: [{ time: 1, value: 0.25, easing: 'bezier' }] }],
      })
      expect(keyframes.getState().clipKeyframes.get(copy.id)!.tracks[0].keyframes[0].id).not.toBe(
        originalKeyframes!.tracks[0].keyframes[0].id,
      )
      history.getState().undo()
      expect(clips()).toHaveLength(1)
      expect(keyframes.getState().clipKeyframes.has(copy.id)).toBe(false)
      history.getState().redo()
      expect(clips().find((clip) => clip.id === copy.id)).toEqual(copy)
      expect(keyframes.getState().clipKeyframes.get('clip')).toEqual(originalKeyframes)
      expect(keyframes.getState().clipKeyframes.has(copy.id)).toBe(true)
      expectReferences()
    },
  )

  it.each([false, true])(
    'トリムの左右とリップルを既知フレームで確認する（リップル %s）',
    (rippleEnabled) => {
      seed({ speed: 2, reverse: true, endTime: 14 })
      timeline.getState().addClip('track-a', 'source', 14, 2)
      timeline.setState({ rippleEnabled })
      timeline.getState().trimClip('clip', 'start', 11)
      expect(clips()[0]).toMatchObject({ startTime: 11, inPoint: 4, outPoint: 10 })
      expect(at(11)).toBe(10)
      timeline.getState().trimClip('clip', 'end', 13)
      expect(clips()[0]).toMatchObject({ endTime: 13, inPoint: 6, outPoint: 10 })
      expect(at(12)).toBe(8)
      expect(clips()[1].startTime).toBe(rippleEnabled ? 13 : 14)
      expect(timeline.getState().duration).toBe(rippleEnabled ? 15 : 16)
    },
  )

  it.each([false, true])(
    '左右保持で逆再生の切り出しと後続移動を保つ（リップル %s）',
    (rippleEnabled) => {
      seed({ speed: 2, reverse: true, endTime: 14 })
      timeline.getState().addClip('track-a', 'source', 14, 2)
      timeline.setState({ rippleEnabled })
      history.getState().pushState()
      timeline.getState().splitAndKeepRight('clip', 12)
      expect(clips()[0]).toMatchObject({
        startTime: rippleEnabled ? 10 : 12,
        endTime: rippleEnabled ? 12 : 14,
        inPoint: 4,
        outPoint: 8,
      })
      expect(calculateMediaTime(clips()[0].startTime, clips()[0])).toBe(8)
      expect(clips()[1].startTime).toBe(rippleEnabled ? 12 : 14)
      history.getState().undo()
      timeline.getState().splitAndKeepLeft('clip', 12)
      expect(clips()[0]).toMatchObject({ startTime: 10, endTime: 12, inPoint: 8, outPoint: 12 })
      expect(at(11)).toBe(10)
      expect(clips()[1].startTime).toBe(rippleEnabled ? 12 : 14)
    },
  )

  it('素材端を越えるトリムを制限し、リップルは実際の変更量だけ動く', () => {
    seed({ speed: 2, endTime: 14 })
    media.setState({ files: [source('source', 14)] })
    timeline.getState().addClip('track-a', 'source', 14, 2)
    timeline.setState({ rippleEnabled: true })
    timeline.getState().trimClip('clip', 'end', 80)
    expect(clips()[0]).toMatchObject({ endTime: 15, outPoint: 14 })
    expect(clips()[1]).toMatchObject({ startTime: 15, endTime: 17 })
    timeline.getState().trimClip('clip', 'start', 0)
    expect(clips()[0]).toMatchObject({ startTime: 8, inPoint: 0 })
  })

  it('速度変更と素材差替えでトリム開始・方向を保ち時間範囲を更新する', () => {
    seed({ reverse: true })
    timeline.getState().updateClip('clip', { speed: 2 })
    expect(clips()[0]).toMatchObject({ endTime: 14, speed: 2 })
    history.getState().pushState()
    timeline.getState().replaceClipMedia('clip', 'replacement', 10)
    expect(clips()[0]).toMatchObject({
      mediaId: 'replacement',
      inPoint: 4,
      outPoint: 10,
      startTime: 10,
      endTime: 13,
      speed: 2,
      reverse: true,
      label: '比較用',
    })
    expect(at(11)).toBe(8)
    expect(timeline.getState().duration).toBe(13)
    history.getState().undo()
    expect(clips()[0]).toMatchObject({ mediaId: 'source', endTime: 14 })
    history.getState().redo()
    expect(at(11)).toBe(8)
    const before = clips()
    timeline.getState().replaceClipMedia('clip', 'short', 3)
    expect(clips()).toEqual(before)
    expect(timeline.getState().editError).toContain('トリム開始位置より短い')
    expectReferences()
  })

  it('速度変更と差替えのリップルは後続クリップの長さと素材時刻を保つ', () => {
    seed()
    const next = timeline.getState().addClip('track-a', 'source', 18, 2)
    timeline.setState({ rippleEnabled: true })
    timeline.getState().updateClip('clip', { speed: 2 })
    expect(clips().find((clip) => clip.id === next.id)).toMatchObject({
      startTime: 14,
      endTime: 16,
      inPoint: 0,
      outPoint: 2,
    })
    timeline.getState().replaceClipMedia('clip', 'replacement', 10)
    expect(clips().find((clip) => clip.id === next.id)).toMatchObject({
      startTime: 13,
      endTime: 15,
      inPoint: 0,
      outPoint: 2,
    })
    expect(timeline.getState().duration).toBe(15)
  })

  it('拒否された差替えと範囲外分割は既存のRedo履歴を消さない', () => {
    seed()
    history.getState().runWithHistory(() => timeline.getState().duplicateClip('clip'))
    history.getState().undo()
    const before = history.getState()
    expect(
      history
        .getState()
        .runWithHistory(() => timeline.getState().replaceClipMedia('clip', 'short', 3)),
    ).toBe(false)
    expect(history.getState().runWithHistory(() => timeline.getState().splitClip('clip', 30))).toBe(
      false,
    )
    expect(history.getState().past).toEqual(before.past)
    expect(history.getState().future).toEqual(before.future)
    history.getState().redo()
    expect(clips()).toHaveLength(2)
  })

  it('貼付先の連続した重なりを解消し、存在しないトラックへの移動で素材を失わない', () => {
    seed({ startTime: 0, endTime: 4 })
    timeline.getState().addClip('track-a', 'source', 4, 2)
    timeline.getState().addClip('track-a', 'source', 6, 2)
    timeline.getState().copyClip('clip')
    const copy = timeline.getState().pasteAtPlayhead()!
    expect(copy).toMatchObject({ startTime: 8, endTime: 12 })
    const before = clips()
    timeline.getState().moveClip('clip', 'missing', 0)
    expect(clips()).toEqual(before)
    expect(timeline.getState().pasteClip('missing', 0)).toBeNull()
  })
})

describe('編集完了時の時間範囲と参照', () => {
  it.each(['remove', 'media', 'track'] as const)(
    '%s 削除で75秒の古い範囲・選択・コピー元を残さない',
    (operation) => {
      const track = timeline.getState().addTrack('media')
      const clip = timeline.getState().addClip(track.id, 'source', 0, 75)
      timeline.getState().selectClips([clip.id])
      timeline.getState().copyClip(clip.id)
      playback.getState().seek(60)
      if (operation === 'remove') timeline.getState().removeClip(clip.id)
      if (operation === 'media') timeline.getState().removeClipsByMediaId('source')
      if (operation === 'track') timeline.getState().removeTrack(track.id)
      expect(clips()).toEqual([])
      expect(timeline.getState()).toMatchObject({
        duration: 1,
        selectedClipId: null,
        selectedClipIds: [],
        clipboardClipId: null,
      })
      expect(playback.getState().currentTime).toBeLessThan(1)
      expectReferences()
    },
  )

  it('複数削除、Undo/Redoで選択・キーフレーム・時間範囲が有効', () => {
    seed({ startTime: 0, endTime: 4 })
    const second = timeline.getState().addClip('track-a', 'source', 4, 2)
    timeline.getState().addClip('track-a', 'replacement', 6, 2)
    timeline.setState({ rippleEnabled: true })
    timeline.getState().selectClips(['clip', second.id])
    keyframes.getState().addKeyframeToClip('clip', 'opacity', 1, 0.5)
    history.getState().pushState()
    timeline.getState().removeClip('clip')
    timeline.getState().removeClip(second.id)
    expect(clips()[0]).toMatchObject({ startTime: 0, endTime: 2 })
    expect(keyframes.getState().clipKeyframes.size).toBe(0)
    expectReferences()
    history.getState().undo()
    expect(clips()).toHaveLength(3)
    expect(timeline.getState().duration).toBe(8)
    expect(keyframes.getState().clipKeyframes.has('clip')).toBe(true)
    history.getState().redo()
    expect(timeline.getState().duration).toBe(2)
    expectReferences()
  })

  it('削除済み素材をUndoで復活させず参照切れを作らない', () => {
    seed()
    history.getState().pushState()
    timeline.getState().updateClip('clip', { label: '変更' })
    media.getState().removeFile('source')
    history.getState().undo()
    expect(clips()).toEqual([])
    expect(timeline.getState().duration).toBe(1)
    history.getState().redo()
    expectReferences()
  })

  it('短尺クリップの時間変更・移動・音声分離でも範囲と速度を保つ', () => {
    seed({ startTime: 0, endTime: 0.5, inPoint: 4, outPoint: 5, speed: 2, reverse: true })
    timeline.getState().updateClip('clip', { endTime: 0.25 })
    expect(timeline.getState().duration).toBe(0.25)
    const audioId = timeline.getState().separateAudio('clip')!
    expect(clips().find((clip) => clip.id === audioId)).toMatchObject({ speed: 2, reverse: true })
    timeline.getState().moveClip('clip', 'track-b', 1)
    expect(timeline.getState().duration).toBe(1.25)
    expectReferences()
  })
})

describe('キーフレーム付きクリップの受理済み暫定制限', () => {
  it.each(['split', 'trim-start', 'keep-right'] as const)(
    '%s はデータ・選択・履歴を保持し理由を示す',
    (operation) => {
      seed()
      keyframes.getState().addKeyframeToClip('clip', 'opacity', 1, 0.25, 'bezier')
      const before = structuredClone(keyframes.getState().clipKeyframes)
      timeline.getState().selectClips(['clip'])
      timeline.getState().copyClip('clip')
      history.getState().runWithHistory(() => timeline.getState().duplicateClip('clip'))
      history.getState().undo()
      const tracks = timeline.getState().tracks
      const past = history.getState().past
      const future = history.getState().future
      const changed = history.getState().runWithHistory(() => {
        if (operation === 'split') timeline.getState().splitClip('clip', 12)
        if (operation === 'trim-start') timeline.getState().trimClip('clip', 'start', 12)
        if (operation === 'keep-right') timeline.getState().splitAndKeepRight('clip', 12)
      })
      expect(changed).toBe(false)
      expect(timeline.getState().tracks).toBe(tracks)
      expect(timeline.getState()).toMatchObject({
        selectedClipId: 'clip',
        selectedClipIds: ['clip'],
        clipboardClipId: 'clip',
      })
      expect(keyframes.getState().clipKeyframes).toEqual(before)
      expect(history.getState().past).toBe(past)
      expect(history.getState().future).toBe(future)
      expect(timeline.getState().editError).toContain('時刻変換の仕様が未定義')
    },
  )

  it('左側保持・末尾トリム・移動・速度・素材差替えで元の相対キーフレームを失わない', () => {
    seed()
    keyframes.getState().addKeyframeToClip('clip', 'opacity', 7, 0.25, 'ease-out')
    const before = structuredClone(keyframes.getState().clipKeyframes)
    timeline.getState().splitAndKeepLeft('clip', 14)
    timeline.getState().trimClip('clip', 'end', 13)
    timeline.getState().moveClip('clip', 'track-b', 20)
    timeline.getState().updateClip('clip', { speed: 2, reverse: true, label: '編集済み' })
    timeline.getState().replaceClipMedia('clip', 'replacement', 10)
    expect(keyframes.getState().clipKeyframes).toEqual(before)
    expect(timeline.getState().editError).toBeNull()
    expectReferences()
  })
})
