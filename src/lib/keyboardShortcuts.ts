import { getComparisonModeDefinition } from '../config/comparisonModes'
import type { ComparisonMode } from '../types'

export type ShortcutScope = ComparisonMode | 'app' | 'timeline' | 'media' | 'help' | 'interaction'
type ShortcutHandler = (event: KeyboardEvent) => void

// 入力先の処理が終わってから、現在の画面が所有する操作を一つだけ実行する。
export function createShortcutDispatcher(getMode: () => ComparisonMode) {
  const handlers = new Map<ShortcutScope, Set<ShortcutHandler>>()
  const blockedEvents = new WeakSet<KeyboardEvent>()
  const editingEvents = new WeakSet<KeyboardEvent>()
  let composing = false

  const onCompositionStart = () => {
    composing = true
  }
  const onCompositionEnd = () => {
    composing = false
  }
  const capture = (event: KeyboardEvent) => {
    const editing = event
      .composedPath()
      .some(
        (target) =>
          target instanceof HTMLElement &&
          (target.matches('input, textarea, select') ||
            target.isContentEditable ||
            target.closest(
              '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]',
            )),
      )
    const modal = document.querySelector(
      '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"], dialog[open]',
    )
    const control =
      event.target instanceof Element && event.target.closest('[role="slider"], [role="combobox"]')
    if (modal || composing || event.isComposing || event.keyCode === 229) {
      // Escapeでダイアログが消えた後も、その同じキーを全体操作へ渡さない。
      blockedEvents.add(event)
    }
    if (
      editing ||
      (control &&
        [
          'Space',
          'Enter',
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          'Home',
          'End',
        ].includes(event.code))
    ) {
      editingEvents.add(event)
    }
  }
  const dispatch = (event: KeyboardEvent) => {
    if (blockedEvents.has(event) || event.defaultPrevented) return
    // 入力欄に焦点が残っていても、開始済みのドラッグやメニューを先に取り消す。
    if (event.key === 'Escape') {
      for (const handler of handlers.get('interaction') ?? []) {
        handler(event)
        if (event.defaultPrevented) return
      }
    }
    if (editingEvents.has(event)) return
    const definition = getComparisonModeDefinition(getMode())
    const localShortcut =
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      definition.localShortcuts?.some(
        (shortcut) => shortcut.code === event.code && Boolean(shortcut.shift) === event.shiftKey,
      )
    if (localShortcut) {
      for (const handler of handlers.get(definition.mode) ?? []) {
        handler(event)
        if (event.defaultPrevented) return
      }
      // 遅延読込中でも、このモードのキーを下位の編集操作へ流さない。
      event.preventDefault()
      return
    }
    for (const scope of ['timeline', 'media', 'help', 'app'] as const) {
      for (const handler of handlers.get(scope) ?? []) {
        handler(event)
        if (event.defaultPrevented) return
      }
    }
  }

  return (scope: ShortcutScope, handler: ShortcutHandler) => {
    if (handlers.size === 0) {
      window.addEventListener('keydown', capture, true)
      window.addEventListener('keydown', dispatch)
      window.addEventListener('compositionstart', onCompositionStart, true)
      window.addEventListener('compositionend', onCompositionEnd, true)
    }
    const subscribers = handlers.get(scope) ?? new Set<ShortcutHandler>()
    subscribers.add(handler)
    handlers.set(scope, subscribers)
    return () => {
      subscribers.delete(handler)
      if (subscribers.size === 0) handlers.delete(scope)
      if (handlers.size === 0) {
        window.removeEventListener('keydown', capture, true)
        window.removeEventListener('keydown', dispatch)
        window.removeEventListener('compositionstart', onCompositionStart, true)
        window.removeEventListener('compositionend', onCompositionEnd, true)
        composing = false
      }
    }
  }
}

export function isPlainShortcut(event: KeyboardEvent) {
  return !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
}
