import { afterEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({
  canRead: vi.fn<() => Promise<boolean>>(),
  dispose: vi.fn<() => void>(),
  track: vi.fn<() => Promise<unknown>>(),
}))
vi.mock('mediabunny', () => ({
  ALL_FORMATS: [],
  BlobSource: class {},
  CanvasSink: class {},
  Input: class {
    canRead = harness.canRead
    dispose = harness.dispose
    getPrimaryVideoTrack = harness.track
  },
}))

import { probeVideoFile } from './prores'

afterEach(() => vi.resetAllMocks())

describe('video probe ownership', () => {
  it('disposes the demuxer while a read is pending and cannot start a decoder afterward', async () => {
    let finish!: (value: boolean) => void
    harness.canRead.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const controller = new AbortController()
    const pending = probeVideoFile(new File(['video'], 'a.mov'), controller.signal).catch(
      (error: Error) => error,
    )
    controller.abort()
    expect(harness.dispose).toHaveBeenCalledOnce()
    finish(true)
    expect(await pending).toMatchObject({ name: 'AbortError' })
    expect(harness.track).not.toHaveBeenCalled()
    expect(harness.dispose).toHaveBeenCalledOnce()
  })

  it('disposes a failed probe without needing cancellation', async () => {
    harness.canRead.mockResolvedValue(false)
    await expect(probeVideoFile(new File(['video'], 'a.mov'))).rejects.toThrow(
      'Unsupported video container',
    )
    expect(harness.dispose).toHaveBeenCalledOnce()
  })
})
