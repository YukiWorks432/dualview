import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { captureMediaImport } from '../lib/media/importRequest'
import { projectSession } from '../lib/projectSession'
import { isMediaImportCurrent, useMediaStore as media } from './mediaStore'
import { useTimelineStore as timeline } from './timelineStore'

class TestImage {
  static instances: TestImage[] = []
  naturalWidth = 16
  naturalHeight = 8
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  src = ''
  constructor() {
    TestImage.instances.push(this)
  }
}
const revoked = vi.fn<(url: string) => void>()
let nextUrl = 0
const imageFile = () => new File(['pixels'], 'frame.png', { type: 'image/png', lastModified: 42 })

beforeEach(() => {
  media.getState().clearFiles()
  timeline.setState(timeline.getInitialState())
  TestImage.instances = []
  revoked.mockClear()
  nextUrl = 0
  vi.stubGlobal('Image', TestImage)
  vi.stubGlobal('document', {
    createElement: () => ({
      getContext: () => ({ drawImage: () => {} }),
      toDataURL: () => 'thumbnail',
    }),
  })
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:test-${++nextUrl}`)
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revoked)
})

afterEach(() => {
  media.getState().clearFiles()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function pendingImport() {
  const request = captureMediaImport()
  const promise = media.getState().addFile(imageFile(), request)
  await vi.waitFor(() => expect(TestImage.instances).toHaveLength(1))
  return { promise, request, id: media.getState().files[0].id, image: TestImage.instances[0] }
}

describe('media request ownership', () => {
  it.each(['remove', 'clear', 'session', 'cancel'])(
    'settles pending decode after %s without admitting a clip or retaining its URL',
    async (boundary) => {
      const controller = new AbortController()
      const request = captureMediaImport(controller.signal)
      const promise = media.getState().addFile(imageFile(), request)
      await vi.waitFor(() => expect(TestImage.instances).toHaveLength(1))
      const image = TestImage.instances[0]
      const staleLoad = image.onload!
      const id = media.getState().files[0].id
      if (boundary === 'remove') media.getState().removeFile(id)
      if (boundary === 'clear') media.getState().clearFiles()
      if (boundary === 'session') projectSession.advance()
      if (boundary === 'cancel') controller.abort()
      const result = await promise
      expect(result).toBeNull()
      expect(isMediaImportCurrent(result, request)).toBe(false)
      staleLoad()
      expect(media.getState().files).toEqual([])
      expect(timeline.getState().tracks.flatMap((track) => track.clips)).toEqual([])
      expect(revoked.mock.calls).toEqual([['blob:test-1']])
      expect(image.src).toBe('')
      expect(image.onload).toBeNull()
      expect(image.onerror).toBeNull()
    },
  )

  it.each(['remove', 'clear', 'session'])('does not revive a retry after %s', async (boundary) => {
    const pending = await pendingImport()
    const failed = pending.promise.catch((error: Error) => error)
    pending.image.onerror!()
    expect(await failed).toBeInstanceOf(Error)
    expect(media.getState().getFile(pending.id)?.status).toBe('error')
    const retry = media.getState().retryProcessing(pending.id)
    const retryImage = TestImage.instances[1]
    const staleLoad = retryImage.onload!
    if (boundary === 'remove') media.getState().removeFile(pending.id)
    if (boundary === 'clear') media.getState().clearFiles()
    if (boundary === 'session') projectSession.advance()
    await retry
    staleLoad()
    expect(media.getState().files).toEqual([])
    expect(revoked.mock.calls).toEqual([['blob:test-1'], ['blob:test-2']])
    expect(retryImage.src).toBe('')
  })

  it('adopts a retry under its existing ID and suppresses repeated retry clicks', async () => {
    const pending = await pendingImport()
    const failed = pending.promise.catch((error: Error) => error)
    pending.image.onerror!()
    expect(await failed).toBeInstanceOf(Error)
    const retry = media.getState().retryProcessing(pending.id)
    await media.getState().retryProcessing(pending.id)
    expect(TestImage.instances).toHaveLength(2)
    TestImage.instances[1].onload!()
    await retry
    expect(media.getState().files).toHaveLength(1)
    expect(media.getState().getFile(pending.id)).toMatchObject({
      status: 'ready',
      url: 'blob:test-2',
    })
    expect(revoked.mock.calls).toEqual([['blob:test-1']])
  })

  it('keeps independent concurrent imports referencing the original file', async () => {
    const source = imageFile()
    const a = media.getState().addFile(source)
    const b = media.getState().addFile(source)
    await vi.waitFor(() => expect(TestImage.instances).toHaveLength(2))
    TestImage.instances[1].onload!()
    const second = await b
    TestImage.instances[0].onload!()
    const first = await a
    expect(first?.id).not.toBe(second?.id)
    expect(media.getState().files).toHaveLength(2)
    expect(first!.file).toBe(source)
    expect(first!.file.lastModified).toBe(42)
    expect(await first!.file.text()).toBe('pixels')
    expect(revoked).not.toHaveBeenCalled()
  })

  it('removes ready-media clips and selections when the library is cleared', async () => {
    const pending = await pendingImport()
    pending.image.onload!()
    const adopted = await pending.promise
    timeline.getState().addClip('track-a', adopted!.id, 0, 10)
    media.getState().selectFile(adopted!.id)
    media.getState().clearFiles()
    expect(timeline.getState().tracks.flatMap((track) => track.clips)).toEqual([])
    expect(media.getState().selectedIds).toEqual([])
    expect(revoked.mock.calls).toEqual([['blob:test-1']])
  })

  it('invalidates a whole batch captured before detachment or URL retrieval', async () => {
    const request = captureMediaImport()
    media.getState().clearFiles()
    expect(await media.getState().addFile(imageFile(), request)).toBeNull()
    expect(await media.getState().addFile(imageFile(), request)).toBeNull()
    expect(TestImage.instances).toEqual([])
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('rejects a once-successful result if it was removed before caller continuation', async () => {
    const pending = await pendingImport()
    pending.image.onload!()
    const result = await pending.promise
    expect(isMediaImportCurrent(result, pending.request)).toBe(true)
    media.getState().removeFile(pending.id)
    expect(isMediaImportCurrent(result, pending.request)).toBe(false)
  })
})

it('reconnects the existing media ID and preserves clips when reconnection is cancelled', async () => {
  const pending = await pendingImport()
  pending.image.onload!()
  const original = (await pending.promise)!
  timeline.getState().addClip('track-a', original.id, 0, 10)
  const clips = timeline.getState().tracks.flatMap((track) => track.clips)
  media.setState({ files: [{ ...original, url: '', needsRelink: true, status: 'error' }] })
  await expect(
    media.getState().reconnectFile(original.id, new File(['bad'], 'other.png')),
  ).rejects.toThrow('元の素材と名前・容量が一致するファイルを選択してください')
  const retry = media.getState().reconnectFile(original.id, imageFile())
  media.getState().cancelImport(original.id)
  await retry
  expect(media.getState().getFile(original.id)?.needsRelink).toBe(true)
  expect(timeline.getState().tracks.flatMap((track) => track.clips)).toEqual(clips)
  const success = media.getState().reconnectFile(original.id, imageFile())
  TestImage.instances.at(-1)!.onload!()
  await success
  expect(media.getState().getFile(original.id)).toMatchObject({ status: 'ready', id: original.id })
  expect(media.getState().getFile(original.id)?.needsRelink).toBeUndefined()
  expect(timeline.getState().tracks.flatMap((track) => track.clips)).toEqual(clips)
})
