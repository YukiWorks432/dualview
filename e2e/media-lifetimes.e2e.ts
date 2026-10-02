import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    __mediaLifetime: {
      held: Array<{ image: HTMLImageElement; url: string }>
      created: string[]
      revoked: string[]
      release: () => void
    }
    __slowImport: { signal?: AbortSignal; finish?: () => void }
    __filmstripLifetime: {
      held: Map<number, IdleRequestCallback>
      videos: HTMLVideoElement[]
      release: () => void
    }
  }
}

const png =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGUlEQVR4nGMw7lj1nxLMMGrAqAGjBgwXAwAp1mQfKRGmRQAAAABJRU5ErkJggg=='
const uploadFile = {
  name: 'lifetime.png',
  mimeType: 'image/png',
  buffer: Buffer.from(png, 'base64'),
}

async function openApp(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
        return usePersistenceStore.getState().currentProjectId
      }),
    )
    .toBeTruthy()
}

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const { useMediaStore } = await import('/src/stores/mediaStore.ts')
    const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
    return {
      files: useMediaStore.getState().files.map((file) => ({ id: file.id, status: file.status })),
      clips: useTimelineStore
        .getState()
        .tracks.flatMap((track) => track.clips.map((clip) => clip.mediaId)),
    }
  })
}

async function holdImages(page: Page) {
  await page.addInitScript(() => {
    const nativeCreate = URL.createObjectURL.bind(URL)
    const nativeRevoke = URL.revokeObjectURL.bind(URL)
    const NativeImage = window.Image
    const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!
    const assigned = new WeakMap<HTMLImageElement, string>()
    let holding = true
    const state: Window['__mediaLifetime'] = {
      held: [],
      created: [],
      revoked: [],
      release: () => {
        holding = false
        for (const { image, url } of state.held.splice(0)) {
          if (assigned.get(image) === url) src.set!.call(image, url)
        }
      },
    }
    window.__mediaLifetime = state
    URL.createObjectURL = (blob) => {
      const url = nativeCreate(blob)
      if (blob instanceof File && blob.name === 'lifetime.png') state.created.push(url)
      return url
    }
    URL.revokeObjectURL = (url) => {
      state.revoked.push(url)
      nativeRevoke(url)
    }
    window.Image = function (width?: number, height?: number) {
      const image = new NativeImage(width, height)
      Object.defineProperty(image, 'src', {
        get: () => src.get!.call(image),
        set: (url: string) => {
          assigned.set(image, url)
          if (holding && state.created.includes(url)) state.held.push({ image, url })
          else src.set!.call(image, url)
        },
      })
      return image
    } as unknown as typeof Image
  })
}

for (const route of ['chooser', 'drop', 'paste', 'preview', 'webgl', 'global'] as const) {
  test(`${route}取込のデコード中に削除しても素材・クリップを復活させない`, async ({ page }) => {
    await holdImages(page)
    await openApp(page)
    if (route === 'chooser' || route === 'preview' || route === 'webgl') {
      if (route === 'webgl')
        await page.getByRole('tab', { name: 'Difference comparison mode', exact: true }).click()
      const chooserReady = page.waitForEvent('filechooser')
      if (route === 'chooser') await page.getByText('Media A', { exact: true }).last().click()
      if (route === 'preview')
        await page
          .getByText('Drop Media A', { exact: true })
          .locator('..')
          .locator('..')
          .getByRole('button')
          .click()
      if (route === 'webgl')
        await page.getByRole('button', { name: 'Image', exact: true }).first().click()
      await (await chooserReady).setFiles(uploadFile)
    } else {
      await page.evaluate(
        ({ route, png }) => {
          const bytes = Uint8Array.from(atob(png), (character) => character.charCodeAt(0))
          const transfer = new DataTransfer()
          transfer.items.add(new File([bytes], 'lifetime.png', { type: 'image/png' }))
          if (route === 'paste') {
            window.dispatchEvent(
              new ClipboardEvent('paste', {
                clipboardData: transfer,
                bubbles: true,
                cancelable: true,
              }),
            )
          } else {
            const target =
              route === 'drop'
                ? [...document.querySelectorAll('p')].find(
                    (element) => element.textContent === 'Drop multiple files (auto A/B)',
                  )!
                : document.querySelector('header')!
            target.dispatchEvent(
              new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }),
            )
          }
        },
        { route, png },
      )
    }
    await expect.poll(() => page.evaluate(() => window.__mediaLifetime.held.length)).toBe(1)
    await expect.poll(async () => (await snapshot(page)).files.length).toBe(1)
    await page.getByTitle('Remove', { exact: true }).click()
    await page.evaluate(() => window.__mediaLifetime.release())
    await expect.poll(() => snapshot(page)).toEqual({ files: [], clips: [] })
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__mediaLifetime.created.every((url) =>
            window.__mediaLifetime.revoked.includes(url),
          ),
        ),
      )
      .toBe(true)
  })
}

