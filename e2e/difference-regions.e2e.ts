import path from 'node:path'

import { expect, test } from '@playwright/test'

declare global {
  interface Window {
    __differenceRegionsTestCounters: {
      analysisRequests: number
      mediaSourceDraws: number
    }
  }
}

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

async function overlaysStayAlignedWithSources(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const overlays = Array.from(
      document.querySelectorAll('[data-testid="difference-regions-overlay"]'),
    )
    const sources = [
      document.querySelector('video[data-track="a"]'),
      document.querySelector('canvas[data-track="b"]'),
    ]
    if (overlays.length !== 2 || sources.length !== 2) return false

    return sources.every((source, index) => {
      const overlay = overlays[index]
      if (
        !(overlay instanceof SVGSVGElement) ||
        (!(source instanceof HTMLVideoElement) && !(source instanceof HTMLCanvasElement))
      ) {
        return false
      }

      const overlayBounds = overlay.getBoundingClientRect()
      const sourceBounds = source.getBoundingClientRect()
      return (
        Math.abs(overlayBounds.x - sourceBounds.x) < 1 &&
        Math.abs(overlayBounds.y - sourceBounds.y) < 1 &&
        Math.abs(overlayBounds.width - sourceBounds.width) < 1 &&
        Math.abs(overlayBounds.height - sourceBounds.height) < 1
      )
    })
  })
}

