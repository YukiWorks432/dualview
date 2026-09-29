import path from 'node:path'

import { expect, test } from '@playwright/test'

async function uploadToTrack(
  page: import('@playwright/test').Page,
  label: string,
  fileName: string,
) {
  const chooserReady = page.waitForEvent('filechooser')
  await page.getByText(label, { exact: true }).last().click()
  const chooser = await chooserReady
  await chooser.setFiles(path.join(process.cwd(), 'e2e', 'fixtures', fileName))
}

test('compares uploaded A/B video frames without moving the shared playhead during analysis', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  await expect(page.getByText('A/B difference', { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: /Read-only A\/B difference lane/ })).toBeVisible()
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()

  await uploadToTrack(page, 'Media A', 'difference-a.webm')
  await uploadToTrack(page, 'Media B', 'difference-b.mov')
  await expect(page.getByRole('button', { name: 'Analyze', exact: true })).toBeEnabled()

  const playheadTime = page.getByTestId('timeline-current-time')
  await expect(playheadTime).toBeVisible()
  await page.evaluate(() => {
    const timeDisplay = document.querySelector('[data-testid="timeline-current-time"]')
    if (!timeDisplay) throw new Error('Timeline time display was not found')
    ;(window as Window & { timelineTimeSamples?: string[] }).timelineTimeSamples = [
      timeDisplay.textContent ?? '',
    ]
    new MutationObserver(() => {
      ;(window as Window & { timelineTimeSamples?: string[] }).timelineTimeSamples?.push(
        timeDisplay.textContent ?? '',
      )
    }).observe(timeDisplay, { childList: true, subtree: true, characterData: true })
  })
  await page.getByRole('button', { name: 'Analyze', exact: true }).click()
  await expect(page.getByText('Complete', { exact: true }).first()).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Next highlighted interval' })).toBeEnabled()
  const sampledTimes = await page.evaluate(
    () => (window as Window & { timelineTimeSamples?: string[] }).timelineTimeSamples ?? [],
  )
  expect(new Set(sampledTimes).size).toBe(1)
})
