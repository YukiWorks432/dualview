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

async function waitForAnalysisProgress(page: import('@playwright/test').Page) {
  const status = page.getByText(/^Analyzing \d+%$/).first()
  await expect
    .poll(
      async () => {
        const text = await status.textContent()
        const match = /Analyzing (\d+)%/.exec(text ?? '')
        return match ? Number(match[1]) : -1
      },
      { timeout: 30_000, intervals: [100, 250, 500] },
    )
    .toBeGreaterThanOrEqual(5)
  const text = await status.textContent()
  const progress = Number(/Analyzing (\d+)%/.exec(text ?? '')?.[1] ?? -1)
  expect(progress).toBeLessThan(100)
  return progress
}

async function sampleFrameDifferenceRates(
  lane: import('@playwright/test').Locator,
  duration: number,
  frameCount: number,
) {
  const laneWidth = await lane.evaluate((canvas) =>
    Number.parseFloat(canvas.parentElement?.style.width ?? '0'),
  )
  const titles: string[] = []
  for (let index = 0; index < frameCount; index++) {
    await lane.evaluate(
      (canvas, { index, frameCount, laneWidth }) => {
        const rect = canvas.getBoundingClientRect()
        const clientX = rect.left + (index + 0.5) * (laneWidth / frameCount)
        canvas.dispatchEvent(
          new MouseEvent('mousemove', { bubbles: true, clientX, clientY: rect.top + 16 }),
        )
      },
      { index, frameCount, laneWidth },
    )
    // Wait for the requested interval, not just a generic or previous frame's title.
    const sampleTime = ((index + 0.5) * duration) / frameCount
    await expect
      .poll(async () => {
        const title = await lane.getAttribute('title')
        const interval = /^(?<start>[\d.]+)–(?<end>[\d.]+)s.*Frame difference: [\d.]+%/.exec(
          title ?? '',
        )
        return (
          interval !== null &&
          Number(interval.groups!.start) <= sampleTime &&
          sampleTime < Number(interval.groups!.end)
        )
      })
      .toBe(true)
    titles.push((await lane.getAttribute('title'))!)
  }
  expect(titles).toHaveLength(frameCount)
  expect(new Set(titles).size).toBe(frameCount)
  return titles.map((title) => {
    const match = /Frame difference: ([\d.]+)%/.exec(title)
    expect(match, title).not.toBeNull()
    return Number(match?.[1] ?? 0)
  })
}

test('compares uploaded A/B video frames without moving the shared playhead during analysis', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  await expect(page.getByRole('img', { name: /Read-only A\/B difference lane/ })).toBeVisible()
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()

  await uploadToTrack(page, 'Media A', 'difference-a.webm')
  await expect(page.getByText('Not analyzed', { exact: true }).first()).toBeVisible()

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
  await uploadToTrack(page, 'Media B', 'difference-b.mov')
  await expect(page.getByText('Complete', { exact: true }).first()).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Next highlighted interval' })).toBeEnabled()
  const sampledTimes = await page.evaluate(
    () => (window as Window & { timelineTimeSamples?: string[] }).timelineTimeSamples ?? [],
  )
  expect(new Set(sampledTimes).size).toBe(1)
})

