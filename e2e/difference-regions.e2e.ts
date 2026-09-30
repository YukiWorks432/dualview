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

test('shows difference regions only while playback is paused', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()

  await uploadToTrack(page, 'Media A', 'difference-a.webm')
  await uploadToTrack(page, 'Media B', 'difference-b.mov')
  await expect(page.getByText('Complete', { exact: true }).first()).toBeVisible({ timeout: 60_000 })

  const nextDifference = page.getByRole('button', { name: 'Next highlighted interval' })
  await expect(nextDifference).toBeEnabled()
  await nextDifference.click()

  await page.getByRole('button', { name: /Highlighting Off/ }).click()

  const overlay = page.getByTestId('difference-regions-overlay')
  await expect(overlay.first()).toBeVisible({ timeout: 10_000 })

  await page.getByTitle('Toggle playback (Space)').click()
  await expect(
    page.getByText('Pause playback to highlight differences on the current frame'),
  ).toBeVisible()
  await expect(overlay).toHaveCount(0)

  await page.getByTitle('Toggle playback (Space)').click()
  await expect(overlay.first()).toBeVisible({ timeout: 10_000 })
})
