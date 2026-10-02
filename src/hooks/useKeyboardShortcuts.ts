import { useEffect, useLayoutEffect, useRef } from 'react'

import { createShortcutDispatcher, type ShortcutScope } from '../lib/keyboardShortcuts'
import { useProjectStore } from '../stores/projectStore'

const registerShortcut = createShortcutDispatcher(() => useProjectStore.getState().comparisonMode)

export function useKeyboardShortcuts(
  scope: ShortcutScope,
  handler: (event: KeyboardEvent) => void,
) {
  const currentHandler = useRef(handler)
  useLayoutEffect(() => {
    currentHandler.current = handler
  })
  useEffect(() => registerShortcut(scope, (event) => currentHandler.current(event)), [scope])
}