test('restarts automatic analysis after a comparison track is emptied and restored', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()

  await uploadToTrack(page, 'Media A', 'long-quality-high.webm')
  await page.getByRole('button', { name: 'Analysis resolution', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Full', exact: true }).click()
  await uploadToTrack(page, 'Media B', 'long-quality-low.webm')

  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
  await waitForAnalysisProgress(page)

  await page.locator('[data-clip]').nth(1).click()
  await page.keyboard.press('Delete')
  await expect(page.locator('[data-clip]')).toHaveCount(1)

  const mediaCard = page.locator('[draggable="true"]').filter({ hasText: 'long-quality-low.webm' })
  await mediaCard.getByTitle('Add to Track B').click()
  await expect(page.locator('[data-clip]')).toHaveCount(2)
  await expect(page.getByText('Complete', { exact: true }).first()).toBeVisible({
    timeout: 60_000,
  })
})

test('restarts manual analysis after a comparison track is emptied and restored', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()

  await uploadToTrack(page, 'Media A', 'long-quality-high.webm')
  await page.getByRole('button', { name: 'Analysis resolution', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Full', exact: true }).click()
  await uploadToTrack(page, 'Media B', 'long-quality-low.webm')
  await expect(page.getByText('Complete', { exact: true }).first()).toBeVisible({
    timeout: 60_000,
  })

  await page.getByRole('button', { name: 'Analyze', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
  await waitForAnalysisProgress(page)

  await page.locator('[data-clip]').nth(1).click()
  await page.keyboard.press('Delete')
  await expect(page.locator('[data-clip]')).toHaveCount(1)

  const mediaCard = page.locator('[draggable="true"]').filter({
    hasText: 'long-quality-low.webm',
  })
  await mediaCard.getByTitle('Add to Track B').click()
  await expect(page.locator('[data-clip]')).toHaveCount(2)
  await expect(page.getByText('Complete', { exact: true }).first()).toBeVisible({
    timeout: 60_000,
  })
})

test('keeps a one-frame change and exposes its exact interval on hover', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()

  await uploadToTrack(page, 'Media A', 'difference-a.webm')
  await uploadToTrack(page, 'Media B', 'difference-brief.webm')
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
  await expect(page.getByText('Complete', { exact: true }).first()).toBeVisible({ timeout: 60_000 })

  // Give every source frame several CSS pixels so mouse coordinates cannot alias neighbors.
  for (let step = 0; step < 10; step++) await page.keyboard.press('Control+Equal')
  const lane = page.getByRole('img', { name: /Read-only A\/B difference lane/ })
  await expect
    .poll(() =>
      lane.evaluate((canvas) => Number.parseFloat(canvas.parentElement?.style.width ?? '0')),
    )
    .toBeGreaterThan(450)
  const duration = await page
    .locator('video[data-track="a"]')
    .first()
    .evaluate((video: HTMLVideoElement) => video.duration)
  const frameCount = 45
  const measuredRates = await sampleFrameDifferenceRates(lane, duration, frameCount)
  const peakRate = Math.max(...measuredRates)
  console.log(
    `Compression calibration peak across ${frameCount} source frames: ${peakRate.toFixed(2)}%`,
  )
  expect(peakRate).toBeLessThan(2)
  await expect(page.getByRole('button', { name: 'Next highlighted interval' })).toBeDisabled()
})

test('recomputes compression-only highlights when the area threshold changes', async ({ page }) => {
  await page.addInitScript(() => {
    const counters = { analysisRequests: 0 }
    Object.defineProperty(window, '__timelineAnalysisCounters', { value: counters })
    const workers = new WeakSet<Worker>()
    window.Worker = new Proxy(window.Worker, {
      construct(target, args, newTarget) {
        const worker = Reflect.construct(target, args, newTarget) as Worker
        if (String(args[0]).includes('timelineDiff.worker')) workers.add(worker)
        return worker
      },
    })
    const original = Worker.prototype.postMessage
    Worker.prototype.postMessage = function (message, ...transfer) {
      if (workers.has(this) && message?.type === 'analyze') counters.analysisRequests++
      return Reflect.apply(original, this, [message, ...transfer])
    }
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()

  await uploadToTrack(page, 'Media A', 'pattern-quality-high.webm')
  await uploadToTrack(page, 'Media B', 'pattern-quality-low.webm')
  await expect(page.getByText('Complete', { exact: true }).first()).toBeVisible({ timeout: 60_000 })

  const lane = page.getByRole('img', { name: /Read-only A\/B difference lane/ })
  const duration = await page
    .locator('video[data-track="a"]')
    .first()
    .evaluate((video: HTMLVideoElement) => video.duration)
  const measuredRates = await sampleFrameDifferenceRates(lane, duration, 12)
  const peakRate = Math.max(...measuredRates)
  console.log(`Generated-pattern compression calibration peak: ${peakRate.toFixed(2)}%`)
  expect(peakRate).toBeGreaterThan(2)
  const nextInterval = page.getByRole('button', { name: 'Next highlighted interval' })
  await expect(nextInterval).toBeEnabled()

  const requestsBefore = await page.evaluate(
    () =>
      (window as Window & { __timelineAnalysisCounters?: { analysisRequests: number } })
        .__timelineAnalysisCounters!.analysisRequests,
  )
  expect(requestsBefore).toBeGreaterThan(0)
  const areaThreshold = page.getByRole('slider', { name: 'Highlight area threshold' })
  await areaThreshold.focus()
  for (let step = 0; step < 6; step++) await areaThreshold.press('ArrowRight')
  await expect(areaThreshold).toHaveValue('0.05')
  await expect(page.getByText('Complete', { exact: true }).first()).toBeVisible()
  await expect(nextInterval).toBeDisabled()
  // Wait beyond the automatic-analysis debounce; a restart must not hide behind Complete.
  await page.waitForTimeout(500)
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __timelineAnalysisCounters?: { analysisRequests: number } })
          .__timelineAnalysisCounters!.analysisRequests,
    ),
  ).toBe(requestsBefore)
})

test('cancels a high-resolution analysis and keeps partial results', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()

  await uploadToTrack(page, 'Media A', 'long-quality-high.webm')
  await page.getByRole('button', { name: 'Analysis resolution', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Full', exact: true }).click()
  await uploadToTrack(page, 'Media B', 'long-quality-low.webm')

  const cancelButton = page.getByRole('button', { name: 'Cancel' })
  await expect(cancelButton).toBeVisible()
  await waitForAnalysisProgress(page)
  await cancelButton.click()
  await expect(page.getByText('Partial results', { exact: true }).first()).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByRole('button', { name: 'Analyze', exact: true })).toBeEnabled()

  const lane = page.getByRole('img', { name: /Read-only A\/B difference lane/ })
  const pixelCounts = await lane.evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Difference lane canvas was not available')
    const { data, width } = context.getImageData(0, 1, canvas.width, 1)
    let analyzedNeutral = 0
    let unanalyzed = 0
    for (let offset = 0; offset < width * 4; offset += 4) {
      const red = data[offset]
      const green = data[offset + 1]
      const blue = data[offset + 2]
      if (red >= 45 && red <= 60 && green >= 58 && green <= 73 && blue >= 68 && blue <= 85) {
        analyzedNeutral++
      }
      if (red >= 20 && red <= 30 && green >= 29 && green <= 39 && blue >= 38 && blue <= 48) {
        unanalyzed++
      }
    }
    return { analyzedNeutral, unanalyzed }
  })
  expect(pixelCounts.analyzedNeutral).toBeGreaterThan(0)
  expect(pixelCounts.unanalyzed).toBeGreaterThan(0)
})

