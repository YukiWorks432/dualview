import { useCallback, useState } from 'react'

export function useMagnifier() {
  const [isEnabled, setIsEnabled] = useState(false)

  const toggle = useCallback(() => setIsEnabled((prev) => !prev), [])

  return {
    isEnabled,
    toggle,
    setEnabled: setIsEnabled,
  }
}
