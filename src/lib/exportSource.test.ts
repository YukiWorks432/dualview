import { describe, expect, it } from 'vitest'

import { isExportTrackSelected } from './exportSource'

describe('isExportTrackSelected', () => {
  it('uses both tracks for comparison export', () => {
    expect(isExportTrackSelected('comparison', 'a')).toBe(true)
    expect(isExportTrackSelected('comparison', 'b')).toBe(true)
  })

  it('does not let an unselected track block a single-track export', () => {
    expect(isExportTrackSelected('a-only', 'a')).toBe(true)
    expect(isExportTrackSelected('a-only', 'b')).toBe(false)
    expect(isExportTrackSelected('b-only', 'a')).toBe(false)
    expect(isExportTrackSelected('b-only', 'b')).toBe(true)
  })
})
