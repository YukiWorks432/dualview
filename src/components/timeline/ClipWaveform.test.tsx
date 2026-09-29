import { afterEach, describe, expect, it, vi } from 'vitest'

import { drawWaveform } from '../../lib/timeline/waveform'

describe('ClipWaveform', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves CSS token colors before drawing bars to the canvas', () => {
    const context = {
      beginPath: vi.fn<CanvasRenderingContext2D['beginPath']>(),
      clearRect: vi.fn<CanvasRenderingContext2D['clearRect']>(),
      fillRect: vi.fn<CanvasRenderingContext2D['fillRect']>(),
      fillStyle: '',
      lineTo: vi.fn<CanvasRenderingContext2D['lineTo']>(),
      lineWidth: 0,
      moveTo: vi.fn<CanvasRenderingContext2D['moveTo']>(),
      scale: vi.fn<CanvasRenderingContext2D['scale']>(),
      stroke: vi.fn<CanvasRenderingContext2D['stroke']>(),
      strokeStyle: '',
    } as unknown as CanvasRenderingContext2D
    const canvas = {
      getBoundingClientRect: vi.fn<() => DOMRect>(
        () => ({ height: 20, width: 100 }) as DOMRect,
      ),
      getContext: vi.fn<(contextId: '2d') => CanvasRenderingContext2D>(() => context),
    } as unknown as HTMLCanvasElement

    vi.stubGlobal('window', {
      devicePixelRatio: 1,
      getComputedStyle: vi.fn<(element: Element) => CSSStyleDeclaration>(
        () => ({ color: 'rgba(201, 76, 39, 0.8)' }) as CSSStyleDeclaration,
      ),
    })

    drawWaveform(canvas, [0.5], 'hsl(var(--compare-a) / 0.8)')

    expect(context.fillStyle).toBe('rgba(201, 76, 39, 0.8)')
    expect(context.fillStyle).not.toContain('var(')
    expect(context.fillRect).toHaveBeenCalled()
  })
})
