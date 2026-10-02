import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { expect, test, type Page, type TestInfo } from '@playwright/test'

declare global {
  interface Window {
    __exportResources: {
      encoders: VideoEncoder[]
      recorders: MediaRecorder[]
      tracks: MediaStreamTrack[]
      workers: Set<Worker>
      frames: Set<VideoFrame>
    }
  }
}

async function observeResources(page: Page) {
  await page.addInitScript(() => {
    const resources = {
      encoders: [] as VideoEncoder[],
      recorders: [] as MediaRecorder[],
      tracks: [] as MediaStreamTrack[],
      workers: new Set<Worker>(),
      frames: new Set<VideoFrame>(),
    }
    window.__exportResources = resources
    window.VideoEncoder = new Proxy(window.VideoEncoder, {
      construct(target, args) {
        const encoder = Reflect.construct(target, args) as VideoEncoder
        resources.encoders.push(encoder)
        return encoder
      },
    })
    window.VideoFrame = new Proxy(window.VideoFrame, {
      construct(target, args) {
        const frame = Reflect.construct(target, args) as VideoFrame
        resources.frames.add(frame)
        const close = frame.close.bind(frame)
        frame.close = () => {
          resources.frames.delete(frame)
          close()
        }
        return frame
      },
    })
    window.MediaRecorder = new Proxy(window.MediaRecorder, {
      construct(target, args) {
        const recorder = Reflect.construct(target, args) as MediaRecorder
        resources.recorders.push(recorder)
        resources.tracks.push(...(args[0] as MediaStream).getTracks())
        return recorder
      },
    })
    window.Worker = new Proxy(window.Worker, {
      construct(target, args) {
        const worker = Reflect.construct(target, args) as Worker
        if (String(args[0]).includes('gif.worker.js')) {
          resources.workers.add(worker)
          const terminate = worker.terminate.bind(worker)
          worker.terminate = () => {
            resources.workers.delete(worker)
            terminate()
          }
        }
        return worker
      },
    })
  })
}
async function released(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        encoders: window.__exportResources.encoders.filter((encoder) => encoder.state !== 'closed')
          .length,
        recorders: window.__exportResources.recorders.filter(
          (recorder) => recorder.state !== 'inactive',
        ).length,
        tracks: window.__exportResources.tracks.filter((track) => track.readyState !== 'ended')
          .length,
        workers: window.__exportResources.workers.size,
        frames: window.__exportResources.frames.size,
      })),
    )
    .toEqual({ encoders: 0, recorders: 0, tracks: 0, workers: 0, frames: 0 })
}
async function upload(
  page: Page,
  track: 'A' | 'B',
  file: string | { name: string; mimeType: string; buffer: Buffer },
) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByText(`Media ${track}`, { exact: true }).last().click()
  await (await chooser).setFiles(file)
}
async function prepareColors(page: Page) {
  await observeResources(page)
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  for (const [track, color] of [
    ['A', '#f02020'],
    ['B', '#2020f0'],
  ] as const) {
    const png = await page.evaluate((color) => {
      const canvas = document.createElement('canvas')
      canvas.width = 160
      canvas.height = 90
      const context = canvas.getContext('2d')!
      context.fillStyle = color
      context.fillRect(0, 0, 160, 90)
      return canvas.toDataURL('image/png').split(',')[1]
    }, color)
    await upload(page, track, {
      name: `${track}.png`,
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64'),
    })
  }
  await expect(page.locator('img[data-track="a"]').first()).toBeVisible()
  await expect(page.locator('img[data-track="b"]').first()).toBeVisible()
  // Short fixed clips keep artifact assertions independent of the image import default duration.
  await page.evaluate(async () => {
    const mediaPath = '/src/stores/mediaStore.ts'
    const timelinePath = '/src/stores/timelineStore.ts'
    const projectPath = '/src/stores/projectStore.ts'
    const { useMediaStore } = await import(mediaPath)
    const { useTimelineStore } = await import(timelinePath)
    const { useProjectStore } = await import(projectPath)
    useMediaStore.setState({
      files: useMediaStore.getState().files.map((file: object) => ({ ...file, duration: 1 })),
    })
    useTimelineStore.setState({
      duration: 1,
      tracks: useTimelineStore.getState().tracks.map((track: { clips: object[] }) => ({
        ...track,
        clips: track.clips.map((clip) => ({ ...clip, inPoint: 0, outPoint: 1, duration: 1 })),
      })),
    })
    useProjectStore
      .getState()
      .setExportSettings({ videoLoops: 1, sweepsPerLoop: 1, gifPreset: 'small' })
  })
  await page.getByTitle('Export (E)').click()
  await expect(page.getByRole('dialog')).toBeVisible()
}
async function download(page: Page, label: string, info: TestInfo, name: string) {
  const pending = page.waitForEvent('download')
  await page.getByRole('dialog').getByRole('button', { name: label, exact: true }).click()
  const artifact = await pending
  const file = info.outputPath(name)
  await artifact.saveAs(file)
  await info.attach(name, { path: file })
  return readFile(file)
}
async function inspectVideo(page: Page, bytes: Buffer, mime: string, time = 0.25) {
  return page.evaluate(
    async ({ bytes, mime, time }) => {
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }))
      const video = document.createElement('video')
      video.muted = true
      try {
        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve()
          video.onerror = () => reject(new Error('Artifact failed to decode'))
          video.src = url
        })
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve()
          video.currentTime = time
        })
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const context = canvas.getContext('2d')!
        context.drawImage(video, 0, 0)
        const pixel = (x: number) =>
          Array.from(
            context.getImageData(
              Math.round(canvas.width * x),
              Math.round(canvas.height * 0.5),
              1,
              1,
            ).data,
          )
        return {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
          left: pixel(0.2),
          right: pixel(0.9),
        }
      } finally {
        video.removeAttribute('src')
        video.load()
        URL.revokeObjectURL(url)
      }
    },
    { bytes: Array.from(bytes), mime, time },
  )
}
function isColor(pixel: number[], color: 'red' | 'blue') {
  const expected = color === 'red' ? [240, 32, 32] : [32, 32, 240]
  expected.forEach((channel, index) => expect(Math.abs(pixel[index] - channel)).toBeLessThan(35))
}

