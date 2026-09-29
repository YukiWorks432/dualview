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

test('keeps a one-frame change and exposes its exact interval on hover', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()

  await uploadToTrack(page, 'Media A', 'difference-a.webm')
  await uploadToTrack(page, 'Media B', 'difference-brief.webm')
  await page.getByRole('button', { name: 'Analyze', exact: true }).click()
  await expect(page.getByText('Complete', { exact: true }).first()).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Next highlighted interval' })).toBeEnabled()

  const lane = page.getByRole('img', { name: /Read-only A\/B difference lane/ })
  await lane.hover({ position: { x: 19, y: 16 } })
  await expect(lane).toHaveAttribute('title', /0\.250–0\.500s.*100\.00%/)
})

test('calibrates compression-only differences on the default thresholds', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()

  await uploadToTrack(page, 'Media A', 'quality-high.webm')
  await uploadToTrack(page, 'Media B', 'quality-low.webm')
  await page.getByRole('button', { name: 'Analyze', exact: true }).click()
  await expect(page.getByText('Complete', { exact: true }).first()).toBeVisible({ timeout: 60_000 })

  const lane = page.getByRole('img', { name: /Read-only A\/B difference lane/ })
  const laneWidth = await lane.evaluate((canvas) =>
    Number.parseFloat(canvas.parentElement?.style.width ?? '0'),
  )
  const frameCount = 45
  const titles = await lane.evaluate(
    async (canvas, { frameCount, laneWidth }) => {
      const rect = canvas.getBoundingClientRect()
      const sampledTitles: string[] = []
      for (let index = 0; index < frameCount; index++) {
        const clientX = rect.left + (index + 0.5) * (laneWidth / frameCount)
        canvas.dispatchEvent(
          new MouseEvent('mousemove', { bubbles: true, clientX, clientY: rect.top + 16 }),
        )
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        sampledTitles.push(canvas.title)
      }
      return sampledTitles
    },
    { frameCount, laneWidth },
  )
  expect(titles).toHaveLength(frameCount)
  const measuredRates = titles.map((title) => {
    const match = /Frame difference: ([\d.]+)%/.exec(title)
    expect(match, title).not.toBeNull()
    return Number(match?.[1] ?? 0)
  })
  const peakRate = Math.max(...measuredRates)
  console.log(
    `Compression calibration peak across ${frameCount} source frames: ${peakRate.toFixed(2)}%`,
  )
  expect(peakRate).toBeLessThan(2)
  await expect(page.getByRole('button', { name: 'Next highlighted interval' })).toBeDisabled()
})

test('recomputes compression-only highlights when the area threshold changes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()

  await uploadToTrack(page, 'Media A', 'pattern-quality-high.webm')
  await uploadToTrack(page, 'Media B', 'pattern-quality-low.webm')
  await page.getByRole('button', { name: 'Analyze', exact: true }).click()
  await expect(page.getByText('Complete', { exact: true }).first()).toBeVisible({ timeout: 60_000 })

  const lane = page.getByRole('img', { name: /Read-only A\/B difference lane/ })
  const laneWidth = await lane.evaluate((canvas) =>
    Number.parseFloat(canvas.parentElement?.style.width ?? '0'),
  )
  const titles = await lane.evaluate(async (canvas, laneWidth) => {
    const rect = canvas.getBoundingClientRect()
    const sampledTitles: string[] = []
    for (let index = 0; index < 12; index++) {
      const clientX = rect.left + (index + 0.5) * (laneWidth / 12)
      canvas.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, clientX, clientY: rect.top + 16 }),
      )
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      sampledTitles.push(canvas.title)
    }
    return sampledTitles
  }, laneWidth)
  const measuredRates = titles.map((title) => {
    const match = /Frame difference: ([\d.]+)%/.exec(title)
    expect(match, title).not.toBeNull()
    return Number(match?.[1] ?? 0)
  })
  const peakRate = Math.max(...measuredRates)
  console.log(`Generated-pattern compression calibration peak: ${peakRate.toFixed(2)}%`)
  expect(peakRate).toBeGreaterThan(2)
  const nextInterval = page.getByRole('button', { name: 'Next highlighted interval' })
  await expect(nextInterval).toBeEnabled()

  const areaThreshold = page.getByRole('slider', { name: 'Highlight area threshold' })
  await areaThreshold.focus()
  for (let step = 0; step < 6; step++) await areaThreshold.press('ArrowRight')
  await expect(areaThreshold).toHaveValue('0.05')
  await expect(page.getByText('Complete', { exact: true }).first()).toBeVisible()
  await expect(nextInterval).toBeDisabled()
})
