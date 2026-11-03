import { useState, useRef, useCallback, useEffect } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

import { snapTimeToFrame } from '../lib/utils'
import { useHistoryStore } from '../stores/historyStore'
import { useTimelineStore } from '../stores/timelineStore'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'

interface Gesture {
  clipId: string
  ids: string[]
  startX: number
  startY: number
  scroll: number
  container: HTMLElement
  pointerId: number
  element: HTMLElement
  originalStartTime: number
  originalTrackId: string
  currentTime: number
  currentTrackId: string
  isDragging: boolean
  snapPoint: number | null
  side?: 'start' | 'end'
}
export interface TrimState {
  clipId: string
  side: 'start' | 'end'
  currentTime: number
  isTrimming: boolean
}
// 編集途中では保存対象を変えず、解放時だけ履歴付きで確定する。
function useClipGesture(pixelsPerSecond: number, trim: boolean) {
  const [gesture, setGesture] = useState<Gesture | null>(null)
  const current = useRef<Gesture | null>(null)
  const suppressedClick = useRef(false)
  const lastEvent = useRef<PointerEvent | null>(null)
  const cancel = useCallback(() => {
    const g = current.current
    current.current = null
    setGesture(null)
    if (g?.element.hasPointerCapture(g.pointerId)) g.element.releasePointerCapture(g.pointerId)
  }, [])
  useKeyboardShortcuts('interaction', (e) => {
    if (e.key === 'Escape' && current.current) {
      e.preventDefault()
      suppressedClick.current = true
      cancel()
    }
  })
  const start = (
    e: ReactPointerEvent,
    clipId: string,
    trackId: string,
    time: number,
    side?: 'start' | 'end',
  ) => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || (e.target as Element).closest('button')) return
    const state = useTimelineStore.getState()
    if (e.shiftKey && !state.selectedClipIds.includes(clipId)) return
    if (state.tracks.find((t) => t.id === trackId)?.locked) return
    e.preventDefault()
    e.stopPropagation()
    const container = e.currentTarget.closest<HTMLElement>('[data-timeline-scroll]')!
    const ids =
      !trim && state.selectedClipIds.includes(clipId) ? [...state.selectedClipIds] : [clipId]
    if (!ids.includes(state.selectedClipId ?? '')) state.selectClips(ids)
    const g: Gesture = {
      clipId,
      ids,
      startX: e.clientX,
      startY: e.clientY,
      scroll: container.scrollLeft,
      container,
      element: e.currentTarget as HTMLElement,
      pointerId: e.pointerId,
      originalStartTime: time,
      originalTrackId: trackId,
      currentTime: time,
      currentTrackId: trackId,
      isDragging: false,
      snapPoint: null,
      side,
    }
    current.current = g
    suppressedClick.current = false
    setGesture({ ...g })
    g.element.setPointerCapture(e.pointerId)
  }
  useEffect(() => {
    if (!gesture) return
    const g = current.current!
    const update = (e: PointerEvent) => {
      if (!current.current || e.pointerId !== g.pointerId) return
      lastEvent.current = e
      const dx = e.clientX - g.startX + g.container.scrollLeft - g.scroll
      if (!g.isDragging && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) <= 5) return
      g.isDragging = true
      suppressedClick.current = true
      const state = useTimelineStore.getState()
      let time = snapTimeToFrame(g.originalStartTime + dx / pixelsPerSecond, state.frameRate)
      g.snapPoint = null
      if (e.shiftKey) {
        const clip = state.tracks.flatMap((t) => t.clips).find((c) => c.id === g.clipId)!
        const duration = trim ? 0 : clip.endTime - clip.startTime
        const a = state.getSnapPoint(time, g.ids)
        const b = duration ? state.getSnapPoint(time + duration, g.ids) : null
        if (a !== null && (b === null || Math.abs(a - time) <= Math.abs(b - time - duration))) {
          time = a
          g.snapPoint = a
        } else if (b !== null) {
          time = b - duration
          g.snapPoint = b
        }
      }
      if (!trim) {
        const clips = state.tracks.flatMap((t) => t.clips).filter((c) => g.ids.includes(c.id))
        const earliest = Math.min(...clips.map((c) => c.startTime))
        time = Math.max(g.originalStartTime - earliest, time)
        if (g.ids.length === 1) {
          const rows = [...g.container.querySelectorAll<HTMLElement>('[data-track-id]')]
          const row = rows.find((r) => {
            const rect = r.getBoundingClientRect()
            return e.clientY >= rect.top && e.clientY < rect.bottom
          })
          g.currentTrackId = row?.dataset.trackId ?? g.originalTrackId
        }
      } else time = Math.max(0, time)
      g.currentTime = time
      setGesture({ ...g })
    }
    const scroll = () => {
      if (lastEvent.current) update(lastEvent.current)
    }
    const finish = (e: PointerEvent) => {
      if (!current.current || e.pointerId !== g.pointerId) return
      update(e)
      if (g.isDragging)
        useHistoryStore.getState().runWithHistory(() => {
          const state = useTimelineStore.getState()
          if (trim) state.trimClip(g.clipId, g.side!, g.currentTime)
          else if (g.ids.length > 1) state.moveClips(g.ids, g.currentTime - g.originalStartTime)
          else state.moveClip(g.clipId, g.currentTrackId, g.currentTime)
        })
      cancel()
    }
    document.addEventListener('pointermove', update)
    document.addEventListener('pointerup', finish)
    document.addEventListener('pointercancel', cancel)
    g.element.addEventListener('lostpointercapture', cancel)
    g.container.addEventListener('scroll', scroll)
    window.addEventListener('blur', cancel)
    return () => {
      document.removeEventListener('pointermove', update)
      document.removeEventListener('pointerup', finish)
      document.removeEventListener('pointercancel', cancel)
      g.element.removeEventListener('lostpointercapture', cancel)
      g.container.removeEventListener('scroll', scroll)
      window.removeEventListener('blur', cancel)
    }
  }, [gesture, pixelsPerSecond, trim, cancel])
  const consumeClick = () => {
    const value = suppressedClick.current
    suppressedClick.current = false
    return value
  }
  return { gesture, start, consumeClick }
}
export function useTimelineDrag({
  pixelsPerSecond,
}: {
  pixelsPerSecond: number
  trackHeight?: number
}) {
  const { gesture: g, start, consumeClick } = useClipGesture(pixelsPerSecond, false)
  return {
    handleMouseDown: start,
    consumeClick,
    getClipPosition: (id: string, time: number) =>
      g?.isDragging && g.ids.includes(id) ? time + g.currentTime - g.originalStartTime : time,
    isClipDragging: (id: string) => Boolean(g?.isDragging && g.ids.includes(id)),
    isClipSnapped: (id: string) =>
      Boolean(g?.isDragging && g.ids.includes(id) && g.snapPoint !== null),
    getSnapIndicator: () => g?.snapPoint ?? null,
    isDragging: Boolean(g?.isDragging),
  }
}
export function useTimelineTrim({ pixelsPerSecond }: { pixelsPerSecond: number }) {
  const { gesture: g, start } = useClipGesture(pixelsPerSecond, true)
  const preview = g?.isDragging
    ? useTimelineStore.getState().previewTrimClip(g.clipId, g.side!, g.currentTime)
    : undefined
  return {
    trimState: g
      ? { clipId: g.clipId, side: g.side!, currentTime: g.currentTime, isTrimming: g.isDragging }
      : null,
    preview,
    handleTrimStart: (e: ReactPointerEvent, id: string, side: 'start' | 'end', time: number) => {
      const track = useTimelineStore.getState().tracks.find((t) => t.clips.some((c) => c.id === id))
      if (track) start(e, id, track.id, time, side)
    },
    isTrimming: Boolean(g?.isDragging),
    getTrimSnapIndicator: () => g?.snapPoint ?? null,
  }
}
