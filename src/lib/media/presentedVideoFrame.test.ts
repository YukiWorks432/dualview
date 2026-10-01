import { describe, expect, it } from 'vitest'

import {
  isPresentedVideoFrameCurrent,
  isPresentedVideoFrameCandidateCurrent,
  isVideoFrameRequestCurrent,
  type PresentedVideoFrame,
} from './presentedVideoFrame'

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

  it('rejects an earlier submitted frame after a seek even if its request is labeled with the new generation', () => {
    expect(
      isPresentedVideoFrameCurrent(
        { ...frame, mediaTime: 1, currentTime: 1, seekGeneration: 5 },
        {
          mediaId: 'media-a',
          clipId: 'clip-a',
          mediaTime: 10,
          currentTime: 10,
          seekGeneration: 5,
        },
      ),
    ).toBe(false)
  })
})

describe('isVideoFrameRequestCurrent', () => {
  it('rejects a callback requested before the current seek', () => {
    expect(isVideoFrameRequestCurrent(4, 5)).toBe(false)
  })

  it('accepts a callback requested for the current seek', () => {
    expect(isVideoFrameRequestCurrent(5, 5)).toBe(true)
  })
})

describe('isPresentedVideoFrameCandidateCurrent', () => {
  it('accepts a current-generation frame observed at the settled seek position', () => {
    expect(isPresentedVideoFrameCandidateCurrent(5, 5, 10, 10.005)).toBe(true)
  })

  it('rejects an earlier frame position instead of relabeling it at the seek target', () => {
    expect(isPresentedVideoFrameCandidateCurrent(5, 5, 1, 10)).toBe(false)
  })

  it('rejects a candidate requested before the current seek', () => {
    expect(isPresentedVideoFrameCandidateCurrent(4, 5, 10, 10)).toBe(false)
  })
})