test('MP4 and GIF artifacts do not depend on WebM and release resources on repeated exports', async ({
  page,
}, info) => {
  await prepareColors(page)
  await page.evaluate(() => {
    MediaRecorder.isTypeSupported = () => false
  })
  const dialog = page.getByRole('dialog')
  for (const source of ['A Only', 'B Only', 'Comparison']) {
    await dialog.getByRole('button', { name: source, exact: true }).click()
    await dialog.getByRole('button', { name: 'MP4', exact: true }).click()
    const mp4 = await download(page, 'Export', info, `${source}.mp4`)
    expect(mp4.toString('ascii', 4, 8)).toBe('ftyp')
    const result = await inspectVideo(page, mp4, 'video/mp4')
    expect(result.width).toBe(1920)
    expect(result.height).toBe(1080)
    expect(result.duration).toBeCloseTo(1, 1)
    isColor(result.left, source === 'B Only' ? 'blue' : 'red')
    isColor(result.right, source === 'A Only' ? 'red' : 'blue')
    await released(page)
    await dialog.getByRole('button', { name: 'Export Another' }).click()
  }
  await dialog.getByRole('button', { name: 'GIF', exact: true }).click()
  await page.route('**/gif.worker.js', (route) => route.abort())
  await dialog.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('GIF worker failed')
  await released(page)
  await page.unroute('**/gif.worker.js')
  await page.route('**/gif.worker.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'self.onmessage = () => {}',
    }),
  )
  await dialog.getByRole('button', { name: 'Export', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__exportResources.workers.size)).toBe(2)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Export', exact: true })).toBeEnabled()
  await released(page)
  await page.unroute('**/gif.worker.js')
  const gif = await download(page, 'Export', info, 'comparison.gif')
  expect(gif.toString('ascii', 0, 6)).toBe('GIF89a')
  const result = await page.evaluate(async (bytes) => {
    // Chromium's native decoder checks the actual encoded frames and their timing.
    const ImageDecoder = (window as unknown as { ImageDecoder: new (config: object) => any })
      .ImageDecoder
    const decoder = new ImageDecoder({ data: new Uint8Array(bytes), type: 'image/gif' })
    try {
      await decoder.tracks.ready
      const count = decoder.tracks.selectedTrack.frameCount
      let duration = 0
      let sample: number[] = []
      let width = 0
      let height = 0
      for (let index = 0; index < count; index++) {
        const { image } = await decoder.decode({ frameIndex: index })
        try {
          duration += image.duration
          width = image.displayWidth
          height = image.displayHeight
          if (index === 3) {
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const context = canvas.getContext('2d')!
            context.drawImage(image, 0, 0)
            sample = Array.from(context.getImageData(32, 90, 1, 1).data)
          }
        } finally {
          image.close()
        }
      }
      return { count, duration, width, height, sample }
    } finally {
      decoder.close()
    }
  }, Array.from(gif))
  expect(result).toMatchObject({ count: 10, duration: 1_000_000, width: 320, height: 180 })
  isColor(result.sample, 'red')
  await released(page)
  expect(await page.evaluate(() => window.__exportResources.recorders.length)).toBe(0)
})