test('shows difference regions only while playback is paused', async ({ page }) => {
  await page.addInitScript(() => {
    const counters = { analysisRequests: 0, mediaSourceDraws: 0 }
    Object.defineProperty(window, '__differenceRegionsTestCounters', { value: counters })

    const mediaFrameContexts = new WeakSet<CanvasRenderingContext2D>()
    const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'drawImage', {
      configurable: true,
      value: function (this: CanvasRenderingContext2D, ...args: unknown[]) {
        const source = args[0]
        if (
          (source instanceof HTMLVideoElement || source instanceof HTMLCanvasElement) &&
          (source.dataset.track === 'a' || source.dataset.track === 'b')
        ) {
          mediaFrameContexts.add(this)
        }
        return Reflect.apply(originalDrawImage, this, args)
      },
    })

    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'getImageData', {
      configurable: true,
      value: function (this: CanvasRenderingContext2D, ...args: number[]) {
        if (mediaFrameContexts.delete(this)) counters.mediaSourceDraws += 1
        return Reflect.apply(originalGetImageData, this, args)
      },
    })

    const differenceWorkers = new WeakSet<Worker>()
    const NativeWorker = window.Worker
    window.Worker = new Proxy(NativeWorker, {
      construct(target, args, newTarget) {
        const worker = Reflect.construct(target, args, newTarget) as Worker
        if (String(args[0]).includes('frameDifference.worker')) differenceWorkers.add(worker)
        return worker
      },
    })

    const originalWorkerPostMessage = Worker.prototype.postMessage
    Object.defineProperty(Worker.prototype, 'postMessage', {
      configurable: true,
      value: function (message: unknown, ...transfer: unknown[]) {
        if (
          differenceWorkers.has(this) &&
          typeof message === 'object' &&
          message !== null &&
          'type' in message
        ) {
          if ((message as { type?: unknown }).type === 'analyze') {
            counters.analysisRequests += 1
          }
        }
        return Reflect.apply(originalWorkerPostMessage, this, [message, ...transfer])
      },
    })
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.keyboard.press('Digit1')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()

  await uploadToTrack(page, 'Media A', 'difference-a.webm')
  await uploadToTrack(page, 'Media B', 'difference-b.mov')
  await expect(page.getByText('Complete', { exact: true }).first()).toBeVisible({ timeout: 60_000 })

  const nextDifference = page.getByRole('button', { name: 'Next highlighted interval' })
  await expect(nextDifference).toBeEnabled()
  await nextDifference.click()

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const highlightingToggle = page.getByRole('button', { name: /Highlighting On/ })
  await expect(highlightingToggle).toHaveAttribute('aria-pressed', 'true')

  const overlay = page.getByTestId('difference-regions-overlay')
  const videoA = page.locator('video[data-track="a"]').first()
  const proResB = page.locator('canvas[data-track="b"]').first()
  await expect(videoA).toHaveAttribute('data-frame-presented-supported', 'true')
  await expect(videoA).toHaveAttribute('data-frame-ready', 'true', { timeout: 10_000 })
  await expect(videoA).toHaveAttribute('data-frame-presented-media-time', /.+/)
  await expect(proResB).toHaveAttribute('data-frame-ready', 'true', { timeout: 10_000 })
  await expect(proResB).toHaveAttribute('data-frame-requested-media-time', /.+/)

  const initialSeekGeneration = Number(
    await videoA.getAttribute('data-frame-presented-seek-generation'),
  )
  await expect(overlay.first()).toBeVisible({ timeout: 10_000 })

  for (let index = 0; index < 8; index += 1) {
    await page.getByTitle('Next frame (→)').click()
  }
  await expect
    .poll(
      () =>
        videoA.evaluate((video) => {
          const presentedTime = Number(video.dataset.framePresentedCurrentTime)
          return (
            video.dataset.frameReady === 'true' &&
            Number.isFinite(presentedTime) &&
            Math.abs(presentedTime - video.currentTime) <= 0.01
          )
        }),
      { timeout: 10_000 },
    )
    .toBe(true)
  await expect
    .poll(async () => Number(await videoA.getAttribute('data-frame-presented-seek-generation')))
    .toBeGreaterThan(initialSeekGeneration)
  await expect
    .poll(() =>
      proResB.evaluate((canvas) => {
        const start = Number(canvas.dataset.frameMediaTime)
        const end = Number(canvas.dataset.frameMediaEndTime)
        const requested = Number(canvas.dataset.frameRequestedMediaTime)
        const seekGeneration = Number(canvas.dataset.frameSeekGeneration)
        const presentedGeneration = Number(canvas.dataset.framePresentedGeneration)
        return (
          canvas.dataset.frameReady === 'true' &&
          Number.isFinite(start) &&
          Number.isFinite(end) &&
          Number.isFinite(requested) &&
          Number.isFinite(seekGeneration) &&
          presentedGeneration === seekGeneration &&
          Boolean(canvas.dataset.frameMediaId) &&
          Boolean(canvas.dataset.frameClipId) &&
          requested >= start
        )
      }),
    )
    .toBe(true)
  await expect(overlay.first()).toBeVisible({ timeout: 10_000 })

  await page.getByTitle('Go to start (Home)').click()
  await expect(overlay.first()).toBeVisible({ timeout: 10_000 })

  await page.getByTitle('Toggle playback (Space)').click()
  await expect(
    page.getByText('Pause playback to highlight differences on the current frame'),
  ).toBeVisible()
  await expect(overlay).toHaveCount(0)
  const frameDrawsDuringPlayback = await page.evaluate(
    () => window.__differenceRegionsTestCounters.mediaSourceDraws,
  )
  const analysisRequestsDuringPlayback = await page.evaluate(
    () => window.__differenceRegionsTestCounters.analysisRequests,
  )
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => window.__differenceRegionsTestCounters.mediaSourceDraws)).toBe(
    frameDrawsDuringPlayback,
  )
  expect(await page.evaluate(() => window.__differenceRegionsTestCounters.analysisRequests)).toBe(
    analysisRequestsDuringPlayback,
  )

  await page.getByTitle('Toggle playback (Space)').click()
  await expect(page.getByTitle('Toggle playback (Space)')).toContainText('Play')
  await expect.poll(() => videoA.evaluate((video) => video.paused)).toBe(true)
  await expect(overlay.first()).toBeVisible({ timeout: 10_000 })

  await page.getByTitle('Go to start (Home)').click()
  await expect(overlay.first()).toBeVisible({ timeout: 10_000 })
  await page.evaluate(() => {
    let callbackId = 1_000_000
    Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
      configurable: true,
      value: () => callbackId++,
    })
  })

  await page.getByRole('tab', { name: 'Side by Side comparison mode' }).click()
  try {
    await expect(overlay).toHaveCount(2, { timeout: 10_000 })
  } catch (error) {
    console.log(
      'Side by Side frame state at overlay timeout',
      JSON.stringify(
        await page.evaluate(() => ({
          sources: Array.from(
            document.querySelectorAll('video[data-track], canvas[data-track]'),
          ).map((source) => ({
            tag: source.tagName,
            track: source.dataset.track,
            dataset: { ...source.dataset },
            ...(source instanceof HTMLVideoElement
              ? {
                  currentTime: source.currentTime,
                  paused: source.paused,
                  seeking: source.seeking,
                  readyState: source.readyState,
                  videoWidth: source.videoWidth,
                }
              : {
                  width: (source as HTMLCanvasElement).width,
                  height: (source as HTMLCanvasElement).height,
                }),
          })),
          waitingForFrames: document.body.innerText.includes('Waiting for the paused A/B frames'),
        })),
      ),
    )
    throw error
  }
  await expect(videoA).toHaveAttribute('data-frame-ready', 'false')
  await expect(videoA).toHaveAttribute('data-frame-source-media-id', /.+/)
  await expect(videoA).toHaveAttribute('data-frame-source-clip-id', /.+/)
  await expect
    .poll(() =>
      videoA.evaluate((video) => {
        const generation = video.dataset.frameSeekGeneration
        return (
          video.currentTime === 0 &&
          generation !== undefined &&
          video.dataset.frameInitialFrameGeneration === generation
        )
      }),
    )
    .toBe(true)
  await expect(overlay.nth(0)).toBeVisible()
  await expect(overlay.nth(1)).toBeVisible()

  const geometry = await overlay.evaluateAll((svgs) =>
    svgs.map((svg) => ({
      viewBox: svg.getAttribute('viewBox'),
      rects: Array.from(svg.querySelectorAll('rect')).map((rect) => [
        rect.getAttribute('x'),
        rect.getAttribute('y'),
        rect.getAttribute('width'),
        rect.getAttribute('height'),
      ]),
    })),
  )
  expect(geometry[0]).toEqual(geometry[1])

  await page.setViewportSize({ width: 900, height: 1100 })
  expect(await overlaysStayAlignedWithSources(page)).toBe(true)

  const videoBounds = await videoA.boundingBox()
  expect(videoBounds).not.toBeNull()
  await page.mouse.move(
    videoBounds!.x + videoBounds!.width / 2,
    videoBounds!.y + videoBounds!.height / 2,
  )
  await page.mouse.wheel(0, -100)
  await expect(page.getByText('125%', { exact: true })).toBeVisible()
  expect(await overlaysStayAlignedWithSources(page)).toBe(true)

  const zoomedVideoBounds = await videoA.boundingBox()
  expect(zoomedVideoBounds).not.toBeNull()
  const centerX = zoomedVideoBounds!.x + zoomedVideoBounds!.width / 2
  const centerY = zoomedVideoBounds!.y + zoomedVideoBounds!.height / 2
  await page.mouse.move(centerX, centerY)
  await page.mouse.down()
  await page.mouse.move(centerX + 35, centerY + 20, { steps: 3 })
  await page.mouse.up()
  expect(await overlaysStayAlignedWithSources(page)).toBe(true)
})
