import { useHistoryStore } from '../stores/historyStore'
import { useKeyframeStore } from '../stores/keyframeStore'
import { usePlaybackStore } from '../stores/playbackStore'
import { useTimelineStore } from '../stores/timelineStore'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'

export function useTimelineKeys() {
  useKeyboardShortcuts('timeline', (e) => {
    if (!(e.target instanceof Element) || !e.target.closest('[data-timeline-panel]')) return
    if (['Enter', 'Tab'].includes(e.key)) return
    if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) return
    const state = useTimelineStore.getState(),
      playback = usePlaybackStore.getState()
    const { currentTime } = playback
    const { tracks, duration, frameRate, markers, loopRegion } = state
    const clips = tracks.flatMap((t) => t.clips),
      ids = state.selectedClipIds
    const selected = clips.filter((c) => ids.includes(c.id))
    const mod = e.ctrlKey || e.metaKey,
      dt = 1 / frameRate
    const history = useHistoryStore.getState()
    if (
      e.code === 'Space' ||
      (['KeyH', 'KeyV', 'KeyD'].includes(e.code) && !mod && !e.altKey) ||
      (['=', '-', ';', ':'].includes(e.key) && !mod)
    )
      return
    if (e.key === 'Escape') {
      e.preventDefault()
      state.clearLoop()
      return
    }
    if (
      e.code === 'PageUp' ||
      e.code === 'PageDown' ||
      (mod && ['ArrowLeft', 'ArrowRight'].includes(e.code))
    ) {
      e.preventDefault()
      playback.pause()
      playback.seek(
        currentTime +
          (['PageUp', 'ArrowLeft'].includes(e.code) ? -1 : 1) * (e.shiftKey ? 10 : 1) * dt,
      )
      return
    }
    if (
      !mod &&
      !e.altKey &&
      ['Home', 'End', 'KeyI', 'KeyO', 'KeyB', 'KeyN', 'KeyJ', 'KeyK', 'F2'].includes(e.code)
    ) {
      e.preventDefault()
      if (e.code === 'Home') playback.seek(0)
      if (e.code === 'End') playback.seek(Math.max(0, duration - dt))
      if (e.code === 'KeyI' && selected.length)
        playback.seek(Math.min(...selected.map((c) => c.startTime)))
      if (e.code === 'KeyO' && selected.length)
        playback.seek(Math.max(...selected.map((c) => c.endTime)) - dt)
      if (e.code === 'F2') state.clearSelection()
      if (e.code === 'KeyB')
        useTimelineStore.setState({
          loopRegion: {
            inPoint: currentTime,
            outPoint: Math.max(currentTime + dt, loopRegion?.outPoint ?? duration),
          },
        })
      if (e.code === 'KeyN')
        useTimelineStore.setState({
          loopRegion: {
            inPoint: Math.min(loopRegion?.inPoint ?? 0, currentTime),
            outPoint: currentTime + dt,
          },
        })
      if (e.code === 'KeyJ' || e.code === 'KeyK') {
        const times = [
          ...markers.map((m) => m.time),
          ...(loopRegion ? [loopRegion.inPoint, loopRegion.outPoint - dt] : []),
        ].sort((a, b) => a - b)
        const time =
          e.code === 'KeyJ'
            ? times.filter((t) => t < currentTime - dt / 2).at(-1)
            : times.find((t) => t > currentTime + dt / 2)
        if (time !== undefined) playback.seek(time)
      }
      return
    }
    if (['[', ']'].includes(e.key) && !mod) {
      e.preventDefault()
      const end = e.key === ']'
      if (
        !selected.length ||
        tracks.some((t) => t.locked && t.clips.some((c) => ids.includes(c.id)))
      )
        return
      if (e.altKey) {
        const time = currentTime + (end ? dt : 0)
        if (selected.some((c) => !state.previewTrimClip(c.id, end ? 'end' : 'start', time))) {
          useTimelineStore.setState({
            editError: 'キーフレームの時刻変換の仕様が未定義のため、この操作は実行できません。',
          })
          return
        }
        history.runWithHistory(() =>
          selected.forEach((c) => state.trimClip(c.id, end ? 'end' : 'start', time)),
        )
      } else
        history.runWithHistory(() =>
          selected.forEach((c) =>
            state.moveClip(c.id, c.trackId, currentTime - (end ? c.endTime - c.startTime - dt : 0)),
          ),
        )
      return
    }
    if (mod && e.shiftKey && e.code === 'KeyD') {
      e.preventDefault()
      const targets = (
        selected.length
          ? selected
          : clips.filter((c) => !tracks.find((t) => t.id === c.trackId)?.locked)
      ).filter((c) => currentTime > c.startTime && currentTime < c.endTime)
      if (
        targets.some(
          (c) =>
            tracks.find((t) => t.id === c.trackId)?.locked ||
            useKeyframeStore.getState().clipKeyframes.has(c.id),
        )
      ) {
        useTimelineStore.setState({
          editError:
            'ロックまたはキーフレームの時刻変換の仕様が未定義のため、この操作は実行できません。',
        })
        return
      }
      history.runWithHistory(() => targets.forEach((c) => state.splitClip(c.id, currentTime)))
      return
    }
    if (!mod && !['Delete', 'Backspace'].includes(e.key) && e.key !== '?') e.preventDefault()
  })
}
