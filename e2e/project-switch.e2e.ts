import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

async function openSavedProject(page: Page, name: string) {
  await page.getByTitle('Open Projects', { exact: true }).click()
  await page.getByRole('button', { name: `Select project ${name}`, exact: true }).click()
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

async function projectSnapshot(page: Page) {
  return page.evaluate(async () => {
    const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
    const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
    const { useMediaStore } = await import('/src/stores/mediaStore.ts')
    return {
      id: usePersistenceStore.getState().currentProjectId,
      name: usePersistenceStore.getState().projectMetadata?.name,
      status: usePersistenceStore.getState().saveStatus,
      clips: useTimelineStore.getState().tracks.flatMap((track) => track.clips),
      mediaIds: useMediaStore.getState().files.map((file) => file.id),
      selectedClipId: useTimelineStore.getState().selectedClipId,
      clipboardClipId: useTimelineStore.getState().clipboardClipId,
    }
  })
}

test('saves outgoing edits, reloads browser media and keeps Undo inside each project session', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect.poll(async () => (await projectSnapshot(page)).id).toBeTruthy()
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()
  await page.evaluate(async () => {
    const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
    // Keep the debounce pending so the switch, not a lucky timer, must persist the edits.
    usePersistenceStore.setState({ _autoSaveDelay: 60_000 })
    usePersistenceStore.getState().updateProjectMetadata({ name: 'Persistence A' })
  })

  const chooserReady = page.waitForEvent('filechooser')
  await page.getByText('Media A', { exact: true }).last().click()
  await (
    await chooserReady
  ).setFiles(path.join(process.cwd(), 'e2e', 'fixtures', 'difference-a.webm'))
  await expect(page.locator('[data-clip]')).toHaveCount(1)
  await expect(page.locator('video[data-track="a"]').first()).toHaveAttribute(
    'data-frame-ready',
    'true',
  )
  const a = await projectSnapshot(page)
  expect(a.status).toBe('unsaved')

  await page.locator('[data-clip]').click()
  await page.keyboard.press('Delete')
  await expect(page.locator('[data-clip]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.locator('[data-clip]')).toHaveCount(1)
  await page.locator('[data-clip]').click()
  await page.keyboard.press('Control+c')

  await page.getByTitle('Open Projects', { exact: true }).click()
  await page.getByRole('button', { name: 'New Project', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const b = await projectSnapshot(page)
  expect(b.id).not.toBe(a.id)
  expect(b.clips).toEqual([])
  expect(b.mediaIds).toEqual([])
  expect(b.selectedClipId).toBeNull()
  expect(b.clipboardClipId).toBeNull()
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled()
  await page.keyboard.press('Control+z')
  expect((await projectSnapshot(page)).clips).toEqual([])

  await openSavedProject(page, 'Persistence A')
  await expect(page.locator('[data-clip]')).toHaveCount(1)
  await expect(page.locator('video[data-track="a"]').first()).toHaveAttribute(
    'data-frame-ready',
    'true',
  )
  expect((await projectSnapshot(page)).clips).toEqual(a.clips)
  expect((await projectSnapshot(page)).mediaIds).toEqual(a.mediaIds)
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()

  await page.locator('[data-clip]').click()
  await page.keyboard.press('Delete')
  await expect(page.locator('[data-clip]')).toHaveCount(0)
  await page.keyboard.press('Control+z')
  await expect(page.locator('[data-clip]')).toHaveCount(1)
  await page.keyboard.press('Control+s')
  await expect.poll(async () => (await projectSnapshot(page)).status).toBe('saved')

  await page.reload()
  await expect.poll(async () => (await projectSnapshot(page)).id).toBeTruthy()
  await openSavedProject(page, 'Persistence A')
  await expect(page.locator('[data-clip]')).toHaveCount(1)
  await expect(page.locator('video[data-track="a"]').first()).toHaveAttribute(
    'data-frame-ready',
    'true',
  )
  const reloaded = await projectSnapshot(page)
  expect(reloaded.id).toBe(a.id)
  expect(reloaded.clips).toEqual(a.clips)
  expect(reloaded.mediaIds).toEqual(a.mediaIds)
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
  await page.keyboard.press('Control+z')
  expect((await projectSnapshot(page)).clips).toEqual(a.clips)
})

test('shows a failed load in the project dialog and allows retry without losing the current edit', async ({
  page,
}) => {
  await page.goto('/')
  await expect.poll(async () => (await projectSnapshot(page)).id).toBeTruthy()
  const brokenId = await page.evaluate(async () => {
    const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
    const { getProject, saveProjectWithMedia } = await import('/src/lib/indexedDB.ts')
    const store = usePersistenceStore.getState()
    const id = await store.createNewProject('Retry destination')
    const record = await getProject(id!)
    await store.createNewProject('Keep this edit')
    await saveProjectWithMedia({ ...record!, projectSettings: '{' }, new Map())
    usePersistenceStore.setState({ _autoSaveDelay: 60_000 })
    store.updateProjectMetadata({ description: 'must survive the failed load' })
    return id!
  })
  const before = await projectSnapshot(page)
  await page.getByTitle('Open Projects', { exact: true }).click()
  await page.getByRole('button', { name: 'Select project Retry destination', exact: true }).click()
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect((await projectSnapshot(page)).id).toBe(before.id)
  expect((await projectSnapshot(page)).name).toBe('Keep this edit')
  await page.evaluate(async (id) => {
    const { getProject, saveProjectWithMedia } = await import('/src/lib/indexedDB.ts')
    const record = await getProject(id)
    await saveProjectWithMedia({ ...record!, projectSettings: '{}' }, new Map())
  }, brokenId)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await projectSnapshot(page)).id).toBe(brokenId)
})
