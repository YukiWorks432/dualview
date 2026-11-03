import { useState, useRef, useEffect } from 'react'
import type { RefObject, PointerEvent as ReactPointerEvent } from 'react'

import { useTimelineStore } from '../stores/timelineStore'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'

export function useMarqueeSelect({
  containerRef,
}: {
  containerRef: RefObject<HTMLElement | null>
}) {
  const [box, setBox] = useState<{
    startX: number
    startY: number
    currentX: number
    currentY: number
  } | null>(null)
  const active = useRef<{
    x: number
    y: number
    ids: string[]
    add: boolean
    pointerId: number
  } | null>(null)
  const cancel = () => {
    active.current = null
    setBox(null)
  }
  useKeyboardShortcuts('interaction', (e) => {
    if (e.key === 'Escape' && active.current) {
      e.preventDefault()
      cancel()
    }
  })
  useEffect(() => {
    const update = (e: PointerEvent) => {
      const a = active.current,
        el = containerRef.current
      if (!a || !el || e.pointerId !== a.pointerId) return
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left + el.scrollLeft,
        y = e.clientY - rect.top + el.scrollTop
      setBox({ startX: a.x, startY: a.y, currentX: x, currentY: y })
    }
    const finish = (e: PointerEvent) => {
      const a = active.current,
        el = containerRef.current
      if (!a || !el || e.pointerId !== a.pointerId) return
      const rect = el.getBoundingClientRect(),
        x = e.clientX - rect.left + el.scrollLeft,
        y = e.clientY - rect.top + el.scrollTop
      const ids: string[] = []
      const state = useTimelineStore.getState()
      for (const node of el.querySelectorAll<HTMLElement>('[data-clip-id]')) {
        const r = node.getBoundingClientRect(),
          id = node.dataset.clipId!
        if (state.tracks.some((t) => t.locked && t.clips.some((c) => c.id === id))) continue
        if (
          r.right > rect.left + Math.min(a.x, x) - el.scrollLeft &&
          r.left < rect.left + Math.max(a.x, x) - el.scrollLeft &&
          r.bottom > rect.top + Math.min(a.y, y) - el.scrollTop &&
          r.top < rect.top + Math.max(a.y, y) - el.scrollTop
        )
          ids.push(id)
      }
      state.selectClips(a.add ? [...new Set([...a.ids, ...ids])] : ids)
      cancel()
    }
    document.addEventListener('pointermove', update)
    document.addEventListener('pointerup', finish)
    document.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    return () => {
      document.removeEventListener('pointermove', update)
      document.removeEventListener('pointerup', finish)
      document.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
    }
  }, [containerRef])
  return {
    isSelecting: Boolean(box),
    getSelectionBoxStyle: () =>
      box
        ? {
            left: Math.min(box.startX, box.currentX),
            top: Math.min(box.startY, box.currentY),
            width: Math.abs(box.currentX - box.startX),
            height: Math.abs(box.currentY - box.startY),
          }
        : null,
    handleMouseDown: (e: ReactPointerEvent) => {
      if (
        e.button !== 0 ||
        (e.target as Element).closest(
          '[data-clip],[data-marquee-ignore],[data-time-ruler],[data-playhead-head]',
        )
      )
        return
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect(),
        x = e.clientX - rect.left + el.scrollLeft,
        y = e.clientY - rect.top + el.scrollTop
      active.current = {
        x,
        y,
        ids: [...useTimelineStore.getState().selectedClipIds],
        add: e.shiftKey,
        pointerId: e.pointerId,
      }
      setBox({ startX: x, startY: y, currentX: x, currentY: y })
    },
  }
}
