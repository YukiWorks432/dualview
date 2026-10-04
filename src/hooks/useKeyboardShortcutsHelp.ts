import { useState } from 'react'

import { useKeyboardShortcuts } from './useKeyboardShortcuts'

export function useKeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false)

  useKeyboardShortcuts('help', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key === '?' || (event.shiftKey && event.key === '/')) {
      event.preventDefault()
      setIsOpen(true)
    }
  })

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((open) => !open),
  }
}
