import { afterEach, describe, expect, it, vi } from 'vitest'

import { drawWaveform } from './ClipWaveform'

describe('ClipWaveform', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves CSS token colors before drawing bars to the canvas', () => {
    const context = {
      beginPath: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      lineTo: vi.fn(),
      lineWidth: 0,
      moveTo: vi.fn(),
      scale: vi.fn(),
      stroke: vi.fn(),
      strokeStyle: '',
    } as unknown as CanvasRenderingContext2D
    const canvas = {
      getBoundingClientRect: vi.fn(() => ({ height: 20, width: 100 })),
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement

    vi.stubGlobal('window', {
      devicePixelRatio: 1,
      getComputedStyle: vi.fn(() => ({ color: 'rgba(201, 76, 39, 0.8)' })),
    })

    drawWaveform(canvas, [0.5], 'hsl(var(--compare-a) / 0.8)')

    expect(context.fillStyle).toBe('rgba(201, 76, 39, 0.8)')
    expect(context.fillStyle).not.toContain('var(')
    expect(context.fillRect).toHaveBeenCalled()
  })
})
