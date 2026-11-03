import { expect, test } from '@playwright/test'

const png =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGUlEQVR4nGMw7lj1nxLMMGrAqAGjBgwXAwAp1mQfKRGmRQAAAABJRU5ErkJggg=='

test('参照素材の再読込と再指定でクリップを保持し、動画本体を保存しない', async ({ page }) => {
  await page.goto('/')
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
        return usePersistenceStore.getState().currentProjectId
      }),
    )
    .toBeTruthy()
  const snapshot = await page.evaluate(async (data) => {
    const { useMediaStore } = await import('/src/stores/mediaStore.ts')
    const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
    const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
    const { getProjectMediaBlobs } = await import('/src/lib/indexedDB.ts')
    const bytes = Uint8Array.from(atob(data), (byte) => byte.charCodeAt(0))
    const media = (await useMediaStore
      .getState()
      .addFile(new File([bytes], 'linked.png', { type: 'image/png' })))!
    useTimelineStore.getState().addClip('track-a', media.id, 0, 10)
    usePersistenceStore.getState().updateProjectMetadata({ name: 'Linked media test' })
    await usePersistenceStore.getState().saveCurrentProject()
    const id = usePersistenceStore.getState().currentProjectId!
    return { id, mediaId: media.id, blobs: (await getProjectMediaBlobs(id)).size }
  }, png)
  expect(snapshot.blobs).toBe(0)
  await page.reload()
  await expect(page.getByTitle('Open Projects', { exact: true })).toBeVisible()
  await page.getByTitle('Open Projects', { exact: true }).click()
  await page.getByRole('button', { name: 'Select project Linked media test', exact: true }).click()
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  const input = page.getByLabel('linked.pngを再指定', { exact: true })
  await expect(input).toBeVisible()
  await input.setInputFiles({
    name: 'linked.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  })
  await expect(input).toHaveCount(0)
  const restored = await page.evaluate(async () => {
    const { useMediaStore } = await import('/src/stores/mediaStore.ts')
    const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
    return {
      media: useMediaStore.getState().files.map((file) => ({ id: file.id, status: file.status })),
      clips: useTimelineStore.getState().tracks.flatMap((track) => track.clips),
    }
  })
  expect(restored.media).toEqual([{ id: snapshot.mediaId, status: 'ready' }])
  expect(restored.clips).toHaveLength(1)
  expect(restored.clips[0].mediaId).toBe(snapshot.mediaId)
})

test('旧第1版の素材入りプロジェクトを読み込み、素材入りのまま書き出せる', async ({ page }) => {
  await page.goto('/')
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
        return usePersistenceStore.getState().currentProjectId
      }),
    )
    .toBeTruthy()
  const result = await page.evaluate(async (data) => {
    const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
    const { useMediaStore } = await import('/src/stores/mediaStore.ts')
    const { getProject } = await import('/src/lib/indexedDB.ts')
    const record = (await getProject(usePersistenceStore.getState().currentProjectId!))!
    const legacy = {
      version: 1,
      project: {
        ...record,
        mediaManifest: [{ id: 'legacy-image', name: 'legacy.png', type: 'image' }],
      },
      mediaFiles: [{ id: 'legacy-image', name: 'legacy.png', type: 'image/png', data }],
    }
    const id = await usePersistenceStore
      .getState()
      .importProject(new File([JSON.stringify(legacy)], 'legacy.dualview'))
    await usePersistenceStore.getState().loadProject(id)
    const media = useMediaStore.getState().files[0]
    const image = await createImageBitmap(media.file)
    const dimensions = [image.width, image.height]
    image.close()
    const exported = JSON.parse(await (await usePersistenceStore.getState().exportProject()).text())
    return {
      status: media.status,
      dimensions,
      version: exported.version,
      mediaFiles: exported.mediaFiles,
    }
  }, png)
  expect(result.status).toBe('ready')
  expect(result.dimensions).toEqual([16, 16])
  expect(result.version).toBe(1)
  expect(result.mediaFiles[0].data.split(',').at(-1)).toBe(png)
})

for (const count of [1, 2]) {
  test(`読込準備中の画面から${count === 1 ? '個別' : '一括'}中止でき、待機素材を追加しない`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const NativeImage = window.Image
      window.Image = function () {
        const image = new NativeImage()
        Object.defineProperty(image, 'src', { get: () => '', set: () => {} })
        return image
      } as unknown as typeof Image
    })
    await page.goto('/')
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
          return usePersistenceStore.getState().currentProjectId
        }),
      )
      .toBeTruthy()
    const chooser = page.waitForEvent('filechooser')
    await page.getByText('Media A', { exact: true }).last().click()
    await (
      await chooser
    ).setFiles(
      Array.from({ length: count }, (_, index) => ({
        name: `held-${index}.png`,
        mimeType: 'image/png',
        buffer: Buffer.from(png, 'base64'),
      })),
    )
    const activity = page.getByRole('region', { name: '素材の読み込み' })
    await expect(activity.getByRole('progressbar')).toBeVisible()
    await activity
      .getByRole('button', { name: count === 1 ? '中止' : 'すべて中止', exact: true })
      .click()
    await expect(activity).toHaveCount(0)
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { useMediaStore } = await import('/src/stores/mediaStore.ts')
          const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
          return [
            useMediaStore.getState().files.length,
            useTimelineStore.getState().tracks.flatMap((track) => track.clips).length,
          ]
        }),
      )
      .toEqual([0, 0])
  })
}
