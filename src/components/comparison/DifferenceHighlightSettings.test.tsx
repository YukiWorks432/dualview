import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { DifferenceRuntimeState } from '../../stores/differenceHighlightStore'
import { DifferenceRuntimeMessage } from './DifferenceHighlightSettings'

describe('DifferenceRuntimeMessage', () => {
  it('marks playback results as approximate even when there are no regions', () => {
    const runtime: DifferenceRuntimeState = {
      status: 'same',
      message: 'No highlighted differences on the current frame',
      approximate: true,
    }
    const markup = renderToStaticMarkup(<DifferenceRuntimeMessage runtime={runtime} />)

    expect(markup).toContain('No highlighted differences on the current frame')
    expect(markup).toContain('Playback preview (approximate)')
  })

  it('does not mark a paused current-frame result as approximate', () => {
    const runtime: DifferenceRuntimeState = {
      status: 'same',
      message: 'No highlighted differences on the current frame',
      approximate: false,
    }

    const markup = renderToStaticMarkup(<DifferenceRuntimeMessage runtime={runtime} />)

    expect(markup).toContain('No highlighted differences on the current frame')
    expect(markup).not.toContain('Playback preview (approximate)')
  })
})
