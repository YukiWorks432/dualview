import { expect, test } from '@playwright/test'

// ブラウザーで使う開発サーバーのモジュール宣言は、検証時の型設定から解決する。
declare global {
  interface Window {
    __autosaveStatuses: string[]
  }
}

test('WebGLしきい値の単独変更を自動保存し、IndexedDBと再読込後のUIに反映する', async ({ page }) => {
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
  const projectId = await page.evaluate(async () => {
    const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
    usePersistenceStore.getState().updateProjectMetadata({ name: 'Threshold autosave' })
    return usePersistenceStore.getState().currentProjectId!
  })
  await page.getByRole('tab', { name: 'Difference comparison mode', exact: true }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible()
  const threshold = page
    .locator('label')
    .filter({ hasText: /^Threshold:/ })
    .locator('..')
    .getByRole('slider')
  await expect(threshold).toHaveValue('0.02')
  await page.evaluate(async () => {
    const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
    window.__autosaveStatuses = []
    usePersistenceStore.subscribe((state, previous) => {
      if (state.saveStatus !== previous.saveStatus) window.__autosaveStatuses.push(state.saveStatus)
    })
  })
  await threshold.focus()
  await threshold.press('ArrowRight')
  await expect(threshold).toHaveValue('0.03')
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible()
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(async (id) => {
        const { getProject } = await import('/src/lib/indexedDB.ts')
        return JSON.parse((await getProject(id))!.projectSettings).webglComparisonSettings.threshold
      }, projectId),
    )
    .toBe(0.03)
  expect(await page.evaluate(() => window.__autosaveStatuses)).toEqual([
    'unsaved',
    'saving',
    'saved',
  ])

  // 再読込で元の実行中ストアを捨て、切替時の追加保存が欠陥を隠さないようにする。
  await page.reload()
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible()
  await page.getByTitle('Open Projects', { exact: true }).click()
  await page.getByRole('button', { name: 'Select project Threshold autosave', exact: true }).click()
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(threshold).toHaveValue('0.03')
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
        return usePersistenceStore.getState().currentProjectId
      }),
    )
    .toBe(projectId)
})