test('marks results outdated when clip media is replaced during analysis', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()

  await uploadToTrack(page, 'Media A', 'long-quality-high.webm')
  await page.getByRole('button', { name: 'Analysis resolution', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Full', exact: true }).click()
  await uploadToTrack(page, 'Media B', 'long-quality-low.webm')
  await waitForAnalysisProgress(page)

  await page.locator('[data-clip]').first().click({ button: 'right' })
  await page.getByText('Replace Media', { exact: true }).hover()
  await page.getByRole('button', { name: 'long-quality-low.webm', exact: true }).click()
  await expect(page.getByText('Outdated', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next highlighted interval' })).toBeDisabled()
})

test('clears session results after switching projects during analysis', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()

  await uploadToTrack(page, 'Media A', 'long-quality-high.webm')
  await page.getByRole('button', { name: 'Analysis resolution', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Full', exact: true }).click()
  await uploadToTrack(page, 'Media B', 'long-quality-low.webm')
  await waitForAnalysisProgress(page)

  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  const projectDialog = page.getByRole('dialog')
  await expect(projectDialog).toBeVisible()
  await projectDialog.getByRole('button', { name: 'New Project' }).click()
  await expect(page.getByText('Outdated', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next highlighted interval' })).toBeDisabled()
})

test('preserves a one-frame highlight after analyzing a long low-zoom sequence', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()

  await uploadToTrack(page, 'Media A', 'duration-75s-a.webm')
  await uploadToTrack(page, 'Media B', 'duration-75s-b.webm')
  await expect(page.getByText('Complete', { exact: true }).first()).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole('button', { name: 'Next highlighted interval' })).toBeEnabled()

  const lane = page.getByRole('img', { name: /Read-only A\/B difference lane/ })
  await lane.evaluate((canvas: HTMLCanvasElement) => {
    const laneWidth = Number.parseFloat(canvas.parentElement?.style.width ?? '0')
    const pixelsPerSecond = laneWidth / 75
    const rect = canvas.getBoundingClientRect()
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        clientX: rect.left + 30.02 * pixelsPerSecond,
        clientY: rect.top + 16,
      }),
    )
  })
  await expect(lane).toHaveAttribute('title', /30\.000–30\.042s.*100\.00%/)

  const zoomOut = page.locator('button:has(svg.lucide-zoom-out)')
  for (let step = 0; step < 30; step++) await zoomOut.click()
  await expect
    .poll(() =>
      lane.evaluate((canvas: HTMLCanvasElement) => {
        const context = canvas.getContext('2d')
        if (!context) return 0
        const { data, width } = context.getImageData(0, 0, canvas.width, 1)
        let highlightedPixels = 0
        for (let offset = 0; offset < width * 4; offset += 4) {
          if (data[offset] > 120 && data[offset] > data[offset + 1] * 1.5) highlightedPixels++
        }
        return highlightedPixels
      }),
    )
    .toBeGreaterThan(0)
})

test('measures both resolutions on long high-resolution video and preserves lane interactions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()

  await uploadToTrack(page, 'Media A', 'long-quality-high.webm')
  const areaThreshold = page.getByRole('slider', { name: 'Highlight area threshold' })
  await areaThreshold.focus()
  for (let step = 0; step < 4; step++) await areaThreshold.press('ArrowLeft')
  await expect(areaThreshold).toHaveValue('0')

  const resolution = page.getByRole('button', { name: 'Analysis resolution', exact: true })
  const analyze = page.getByRole('button', { name: 'Analyze', exact: true })
  const timings: Record<'standard' | 'detailed', number> = { standard: 0, detailed: 0 }

  const standardStartedAt = Date.now()
  await uploadToTrack(page, 'Media B', 'long-quality-low.webm')
  await expect(page.getByText('Complete', { exact: true }).first()).toBeVisible({
    timeout: 60_000,
  })
  timings.standard = Date.now() - standardStartedAt

  await resolution.click()
  await page.getByRole('menuitemradio', { name: 'Full', exact: true }).click()
  const detailedStartedAt = Date.now()
  await analyze.click()
  await expect(page.getByText('Complete', { exact: true }).first()).toBeVisible({
    timeout: 60_000,
  })
  timings.detailed = Date.now() - detailedStartedAt

  console.log(
    `1280x720, 24 fps, 4 s (96 frames): standard=${timings.standard} ms; detailed=${timings.detailed} ms`,
  )

  const nextInterval = page.getByRole('button', { name: 'Next highlighted interval' })
  await expect(nextInterval).toBeEnabled()
  const secondMode = page.getByRole('tablist', { name: 'Comparison modes' }).getByRole('tab').nth(1)
  await secondMode.click()
  await expect(secondMode).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Complete', { exact: true }).first()).toBeVisible()

  const lane = page.getByRole('img', { name: /Read-only A\/B difference lane/ })
  const zoomIn = page.locator('button:has(svg.lucide-zoom-in)')
  for (let step = 0; step < 14; step++) await zoomIn.click()

  const scrollContainer = lane.locator('xpath=../../..')
  const scrollState = await scrollContainer.evaluate((element) => {
    const container = element as HTMLDivElement
    container.scrollLeft = container.scrollWidth
    return { scrollLeft: container.scrollLeft, clientWidth: container.clientWidth }
  })
  expect(scrollState.scrollLeft).toBeGreaterThan(0)

  await lane.evaluate((canvas: HTMLCanvasElement) => {
    const laneWidth = Number.parseFloat(canvas.parentElement?.style.width ?? '0')
    const pixelsPerSecond = laneWidth / 4
    const rect = canvas.getBoundingClientRect()
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        clientX: rect.left + 3.75 * pixelsPerSecond,
        clientY: rect.top + 16,
      }),
    )
  })
  await expect(lane).toHaveAttribute('title', /3\.\d{3}–3\.\d{3}s/)

  const zoomOut = page.locator('button:has(svg.lucide-zoom-out)')
  for (let step = 0; step < 30; step++) await zoomOut.click()
  await expect
    .poll(() =>
      lane.evaluate((canvas: HTMLCanvasElement) => {
        const context = canvas.getContext('2d')
        if (!context) return 0
        const { data, width } = context.getImageData(0, 0, canvas.width, 1)
        let highlightedPixels = 0
        for (let offset = 0; offset < width * 4; offset += 4) {
          if (data[offset] > 120 && data[offset] > data[offset + 1] * 1.5) highlightedPixels++
        }
        return highlightedPixels
      }),
    )
    .toBeGreaterThan(0)
})
