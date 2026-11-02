import { expect, test } from '@playwright/test'

declare global {
  interface Window {
    __indicatorIntervals: Set<number>
  }
}

test('保存時刻は経過と再表示に追従し、新しい保存で更新される', async ({ page }) => {
  await page.goto('/')
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
        return Boolean(usePersistenceStore.getState().projectMetadata)
      }),
    )
    .toBe(true)
  await page.clock.install({ time: new Date('2026-01-01T12:00:00Z') })
  await page.evaluate(async () => {
    const setInterval = window.setInterval.bind(window)
    const clearInterval = window.clearInterval.bind(window)
    window.__indicatorIntervals = new Set()
    window.setInterval = (handler, timeout, ...args) => {
      const id = setInterval(handler, timeout, ...args)
      window.__indicatorIntervals.add(id)
      return id
    }
    window.clearInterval = (id) => {
      window.__indicatorIntervals.delete(id)
      clearInterval(id)
    }
    const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
    usePersistenceStore.setState({ saveStatus: 'saved', lastSavedAt: new Date() })
    const { mountSaveIndicator } = await import('/e2e/saveIndicatorFixture.tsx')
    mountSaveIndicator()
  })
  await expect(page.getByText('Saved Just now', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.__indicatorIntervals.size)).toBeGreaterThan(0)

  await page.clock.fastForward('01:00')
  await expect(page.getByText('Saved 1m ago', { exact: true })).toBeVisible()
  await page.clock.fastForward('59:00')
  await expect(page.getByText('Saved 1h ago', { exact: true })).toBeVisible()
  await page.clock.fastForward('23:00:00')
  const savedDate = await page.evaluate(() => new Date('2026-01-01T12:00:00Z').toLocaleDateString())
  await expect(page.getByText(`Saved ${savedDate}`, { exact: true })).toBeVisible()

  await page.evaluate(async () => {
    const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
    usePersistenceStore.setState({ lastSavedAt: new Date() })
  })
  await expect(page.getByText('Saved Just now', { exact: true })).toBeVisible()

  await page.evaluate(async () => {
    const { unmountSaveIndicator } = await import('/e2e/saveIndicatorFixture.tsx')
    unmountSaveIndicator()
  })
  expect(await page.evaluate(() => window.__indicatorIntervals.size)).toBe(0)
  await page.clock.fastForward('02:00')
  await page.evaluate(async () => {
    const { mountSaveIndicator } = await import('/e2e/saveIndicatorFixture.tsx')
    mountSaveIndicator()
  })
  await expect(page.getByText('Saved 2m ago', { exact: true })).toBeVisible()

  // 停止中に時刻だけが進んだ場合も、タブへ戻った時に追従する。
  await page.clock.setSystemTime(new Date('2026-01-02T12:07:00Z'))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(page.getByText('Saved 7m ago', { exact: true })).toBeVisible()
})
