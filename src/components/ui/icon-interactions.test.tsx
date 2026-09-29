import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Button } from './button'
import { ButtonWithIcon } from './button-with-icon'
import { IconButton } from './icon-button'

function getOpeningTag(markup: string, tagName: 'button' | 'span', slot: string) {
  const match = markup.match(new RegExp(`<${tagName}\\b(?=[^>]*data-slot="${slot}")[^>]*>`))

  expect(match).not.toBeNull()
  return match?.[0] ?? ''
}

describe('icon hover scale', () => {
  it('keeps an icon-only button fixed while placing hover scaling on its icon slot', () => {
    const markup = renderToStaticMarkup(
      <IconButton variant="secondary" aria-label="Undo">
        <svg data-slot="undo-icon" aria-hidden="true" />
      </IconButton>,
    )
    const button = getOpeningTag(markup, 'button', 'icon-button')
    const iconSlot = getOpeningTag(markup, 'span', 'icon-button-icon')

    expect(button).toContain('h-8 w-8')
    expect(button).not.toContain('scale-[1.25]')
    expect(iconSlot).toContain('group-hover/icon-button:scale-[1.25]')
    expect(iconSlot).toContain('transition-transform')
    expect(iconSlot).toContain('duration-150')
    expect(iconSlot).toContain('ease-out')
    expect(markup).toContain('<svg data-slot="undo-icon" aria-hidden="true"></svg>')
  })

  it('keeps a labeled button label outside the hover-scaled icon slot', () => {
    const markup = renderToStaticMarkup(
      <ButtonWithIcon aria-label="Export" icon={<svg data-slot="export-icon" aria-hidden="true" />}>
        Export
      </ButtonWithIcon>,
    )
    const button = markup.match(/<button\b[^>]*>/)?.[0] ?? ''
    const iconSlot = getOpeningTag(markup, 'span', 'button-with-icon-icon')

    expect(button).toContain('group/labeled-button')
    expect(button).not.toContain('scale-[1.25]')
    expect(iconSlot).toContain('group-hover/labeled-button:scale-[1.25]')
    expect(iconSlot).not.toContain('Export')
    expect(markup).toContain('>Export</button>')
  })

  it('keeps a marker count as a sibling of the direct icon', () => {
    const markup = renderToStaticMarkup(
      <Button aria-label="Add marker">
        <svg data-slot="marker-icon" aria-hidden="true" />
        <span data-slot="marker-count">3</span>
      </Button>,
    )

    expect(markup).toContain(
      '<svg data-slot="marker-icon" aria-hidden="true"></svg><span data-slot="marker-count">3</span>',
    )
  })
})
