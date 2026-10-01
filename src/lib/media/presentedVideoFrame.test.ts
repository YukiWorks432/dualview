import { describe, expect, it } from 'vitest'

import { isPresentedVideoFrameCurrent, type PresentedVideoFrame } from './presentedVideoFrame'

const frame: PresentedVideoFrame = {
  mediaId: 'media-a',
  clipId: 'clip-a',
  mediaTime: 1,
  currentTime: 1.08,
  seekGeneration: 4,
}

describe('isPresentedVideoFrameCurrent', () => {
  it('accepts a freshly presented variable-frame-rate frame at the requested position', () => {
    expect(
      isPresentedVideoFrameCurrent(frame, {
        mediaId: 'media-a',
        clipId: 'clip-a',
        mediaTime: 1.08,
        currentTime: 1.08,
        seekGeneration: 4,
      }),
    ).toBe(true)
  })

  it.each([
    ['different media', { ...frame, mediaId: 'older-media' }],
    ['different clip', { ...frame, clipId: 'older-clip' }],
    ['older seek', { ...frame, seekGeneration: 3 }],
    ['frame timestamp after the target', { ...frame, mediaTime: 1.09 }],
    ['frame submitted at an older position', { ...frame, currentTime: 1 }],
  ])('rejects a stale or mismatched %s', (_description, presentedFrame) => {
    expect(
      isPresentedVideoFrameCurrent(presentedFrame, {
        mediaId: 'media-a',
        clipId: 'clip-a',
        mediaTime: 1.08,
        currentTime: 1.08,
        seekGeneration: 4,
      }),
    ).toBe(false)
  })

  it('rejects a video element that has not reached the requested paused position', () => {
    expect(
      isPresentedVideoFrameCurrent(frame, {
        mediaId: 'media-a',
        clipId: 'clip-a',
        mediaTime: 1.08,
        currentTime: 1.2,
        seekGeneration: 4,
      }),
    ).toBe(false)
  })
})
