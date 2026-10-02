import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useMediaStore as media } from '../stores/mediaStore'
import {
  clearAllFilmstripCache,
  clearFilmstripCache,
  extractFilmstrip,
  getCachedFilmstrip,
} from './filmstripExtractor'

class TestVideo extends EventTarget {
  src = ''
  currentTime = 0
  load = vi.fn<() => void>()
  removeAttribute(name: string) {
    if (name === 'src') this.src = ''
  }
  metadata() {
    this.dispatchEvent(new Event('loadedmetadata'))
  }
  frame() {
    this.dispatchEvent(new Event('seeked'))
  }
  fail() {
    this.dispatchEvent(new Event('error'))
  }
}
let videos: TestVideo[] = []
let id = 0
const idle = new Map<number, () => void>()
const file = () => new File(['video'], 'clip.webm', { type: 'video/webm' })

beforeEach(() => {
  clearAllFilmstripCache()
  videos = []
  idle.clear()
  vi.useFakeTimers()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubGlobal('window', {
    requestIdleCallback: (callback: () => void) => {
      idle.set(++id, callback)
      return id
    },
    cancelIdleCallback: (id: number) => idle.delete(id),
  })
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      if (tag === 'video') {
        const video = new TestVideo()
        videos.push(video)
        return video
      }
      return {
        getContext: () => ({ drawImage: () => {} }),
        toDataURL: () => 'data:image/jpeg;frame',
      }
    },
  })
})
afterEach(() => {
  clearAllFilmstripCache()
  media.getState().clearFiles()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function finish(video: TestVideo) {
  video.metadata()
  video.frame()
  for (const [key, callback] of [...idle]) {
    idle.delete(key)
    callback()
  }
}

describe('shared filmstrip lifetimes', () => {
  it('joins pending work and reuses identical completed media and settings', async () => {
    const source = file()
    const first = extractFilmstrip('a', 'blob:a', 1, { maxFrames: 60 }, source)
    const second = extractFilmstrip(
      'a',
      'blob:a',
      1,
      { maxFrames: 60, frameInterval: undefined },
      source,
    )
    expect(videos).toHaveLength(1)
    expect(second).toBe(first)
    finish(videos[0])
    const result = await first
    expect(result?.frames).toHaveLength(1)
    expect(await second).toBe(result)
    expect(await extractFilmstrip('a', 'blob:a', 1, { maxFrames: 60 }, source)).toBe(result)
    expect(videos).toHaveLength(1)
    expect(videos[0].src).toBe('')
    expect(videos[0].load).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['file', 'url', 'duration', 'settings'])(
    'does not reuse a completed result after its %s changes',
    async (change) => {
      const source = file()
      const first = extractFilmstrip('a', 'blob:a', 1, {}, source)
      finish(videos[0])
      await first
      const second = extractFilmstrip(
        'a',
        change === 'url' ? 'blob:b' : 'blob:a',
        change === 'duration' ? 0.5 : 1,
        change === 'settings' ? { thumbnailWidth: 120 } : {},
        change === 'file' ? file() : source,
      )
      expect(videos).toHaveLength(2)
      finish(videos[1])
      expect(await second).not.toBe(await first)
    },
  )

  it('settles failed work once, and a deliberate invalidation permits retry', async () => {
    const first = extractFilmstrip('a', 'blob:a', 1)
    videos[0].fail()
    expect(await first).toBeNull()
    expect(await extractFilmstrip('a', 'blob:a', 1)).toBeNull()
    expect(videos).toHaveLength(1)
    clearFilmstripCache('a')
    const retry = extractFilmstrip('a', 'blob:a', 1)
    finish(videos[1])
    expect((await retry)?.frames).toHaveLength(1)
  })

  it.each(['remove', 'clear', 'replace'])(
    'cancels a pending extraction on library %s and cannot repopulate the cache',
    async (boundary) => {
      const source = file()
      media.setState({
        files: [
          {
            id: 'a',
            name: source.name,
            type: 'video',
            file: source,
            url: 'blob:a',
            status: 'ready',
          },
        ],
      })
      const pending = extractFilmstrip('a', 'blob:a', 1, {}, source)
      videos[0].metadata()
      videos[0].frame()
      const staleCallback = [...idle.values()][0]
      if (boundary === 'remove') media.getState().removeFile('a')
      if (boundary === 'clear') media.getState().clearFiles()
      if (boundary === 'replace')
        media.setState({ files: [{ ...media.getState().files[0], file: file(), url: 'blob:b' }] })
      expect(await pending).toBeNull()
      staleCallback()
      expect(getCachedFilmstrip('a')).toBeNull()
      expect(videos[0].src).toBe('')
      expect(videos[0].load).toHaveBeenCalledOnce()
      expect(idle.size).toBe(0)
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it('releases all completed variants when a media item is deleted', async () => {
    for (const thumbnailWidth of [80, 120]) {
      const pending = extractFilmstrip('a', 'blob:a', 1, { thumbnailWidth })
      finish(videos.at(-1)!)
      await pending
    }
    expect(getCachedFilmstrip('a')).not.toBeNull()
    clearFilmstripCache('a')
    expect(getCachedFilmstrip('a')).toBeNull()
    const repeated = extractFilmstrip('a', 'blob:a', 1)
    expect(videos).toHaveLength(3)
    finish(videos[2])
    await repeated
  })

  it('bounds retained completed results while keeping the most recently reused result', async () => {
    for (let index = 0; index < 50; index++) {
      const pending = extractFilmstrip(String(index), `blob:${index}`, 1)
      finish(videos.at(-1)!)
      await pending
    }
    await extractFilmstrip('0', 'blob:0', 1)
    const newest = extractFilmstrip('50', 'blob:50', 1)
    finish(videos.at(-1)!)
    await newest
    expect(getCachedFilmstrip('0')).not.toBeNull()
    expect(getCachedFilmstrip('1')).toBeNull()
    expect(getCachedFilmstrip('50')).not.toBeNull()
  })

  it('settles a stalled decoder at timeout and releases it', async () => {
    const pending = extractFilmstrip('a', 'blob:a', 1)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(await pending).toBeNull()
    expect(videos[0].src).toBe('')
    expect(videos[0].load).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
})
