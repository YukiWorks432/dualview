import { describe, expect, it } from 'vitest'

import {
  iconButtonGroupClasses,
  iconButtonIconHoverScaleClasses,
  iconHoverScaleBaseClasses,
  labeledButtonGroupClasses,
  labeledButtonIconHoverScaleClasses,
} from './icon-interactions'

describe('icon hover scale', () => {
  it('keeps the shared motion contract aligned with Adobe CEP', () => {
    expect(iconHoverScaleBaseClasses).toContain('transition-transform')
    expect(iconHoverScaleBaseClasses).toContain('duration-150')
    expect(iconHoverScaleBaseClasses).toContain('ease-out')
    expect(iconHoverScaleBaseClasses).toContain('will-change-transform')
  })

  it('scales only icon slots from their button hover regions', () => {
    expect(iconButtonGroupClasses).toBe('group/icon-button')
    expect(iconButtonIconHoverScaleClasses).toContain('group-hover/icon-button:scale-[1.25]')
    expect(labeledButtonGroupClasses).toBe('group/labeled-button')
    expect(labeledButtonIconHoverScaleClasses).toContain('group-hover/labeled-button:scale-[1.25]')
  })
})
