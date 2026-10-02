import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/media/prores', () => ({
  probeVideoFile: async () => ({
    codec: 'vp9',
    duration: 1,
    width: 16,
    height: 8,
    hasAlpha: false,
    decodable: true,
  }),
}))

import { useMediaStore as media } from './mediaStore'

class TestVideo extends EventTarget {
  src = ''
  readyState = 0
  videoWidth = 16
  videoHeight = 8
  duration = 1
  load = vi.fn<() => void>()
  removeAttribute(name: string) {
    if (name === 'src') this.src = ''
  }
}
let videos: TestVideo[] = []
let failThumbnail = false

beforeEach(() => {
  media.getState().clearFiles()
  videos = []
  failThumbnail = false
  vi.stubGlobal('HTMLMediaElement', { HAVE_CURRENT_DATA: 2 })
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      if (tag === 'video') {
        const video = new TestVideo()
        videos.push(video)
        return video
      }
      return {
        getContext: () => ({
          drawImage: () => {
            if (failThumbnail) throw new Error('thumbnail failed')
          },
        }),
        toDataURL: () => 'thumbnail',
      }
    },
  })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:video')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => {
  media.getState().clearFiles()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('native video import resources', () => {
  it('releases native decoding immediately when the pending media is removed', async () => {
    const pending = media
      .getState()
      .addFile(new File(['video'], 'clip.webm', { type: 'video/webm' }))
    await vi.waitFor(() => expect(videos).toHaveLength(1))
    media.getState().removeFile(media.getState().files[0].id)
    expect(await pending).toBeNull()
    videos[0].dispatchEvent(new Event('loadeddata'))
    expect(videos[0].src).toBe('')
    expect(videos[0].load).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:video')
    expect(media.getState().files).toEqual([])
  })

  it.each(['decode', 'thumbnail'])(
    'releases native decoding and the URL on %s failure',
    async (failure) => {
      failThumbnail = failure === 'thumbnail'
      const pending = media
        .getState()
        .addFile(new File(['video'], 'clip.webm', { type: 'video/webm' }))
        .catch((error: Error) => error)
      await vi.waitFor(() => expect(videos).toHaveLength(1))
      videos[0].dispatchEvent(new Event(failure === 'decode' ? 'error' : 'loadeddata'))
      expect(await pending).toBeInstanceOf(Error)
      expect(media.getState().files[0].status).toBe('error')
      expect(videos[0].src).toBe('')
      expect(videos[0].load).toHaveBeenCalledOnce()
      expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:video')
    },
  )
})