for (const boundary of ['close', 'escape', 'new', 'clear'] as const) {
  test(`URL取得開始後の${boundary}で古い応答を採用せず、再取込できる`, async ({ page }) => {
    await page.addInitScript((png) => {
      const nativeFetch = window.fetch.bind(window)
      window.__slowImport = {}
      window.fetch = (input, init) => {
        if (String(input).endsWith('/slow-import.png')) {
          window.__slowImport.signal = init?.signal ?? undefined
          return new Promise<Response>((resolve) => {
            window.__slowImport.finish = () =>
              resolve(
                new Response(
                  Uint8Array.from(atob(png), (character) => character.charCodeAt(0)),
                  { headers: { 'content-type': 'image/png' } },
                ),
              )
          })
        }
        return nativeFetch(input, init)
      }
    }, png)
    await openApp(page)
    await page.getByRole('button', { name: 'URL', exact: true }).click()
    await page
      .getByPlaceholder('https://example.com/image.jpg')
      .fill('http://localhost/slow-import.png')
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect.poll(() => page.evaluate(() => Boolean(window.__slowImport.finish))).toBe(true)
    if (boundary === 'close')
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    else if (boundary === 'escape') await page.keyboard.press('Escape')
    else
      await page.evaluate(async (boundary) => {
        if (boundary === 'new') {
          const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
          await usePersistenceStore.getState().createNewProject('Destination')
        } else {
          const { useMediaStore } = await import('/src/stores/mediaStore.ts')
          useMediaStore.getState().clearFiles()
        }
      }, boundary)
    expect(await page.evaluate(() => window.__slowImport.signal?.aborted)).toBe(true)
    await page.evaluate(() => window.__slowImport.finish!())
    await expect.poll(() => snapshot(page)).toEqual({ files: [], clips: [] })
    if (boundary !== 'close' && boundary !== 'escape')
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.getByRole('button', { name: 'URL', exact: true }).click()
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await page.evaluate(() => window.__slowImport.finish!())
    await expect(page.getByText('Successfully imported!', { exact: true })).toBeVisible()
    await expect
      .poll(async () => (await snapshot(page)).files.map((file) => file.status))
      .toEqual(['ready'])
    const current = await snapshot(page)
    expect(current.clips).toEqual([current.files[0].id])
  })
}

async function holdFilmstrips(page: Page) {
  await page.addInitScript(() => {
    const nativeIdle = window.requestIdleCallback.bind(window)
    const nativeCancel = window.cancelIdleCallback.bind(window)
    const create = document.createElement.bind(document)
    let holding = true
    let id = 900_000
    const state: Window['__filmstripLifetime'] = {
      held: new Map(),
      videos: [],
      release: () => {
        holding = false
        for (const callback of state.held.values()) nativeIdle(callback)
        state.held.clear()
      },
    }
    window.__filmstripLifetime = state
    document.createElement = ((...args: Parameters<typeof document.createElement>) => {
      const element = create(...args)
      if (args[0] === 'video' && new Error().stack?.includes('filmstripExtractor'))
        state.videos.push(element as HTMLVideoElement)
      return element
    }) as typeof document.createElement
    window.requestIdleCallback = (callback, options) => {
      if (holding && new Error().stack?.includes('filmstripExtractor')) {
        state.held.set(++id, callback)
        return id
      }
      return nativeIdle(callback, options)
    }
    window.cancelIdleCallback = (id) => {
      state.held.delete(id)
      nativeCancel(id)
    }
  })
}