test('cancelled WebM, transitions and stitch can be followed by valid exports', async ({
  page,
}, info) => {
  await prepareColors(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'WebM', exact: true }).click()
  await dialog.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Exporting...' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Export', exact: true })).toBeEnabled()
  await released(page)
  const webm = await download(page, 'Export', info, 'comparison.webm')
  expect(webm.subarray(0, 4).toString('hex')).toBe('1a45dfa3')
  const recorded = await inspectVideo(page, webm, 'video/webm')
  expect(recorded.width).toBe(1920)
  expect(recorded.height).toBe(1080)
  isColor(recorded.left, 'red')
  isColor(recorded.right, 'blue')
  await released(page)
  await dialog.getByRole('tab', { name: 'FX', exact: true }).click()
  await dialog.getByRole('button', { name: 'Trans Only' }).click()
  const transition = await download(page, 'Export FX', info, 'transition.mp4')
  const first = await inspectVideo(page, transition, 'video/mp4', 0.001)
  const last = await inspectVideo(page, transition, 'video/mp4', 1.45)
  expect(first.duration).toBeCloseTo(1.5, 1)
  isColor(first.left, 'red')
  isColor(last.left, 'blue')
  await released(page)
  await dialog.getByRole('tab', { name: 'Stitch', exact: true }).click()
  await dialog.getByRole('button', { name: '720P', exact: true }).click()
  const stitched = await download(page, 'Export Stitched Video', info, 'stitched.mp4')
  const stitch = await inspectVideo(page, stitched, 'video/mp4')
  expect(stitch.width).toBe(1280)
  expect(stitch.height).toBe(720)
  expect(stitch.duration).toBeCloseTo(1, 1)
  isColor(stitch.left, 'red')
  isColor(stitch.right, 'red')
  await released(page)
})

test('ProRes retains Image/PDF output and refuses every animated path', async ({ page }, info) => {
  await observeResources(page)
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  await upload(page, 'A', path.join(process.cwd(), 'e2e/fixtures/difference-a.webm'))
  await upload(page, 'B', path.join(process.cwd(), 'e2e/fixtures/difference-b.mov'))
  await expect(page.locator('canvas[data-track="b"]').first()).toHaveAttribute(
    'data-frame-ready',
    'true',
    { timeout: 60_000 },
  )
  await page.getByTitle('Export (E)').click()
  const dialog = page.getByRole('dialog')
  for (const format of ['MP4', 'GIF', 'WebM']) {
    await dialog.getByRole('button', { name: format, exact: true }).click()
    await dialog.getByRole('button', { name: 'Export', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('ProRes')
  }
  await dialog.getByRole('tab', { name: 'FX', exact: true }).click()
  await dialog.getByRole('button', { name: 'Export FX', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('ProRes')
  await dialog.getByRole('tab', { name: 'Stitch', exact: true }).click()
  await dialog.getByRole('button', { name: /Track B/ }).click()
  await dialog.getByRole('button', { name: 'Export Stitched Video', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('ProRes')
  await dialog.getByRole('tab', { name: 'Image', exact: true }).click()
  await dialog.getByRole('button', { name: 'B Only', exact: true }).click()
  const png = await download(page, 'Download', info, 'prores.png')
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(png.readUInt32BE(16)).toBe(1920)
  expect(png.readUInt32BE(20)).toBe(1080)
  const pixelsMatch = await page.evaluate(async (bytes) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }))
    try {
      const output = document.createElement('canvas')
      output.width = bitmap.width
      output.height = bitmap.height
      const out = output.getContext('2d')!
      out.drawImage(bitmap, 0, 0)
      const source = document.querySelector('canvas[data-track="b"]') as HTMLCanvasElement
      const expected = document.createElement('canvas')
      expected.width = output.width
      expected.height = output.height
      const reference = expected.getContext('2d')!
      reference.fillStyle = '#000'
      reference.fillRect(0, 0, expected.width, expected.height)
      const scale = Math.min(expected.width / source.width, expected.height / source.height)
      reference.drawImage(
        source,
        (expected.width - source.width * scale) / 2,
        (expected.height - source.height * scale) / 2,
        source.width * scale,
        source.height * scale,
      )
      const actualPixels = out.getImageData(0, 0, output.width, output.height).data
      const expectedPixels = reference.getImageData(0, 0, output.width, output.height).data
      return actualPixels.every((channel, index) => channel === expectedPixels[index])
    } finally {
      bitmap.close()
    }
  }, Array.from(png))
  expect(pixelsMatch).toBe(true)
  await dialog.getByRole('tab', { name: 'PDF', exact: true }).click()
  const pdf = await download(page, 'Generate PDF', info, 'prores.pdf')
  expect(pdf.toString('ascii', 0, 5)).toBe('%PDF-')
  expect(pdf.toString('latin1')).toContain('/Subtype /Image')
  await released(page)
})
