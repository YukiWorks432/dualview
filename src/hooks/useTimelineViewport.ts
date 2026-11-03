import { useEffect, useRef, useState, useCallback } from 'react'
import type { RefObject, PointerEvent as ReactPointerEvent } from 'react'

import { snapTimeToFrame } from '../lib/utils'
import { usePlaybackStore } from '../stores/playbackStore'
import { useTimelineStore } from '../stores/timelineStore'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'

export function useTimelineViewport(containerRef: RefObject<HTMLDivElement | null>) {
  const [view, setView] = useState({ left: 0, width: 1000, top: 0 })
  const [scrubbing, setScrubbing] = useState(false)
  const [hand, setHand] = useState(false)
  const space = useRef(false)
  const usedSpace = useRef(false)
  const suppressClick = useRef(false)
  const previous = useRef<{ zoom: number; left: number } | null>(null)
  const gesture = useRef<{
    kind: 'pan' | 'scrub'
    x: number
    y: number
    left: number
    top: number
    element: HTMLElement
    id: number
    latestX: number
    shift: boolean
  } | null>(null)
  const stop = useCallback(() => {
    const g = gesture.current
    gesture.current = null
    setScrubbing(false)
    if (g?.element.hasPointerCapture(g.id)) g.element.releasePointerCapture(g.id)
  }, [])
  const seekAt = useCallback(
    (clientX: number, shift: boolean) => {
      const el = containerRef.current
      if (!el) return
      const state = useTimelineStore.getState()
      let time = snapTimeToFrame(
        (clientX - el.getBoundingClientRect().left + el.scrollLeft) / (50 * state.zoom),
        state.frameRate,
      )
      if (shift) time = state.getSnapPoint(time, undefined, false) ?? time
      usePlaybackStore.getState().seek(time)
    },
    [containerRef],
  )
  const zoomTo = useCallback(
    (zoom: number, anchor?: number) => {
      const el = containerRef.current
      if (!el) return
      const state = useTimelineStore.getState()
      const currentTime = usePlaybackStore.getState().currentTime
      const currentX = currentTime * 50 * state.zoom - el.scrollLeft
      const x =
        anchor ?? (currentX < 0 || currentX > el.clientWidth ? el.clientWidth / 2 : currentX)
      const time = anchor === undefined ? currentTime : (el.scrollLeft + x) / (50 * state.zoom)
      const minimum = Math.min(0.1, el.clientWidth / Math.max(1, 50 * state.duration))
      state.setZoom(Math.max(minimum, zoom))
      // 横幅の更新後にも同じ内容時刻を保つ。
      const left = Math.max(0, time * 50 * useTimelineStore.getState().zoom - x)
      requestAnimationFrame(() => {
        el.scrollLeft = left
      })
    },
    [containerRef],
  )
  useKeyboardShortcuts('timeline', (e) => {
    if (!(e.target instanceof Element) || !e.target.closest('[data-timeline-panel]')) return
    if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      if (!e.repeat) {
        space.current = true
        usedSpace.current = false
      }
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const state = useTimelineStore.getState()
    const el = containerRef.current
    if (!el) return
    if (e.key === '=' || e.key === '-') {
      e.preventDefault()
      zoomTo(state.zoom * (e.key === '=' ? 1.2 : 1 / 1.2))
    } else if (e.key === ';' || e.key === ':') {
      e.preventDefault()
      const fit = el.clientWidth / Math.max(1, 50 * state.duration)
      if (e.shiftKey && previous.current) {
        const old = previous.current
        previous.current = null
        state.setZoom(old.zoom)
        requestAnimationFrame(() => {
          el.scrollLeft = old.left
        })
      } else {
        previous.current = { zoom: state.zoom, left: el.scrollLeft }
        zoomTo(
          e.shiftKey || Math.abs(state.zoom - (state.frameRate * 12) / 50) < 0.001
            ? fit
            : (state.frameRate * 12) / 50,
        )
      }
    } else if (e.code === 'KeyH' || e.code === 'KeyV') {
      e.preventDefault()
      setHand(e.code === 'KeyH')
    } else if (e.code === 'KeyD') {
      e.preventDefault()
      el.scrollLeft = Math.max(
        0,
        usePlaybackStore.getState().currentTime * 50 * state.zoom - el.clientWidth / 2,
      )
    }
  })
  useKeyboardShortcuts('interaction', (e) => {
    if (e.key === 'Escape' && gesture.current) {
      e.preventDefault()
      stop()
      space.current = false
    }
  })
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      setView({ left: el.scrollLeft, width: el.clientWidth, top: el.scrollTop })
      const g = gesture.current
      if (g?.kind === 'scrub') seekAt(g.latestX, g.shift)
    }
    const observer = new ResizeObserver(update)
    observer.observe(el)
    update()
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1
      if (e.altKey) {
        e.preventDefault()
        zoomTo(
          useTimelineStore.getState().zoom * Math.exp(-e.deltaY * unit * 0.002),
          e.clientX - el.getBoundingClientRect().left,
        )
      } else if (e.shiftKey) {
        e.preventDefault()
        el.scrollLeft += (e.deltaX || e.deltaY) * unit
      }
    }
    const release = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !space.current) return
      space.current = false
      if (
        !usedSpace.current &&
        e.target instanceof Element &&
        e.target.closest('[data-timeline-panel]') &&
        !e.target.closest('input,textarea,select,[contenteditable]')
      )
        usePlaybackStore.getState().togglePlay()
      stop()
    }
    const blur = () => {
      space.current = false
      stop()
    }
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('scroll', update)
    window.addEventListener('keyup', release)
    window.addEventListener('blur', blur)
    return () => {
      observer.disconnect()
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('scroll', update)
      window.removeEventListener('keyup', release)
      window.removeEventListener('blur', blur)
    }
  }, [containerRef, zoomTo, stop, seekAt])
  const pointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = containerRef.current
    if (!el) return
    const target = e.target as HTMLElement
    if (!target.closest('button,input,select,[role="slider"]'))
      e.currentTarget.focus({ preventScroll: true })
    suppressClick.current = false
    const pan = e.button === 1 || (e.button === 0 && (hand || space.current))
    const scrub =
      e.button === 0 &&
      !target.closest('button') &&
      Boolean(target.closest('[data-time-ruler],[data-playhead-head]'))
    if (!pan && !scrub) return
    e.preventDefault()
    e.stopPropagation()
    usedSpace.current = true
    suppressClick.current = pan
    gesture.current = {
      kind: pan ? 'pan' : 'scrub',
      x: e.clientX,
      y: e.clientY,
      left: el.scrollLeft,
      top: el.scrollTop,
      element: e.currentTarget,
      id: e.pointerId,
      latestX: e.clientX,
      shift: e.shiftKey,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    if (scrub) {
      setScrubbing(true)
      if (!e.altKey) usePlaybackStore.getState().pause()
      pointerMove(e)
    }
  }
  const pointerMove = (e: ReactPointerEvent) => {
    const g = gesture.current,
      el = containerRef.current
    if (!g || !el || g.id !== e.pointerId) return
    if (g.kind === 'pan') {
      el.scrollLeft = g.left + g.x - e.clientX
      el.scrollTop = g.top + g.y - e.clientY
    } else {
      g.latestX = e.clientX
      g.shift = e.shiftKey
      seekAt(e.clientX, e.shiftKey)
    }
  }
  return {
    view,
    scrubbing,
    hand,
    zoomTo,
    pointerDown,
    pointerMove,
    stop,
    clickCapture: (e: React.MouseEvent) => {
      if (suppressClick.current) {
        e.preventDefault()
        e.stopPropagation()
        suppressClick.current = false
      }
    },
  }
}
