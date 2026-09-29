import { describe, expect, it } from 'vitest'

import { detachFile } from './detachFile'

describe('detachFile', () => {
  it('copies bytes and metadata into an independent File', async () => {
    const source = new File([new Uint8Array([0, 1, 2, 127, 255])], 'delivery.mov', {
      type: 'video/quicktime',
      lastModified: 1_700_000_000_000,
    })

    const detached = await detachFile(source)

    expect(detached).not.toBe(source)
    expect(detached.name).toBe(source.name)
    expect(detached.type).toBe(source.type)
    expect(detached.lastModified).toBe(source.lastModified)
    expect(detached.size).toBe(source.size)
    expect(new Uint8Array(await detached.arrayBuffer())).toEqual(
      new Uint8Array([0, 1, 2, 127, 255]),
    )
  })

  it('preserves empty files without retaining the source object', async () => {
    const source = new File([], 'frame.png', { type: 'image/png', lastModified: 42 })

    const detached = await detachFile(source)

    expect(detached).not.toBe(source)
    expect(detached.size).toBe(0)
    expect(detached.name).toBe('frame.png')
    expect(detached.type).toBe('image/png')
    expect(detached.lastModified).toBe(42)
  })
})