async function importVideo(page: Page) {
  const chooserReady = page.waitForEvent('filechooser')
  await page.getByText('Media A', { exact: true }).last().click()
  await (await chooserReady).setFiles(path.join(process.cwd(), 'e2e/fixtures/difference-a.webm'))
  await expect.poll(() => page.evaluate(() => window.__filmstripLifetime.held.size)).toBe(1)
}

test('抽出中の移動・トリミング・追加・表示切替後も完了し、再表示で再抽出しない', async ({
  page,
}) => {
  await holdFilmstrips(page)
  await openApp(page)
  await importVideo(page)
  const mediaId = await page.evaluate(async () => {
    const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
    const timeline = useTimelineStore.getState()
    const clip = timeline.tracks[0].clips[0]
    timeline.moveClip(clip.id, 'track-a', 1)
    timeline.trimClip(clip.id, 'end', 1.5)
    timeline.addClip('track-b', clip.mediaId, 0, 1)
    return clip.mediaId
  })
  await page.getByRole('button', { name: 'Hide filmstrip', exact: true }).click()
  await page.getByRole('button', { name: 'Show filmstrip', exact: true }).click()
  await page.evaluate(() => window.__filmstripLifetime.release())
  await expect(page.locator('[data-clip] .animate-pulse')).toHaveCount(0)
  await expect(page.locator('[data-clip] .opacity-60')).toHaveCount(2)
  expect(
    await page.evaluate(async (id) => {
      const { getCachedFilmstrip } = await import('/src/lib/filmstripExtractor.ts')
      return getCachedFilmstrip(id)?.frames.length
    }, mediaId),
  ).toBe(1)
  await page.getByRole('button', { name: 'Hide filmstrip', exact: true }).click()
  await page.getByRole('button', { name: 'Show filmstrip', exact: true }).click()
  await expect(page.locator('[data-clip] .opacity-60')).toHaveCount(2)
  expect(await page.evaluate(() => window.__filmstripLifetime.videos.length)).toBe(1)
  await page.getByTitle('Remove', { exact: true }).click()
  expect(
    await page.evaluate(async (id) => {
      const { getCachedFilmstrip } = await import('/src/lib/filmstripExtractor.ts')
      return getCachedFilmstrip(id)
    }, mediaId),
  ).toBeNull()
})

test('抽出中の削除で待機コールバックと動画資源を解放する', async ({ page }) => {
  await holdFilmstrips(page)
  await openApp(page)
  await importVideo(page)
  await page.getByTitle('Remove', { exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(() => ({
        idle: window.__filmstripLifetime.held.size,
        sources: window.__filmstripLifetime.videos.map((video) => video.getAttribute('src')),
      })),
    )
    .toEqual({ idle: 0, sources: [null] })
  await page.evaluate(() => window.__filmstripLifetime.release())
  await expect.poll(() => snapshot(page)).toEqual({ files: [], clips: [] })
})

test('抽出失敗後も移動と表示切替で読み込み表示へ戻らない', async ({ page }) => {
  await holdFilmstrips(page)
  await openApp(page)
  await importVideo(page)
  await page.evaluate(async () => {
    window.__filmstripLifetime.videos[0].dispatchEvent(new Event('error'))
    const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
    const timeline = useTimelineStore.getState()
    timeline.moveClip(timeline.tracks[0].clips[0].id, 'track-a', 1)
  })
  await expect(page.locator('[data-clip] .animate-pulse')).toHaveCount(0)
  await expect(page.locator('[data-clip] .opacity-50')).toHaveCount(1)
  await page.getByRole('button', { name: 'Hide filmstrip', exact: true }).click()
  await page.getByRole('button', { name: 'Show filmstrip', exact: true }).click()
  await expect(page.locator('[data-clip] .opacity-50')).toHaveCount(1)
  await expect(page.locator('[data-clip] .animate-pulse')).toHaveCount(0)
  expect(await page.evaluate(() => window.__filmstripLifetime.videos.length)).toBe(1)
})
