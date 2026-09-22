import { describe, expect, it } from 'vitest'

import { comparisonModeDefinitions, getComparisonModeByKeyboardCode } from './comparisonModes'

describe('comparison mode registry', () => {
  it('has unique mode ids and shortcuts', () => {
    const modeIds = comparisonModeDefinitions.map((definition) => definition.mode)
    const shortcutCodes = comparisonModeDefinitions.flatMap((definition) =>
      definition.shortcut ? [definition.shortcut.code] : [],
    )

    expect(new Set(modeIds).size).toBe(modeIds.length)
    expect(new Set(shortcutCodes).size).toBe(shortcutCodes.length)
  })

  it('maps primary number shortcuts from one source of truth', () => {
    expect(getComparisonModeByKeyboardCode('Digit1')).toBe('slider')
    expect(getComparisonModeByKeyboardCode('Digit3')).toBe('webgl-compare')
    expect(getComparisonModeByKeyboardCode('Digit8')).toBe('document')
  })

  it('does not steal timeline editing shortcuts', () => {
    expect(getComparisonModeByKeyboardCode('KeyQ')).toBeUndefined()
    expect(getComparisonModeByKeyboardCode('KeyR')).toBeUndefined()
    expect(getComparisonModeByKeyboardCode('KeyW')).toBeUndefined()
  })
})
