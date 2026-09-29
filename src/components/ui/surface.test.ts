import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  clampSurfaceLevel,
  ElevatedSurface,
  resolveSurfaceLevel,
  SurfaceProvider,
  SURFACE_MAX_LEVEL,
  SURFACE_MIN_LEVEL,
} from './surface'

describe('surface levels', () => {
  it('clamps levels to the supported ladder', () => {
    expect(clampSurfaceLevel(0)).toBe(SURFACE_MIN_LEVEL)
    expect(clampSurfaceLevel(SURFACE_MAX_LEVEL + 1)).toBe(SURFACE_MAX_LEVEL)
  })

  it('resolves elevation relative to the current substrate', () => {
    expect(resolveSurfaceLevel(1, 1)).toBe(2)
    expect(resolveSurfaceLevel(2, 2)).toBe(4)
    expect(resolveSurfaceLevel(SURFACE_MAX_LEVEL, 1)).toBe(SURFACE_MAX_LEVEL)
  })

  it('preserves child background classes for asChild surfaces', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        SurfaceProvider,
        { value: SURFACE_MIN_LEVEL } as React.ComponentProps<typeof SurfaceProvider>,
        React.createElement(
          ElevatedSurface,
          { asChild: true, offset: 1 },
          React.createElement('div', { className: 'bg-accent/10 text-accent' }, 'Current'),
        ),
      ),
    )

    expect(html).toContain('bg-accent/10')
    expect(html).not.toContain('bg-surface-2')
  })
})
