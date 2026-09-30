import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { DifferenceRuntimeState } from '../../stores/differenceHighlightStore'
import { DifferenceRuntimeMessage } from './DifferenceHighlightSettings'

describe('DifferenceRuntimeMessage', () => {
  it('renders the current-frame result without playback approximation text', () => {
    const runtime: DifferenceRuntimeState = {
      status: 'same',
      message: 'No highlighted differences on the current frame',
    }

    const markup = renderToStaticMarkup(<DifferenceRuntimeMessage runtime={runtime} />)

    expect(markup).toContain('No highlighted differences on the current frame')
    expect(markup).not.toContain('Playback preview')
  })
})
