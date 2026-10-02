import { expect, test, type Locator, type Page } from '@playwright/test'

declare global {
  interface Window {
    __comparisonCounters: {
      heatmap: { callbacks: number; pending: Set<number>; peak: number }
      split: { callbacks: number; pending: Set<number>; peak: number }
      canvases: HTMLCanvasElement[]
      outputs: number
      resources: Set<object>
    }
  }
}

async function measure(page: Page) {
  await page.addInitScript(() => {
    const state = {
      heatmap: { callbacks: 0, pending: new Set<number>(), peak: 0 },
      split: { callbacks: 0, pending: new Set<number>(), peak: 0 },
      canvases: [] as HTMLCanvasElement[],
      outputs: 0,
      resources: new Set<object>(),
    }
    window.__comparisonCounters = state
    const request = window.requestAnimationFrame.bind(window)
    const cancel = window.cancelAnimationFrame.bind(window)
    window.requestAnimationFrame = (callback) => {
      const stack = new Error().stack ?? ''
      const group = stack.includes('DifferenceHeatmap')
        ? state.heatmap
        : stack.includes('WebGLSplitView')
          ? state.split
          : null
      let id = 0
      id = request((time) => {
        if (group) {
          group.pending.delete(id)
          group.callbacks++
        }
        callback(time)
      })
      if (group) {
        group.pending.add(id)
        group.peak = Math.max(group.peak, group.pending.size)
      }
      return id
    }
    window.cancelAnimationFrame = (id) => {
      state.heatmap.pending.delete(id)
      state.split.pending.delete(id)
      cancel(id)
    }
    const create = document.createElement.bind(document)
    document.createElement = ((...args: Parameters<typeof document.createElement>) => {
      const element = Reflect.apply(create, document, args)
      if (args[0] === 'canvas' && new Error().stack?.includes('DifferenceHeatmap'))
        state.canvases.push(element as HTMLCanvasElement)
      return element
    }) as typeof document.createElement
    const output = CanvasRenderingContext2D.prototype.createImageData
    CanvasRenderingContext2D.prototype.createImageData = function (...args: unknown[]) {
      if (new Error().stack?.includes('DifferenceHeatmap')) state.outputs++
      return Reflect.apply(output, this, args)
    }
    for (const [createName, deleteName] of [
      ['createTexture', 'deleteTexture'],
      ['createBuffer', 'deleteBuffer'],
      ['createProgram', 'deleteProgram'],
      ['createShader', 'deleteShader'],
    ] as const) {
      const createResource = WebGLRenderingContext.prototype[createName]
      const deleteResource = WebGLRenderingContext.prototype[deleteName]
      Object.defineProperty(WebGLRenderingContext.prototype, createName, {
        value: function (this: WebGLRenderingContext, ...args: unknown[]) {
          const resource = Reflect.apply(createResource, this, args)
          if (
            resource &&
            this.canvas instanceof HTMLCanvasElement &&
            this.canvas.closest('[data-testid="webgl-split-view"]')
          )
            state.resources.add(resource)
          return resource
        },
      })
      Object.defineProperty(WebGLRenderingContext.prototype, deleteName, {
        value: function (this: WebGLRenderingContext, resource: object) {
          state.resources.delete(resource)
          return Reflect.apply(deleteResource, this, [resource])
        },
      })
    }
  })
}

async function counters(page: Page) {
  return page.evaluate(() => {
    const s = window.__comparisonCounters
    return {
      heatmap: {
        callbacks: s.heatmap.callbacks,
        pending: s.heatmap.pending.size,
        peak: s.heatmap.peak,
      },
      split: { callbacks: s.split.callbacks, pending: s.split.pending.size, peak: s.split.peak },
      canvases: s.canvases.length,
      allocatedCanvases: s.canvases.filter((c) => c.width > 0 && c.height > 0).length,
      outputs: s.outputs,
      resources: s.resources.size,
    }
  })
}

async function start(page: Page) {
  await page.setViewportSize({ width: 900, height: 650 })
  await page.goto('/')
  await page.waitForFunction(async () => {
    const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
    return Boolean(usePersistenceStore.getState().currentProjectId)
  })
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()
}

async function prepareVideos(page: Page, prores: boolean) {
  await page.evaluate(async (prores) => {
    const { useMediaStore } = await import('/src/stores/mediaStore.ts')
    const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
    for (const side of ['a', 'b']) {
      const extension = prores && side === 'b' ? 'mov' : 'webm'
      const blob = await (await fetch(`/e2e/fixtures/playback-colors.${extension}`)).blob()
      const file = await useMediaStore.getState().addFile(
        new File([blob], `${side}.${extension}`, {
          type: extension === 'mov' ? 'video/quicktime' : 'video/webm',
        }),
      )
      useTimelineStore.getState().addClip(`track-${side}`, file.id, 0, file.duration!)
    }
  }, prores)
}

async function seek(page: Page, time: number) {
  await page.evaluate(async (time) => {
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    usePlaybackStore.getState().pause()
    usePlaybackStore.getState().seek(time)
  }, time)
}

async function pixel(source: Locator) {
  return source.evaluate((element: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement) => {
    if (element instanceof HTMLVideoElement && (element.seeking || element.readyState < 2))
      return null
    if (element instanceof HTMLCanvasElement && element.dataset.frameReady !== 'true') return null
    if (element instanceof HTMLCanvasElement && element.dataset.testid === 'split-analysis') {
      const gl = element.getContext('webgl')!
      const value = new Uint8Array(4)
      gl.readPixels(
        Math.floor(element.width / 2),
        Math.floor(element.height / 2),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        value,
      )
      return Array.from(value)
    }
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 8
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(element, 0, 0, 8, 8)
    return Array.from(ctx.getImageData(4, 4, 1, 1).data)
  })
}

async function expectPixel(source: Locator, expected: number[], tolerance = 8) {
  await expect
    .poll(
      async () => {
        const value = await pixel(source)
        return (
          value !== null &&
          value.every((channel, i) => Math.abs(channel - expected[i]) <= tolerance)
        )
      },
      { timeout: 15_000 },
    )
    .toBe(true)
}

async function splitView(page: Page) {
  await page.keyboard.press('Digit3')
  await page.evaluate(async () => {
    const { useProjectStore } = await import('/src/stores/projectStore.ts')
    useProjectStore.getState().setWebGLComparisonSettings({
      mode: 'diff-absolute',
      amplification: 1,
      threshold: 0,
      opacity: 1,
    })
  })
  await page.getByTitle('Split View: A | Analysis | B (WEBGL-011)').click()
  return page.getByTestId('webgl-split-view')
}

test('Heatmapはサイズ・設定変更後も描画予約を一つに保ち、停止と画面離脱で資源を解放する', async ({
  page,
}, testInfo) => {
  await measure(page)
  await start(page)
  await page.evaluate(async () => {
    const { useMediaStore } = await import('/src/stores/mediaStore.ts')
    const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
    const { useProjectStore } = await import('/src/stores/projectStore.ts')
    for (const side of ['a', 'b']) {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 16
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = 'red'
      ctx.fillRect(0, 0, 16, 16)
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!)))
      const media = await useMediaStore
        .getState()
        .addFile(new File([blob], `${side}.png`, { type: 'image/png' }))
      useTimelineStore.getState().addClip(`track-${side}`, media.id, 0, 30)
    }
    useProjectStore.getState().setComparisonMode('heatmap')
  })
  const canvas = page.getByTestId('difference-heatmap')
  await expectPixel(canvas, [0, 0, 255, 255], 0)
  await page.evaluate(async () => {
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    usePlaybackStore.getState().play()
  })
  for (const width of [850, 920, 880, 900]) await page.setViewportSize({ width, height: 650 })
  await page.getByRole('button', { name: 'absolute', exact: true }).click()
  await expectPixel(canvas, [0, 0, 0, 255], 0)
  await page.getByRole('button', { name: 'amplified', exact: true }).click()
  await page.waitForTimeout(400)
  await page.evaluate(async () => {
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    usePlaybackStore.getState().pause()
  })
  await page.waitForTimeout(200)
  const before = await counters(page)
  await page.waitForTimeout(500)
  const after = await counters(page)
  console.log('HEATMAP_LIFECYCLE', JSON.stringify({ before, after }))
  expect(after.heatmap.callbacks).toBe(before.heatmap.callbacks)
  expect(after.heatmap.pending).toBe(0)
  expect(after.heatmap.peak).toBeLessThanOrEqual(1)
  expect(after.canvases).toBe(2)
  expect(after.outputs).toBe(before.outputs)
  await expectPixel(canvas, [0, 0, 255, 255], 0)
  await testInfo.attach('heatmap-paused', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await page.evaluate(async () => {
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    usePlaybackStore.getState().play()
  })
  await expect
    .poll(async () => (await counters(page)).heatmap.callbacks)
    .toBeGreaterThan(after.heatmap.callbacks)
  expect((await counters(page)).canvases).toBe(2)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(200)
  const closed = await counters(page)
  await page.waitForTimeout(500)
  expect((await counters(page)).heatmap).toEqual(closed.heatmap)
  expect(closed.heatmap.pending).toBe(0)
  expect(closed.allocatedCanvases).toBe(0)
})

test('Split Viewは通常動画の左右と解析に同じ停止フレームを使い、再開・閉じる操作で描画資源を管理する', async ({
  page,
}, testInfo) => {
  await measure(page)
  await start(page)
  await prepareVideos(page, false)
  const split = await splitView(page)
  const a = split.locator('video[data-track="a"]'),
    b = split.locator('video[data-track="b"]')
  const analysis = split.getByTestId('split-analysis')
  await seek(page, 2.5)
  await expectPixel(a, [0, 0, 255, 255])
  await expectPixel(b, [0, 0, 255, 255])
  await expectPixel(analysis, [0, 0, 0, 255])
  const before = await split
    .locator('video')
    .evaluateAll((videos: HTMLVideoElement[]) =>
      videos.map((video) => ({ paused: video.paused, time: video.currentTime })),
    )
  await page.waitForTimeout(500)
  expect(
    await split
      .locator('video')
      .evaluateAll((videos: HTMLVideoElement[]) =>
        videos.map((video) => ({ paused: video.paused, time: video.currentTime })),
      ),
  ).toEqual(before)
  expect(before.every((video) => video.paused && video.time === 2.5)).toBe(true)
  await seek(page, 0.5)
  await expectPixel(a, [255, 0, 0, 255])
  await expectPixel(b, [255, 0, 0, 255])
  await expectPixel(analysis, [0, 0, 0, 255])
  for (const width of [850, 920, 880, 900]) await page.setViewportSize({ width, height: 650 })
  await page.waitForTimeout(200)
  const paused = await counters(page)
  await page.waitForTimeout(500)
  expect((await counters(page)).split.callbacks).toBe(paused.split.callbacks)
  expect(paused.split.pending).toBe(0)
  expect(paused.split.peak).toBeLessThanOrEqual(1)
  expect(paused.resources).toBeGreaterThan(0)
  await testInfo.attach('split-paused-native', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await seek(page, 1.8)
  await page.evaluate(async () => {
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    usePlaybackStore.getState().play()
  })
  await expectPixel(a, [0, 0, 255, 255])
  await expectPixel(b, [0, 0, 255, 255])
  await page.evaluate(async () => {
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    usePlaybackStore.getState().pause()
  })
  await expectPixel(analysis, [0, 0, 0, 255])
  await page.getByTitle('Exit Split View').click()
  const closed = await counters(page)
  await page.waitForTimeout(500)
  expect((await counters(page)).split).toEqual(closed.split)
  expect(closed.split.pending).toBe(0)
  expect(closed.resources).toBe(0)
  console.log('SPLIT_LIFECYCLE', JSON.stringify({ paused, closed }))
  await page.getByTitle('Split View: A | Analysis | B (WEBGL-011)').click()
  await seek(page, 0.5)
  await expectPixel(split.locator('video[data-track="a"]'), [255, 0, 0, 255])
  await expectPixel(split.getByTestId('split-analysis'), [0, 0, 0, 255])
})

test('Split Viewは通常動画とProResのトリム・速度・逆再生・クリップ境界を実画素で合わせる', async ({
  page,
}, testInfo) => {
  await measure(page)
  await start(page)
  await prepareVideos(page, true)
  const split = await splitView(page)
  const a = split.locator('video[data-track="a"]'),
    b = split.locator('canvas[data-track="b"]')
  const analysis = split.getByTestId('split-analysis')
  await page.evaluate(async () => {
    const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
    useTimelineStore.setState({
      duration: 3.5,
      tracks: useTimelineStore.getState().tracks.map((track) => ({
        ...track,
        clips: track.clips.flatMap((clip) => [
          {
            ...clip,
            endTime: 1.5,
            inPoint: 0.5,
            outPoint: 3.5,
            speed: 2,
            reverse: track.type === 'b',
          },
          {
            ...clip,
            id: `${clip.id}-second`,
            startTime: 2,
            endTime: 3.5,
            inPoint: 0.5,
            outPoint: 3.5,
            speed: 2,
            reverse: false,
          },
        ]),
      })),
    })
  })
  await seek(page, 0.25)
  await expectPixel(a, [255, 0, 0, 255])
  await expectPixel(b, [0, 0, 255, 255])
  await expectPixel(analysis, [255, 0, 255, 255])
  await testInfo.attach('split-native-prores-trim-speed-reverse', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await page.evaluate(async () => {
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    for (const time of [1.1, 0.2, 1.1, 0.3, 1.1]) usePlaybackStore.getState().seek(time)
  })
  await expectPixel(a, [0, 0, 255, 255])
  await expectPixel(b, [255, 0, 0, 255])
  await expectPixel(analysis, [255, 0, 255, 255])
  await seek(page, 1.75)
  await expect(analysis).toHaveAttribute('data-frame-ready', 'false')
  expect(
    await analysis.evaluate((canvas: HTMLCanvasElement) => {
      const gl = canvas.getContext('webgl')!,
        value = new Uint8Array(4)
      gl.readPixels(canvas.width >> 1, canvas.height >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, value)
      return Array.from(value)
    }),
  ).toEqual([0, 0, 0, 255])
  await seek(page, 2.2)
  await expectPixel(a, [255, 0, 0, 255])
  await expectPixel(b, [255, 0, 0, 255])
  await expectPixel(analysis, [0, 0, 0, 255])
  await seek(page, 3.1)
  await expectPixel(a, [0, 0, 255, 255])
  await expectPixel(b, [0, 0, 255, 255])
  await expectPixel(analysis, [0, 0, 0, 255])
  await page.evaluate(async () => {
    const { useProjectStore } = await import('/src/stores/projectStore.ts')
    useProjectStore.getState().setWebGLComparisonSettings({ opacity: 0 })
  })
  await expectPixel(analysis, [0, 0, 255, 255])
  await seek(page, 2.6)
  await page.evaluate(async () => {
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    usePlaybackStore.getState().setSpeed(0.5)
    usePlaybackStore.getState().play()
  })
  await expectPixel(a, [0, 0, 255, 255])
  await expectPixel(b, [0, 0, 255, 255])
  await page.evaluate(async () => {
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    usePlaybackStore.getState().pause()
  })
  await expectPixel(analysis, [0, 0, 255, 255])
  // 動画停止中でも意図した点滅表示は動き、閉じると終了する。
  await page.evaluate(async () => {
    const { useProjectStore } = await import('/src/stores/projectStore.ts')
    useProjectStore.getState().setWebGLComparisonSettings({ mode: 'video-flicker' })
  })
  const animated = await counters(page)
  await expect
    .poll(async () => (await counters(page)).split.callbacks)
    .toBeGreaterThan(animated.split.callbacks)
  await page.keyboard.press('Digit1')
  const closed = await counters(page)
  await page.waitForTimeout(500)
  expect((await counters(page)).split).toEqual(closed.split)
  expect(closed.split.pending).toBe(0)
  expect(closed.resources).toBe(0)
  await page.evaluate(async () => {
    const { useProjectStore } = await import('/src/stores/projectStore.ts')
    useProjectStore.getState().setComparisonMode('heatmap')
  })
  await page.getByRole('button', { name: 'absolute', exact: true }).click()
  await seek(page, 0.25)
  await expectPixel(page.getByTestId('difference-heatmap'), [127, 127, 127, 255], 3)
  await seek(page, 3.1)
  await expectPixel(page.getByTestId('difference-heatmap'), [0, 0, 0, 255], 3)
  await seek(page, 1.75)
  await expect(page.getByTestId('difference-heatmap')).toHaveAttribute('data-frame-ready', 'false')
})

test('Heatmapの再利用バッファは透明度と素材交換を正しく反映する', async ({ page }) => {
  await measure(page)
  await start(page)
  await page.evaluate(async () => {
    const { useMediaStore } = await import('/src/stores/mediaStore.ts')
    const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
    const { useProjectStore } = await import('/src/stores/projectStore.ts')
    for (const [side, alpha] of [
      ['a', 1],
      ['b', 0.5],
    ] as const) {
      const canvas = document.createElement('canvas')
      canvas.width = 24
      canvas.height = 12
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = `rgba(0,0,0,${alpha})`
      ctx.fillRect(0, 0, 24, 12)
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!)))
      const media = await useMediaStore
        .getState()
        .addFile(new File([blob], `${side}.png`, { type: 'image/png' }))
      useTimelineStore.getState().addClip(`track-${side}`, media.id, 0, 10)
    }
    useProjectStore.getState().setComparisonMode('heatmap')
  })
  await page.getByRole('button', { name: 'absolute', exact: true }).click()
  const canvas = page.getByTestId('difference-heatmap')
  await expectPixel(canvas, [32, 32, 32, 255], 0)
  // 同じ半透明入力を何度描いても濃くならない。
  for (const width of [850, 920, 880, 900]) {
    await page.setViewportSize({ width, height: 650 })
    await expectPixel(canvas, [32, 32, 32, 255], 0)
  }
  await page.getByRole('button', { name: 'threshold', exact: true }).click()
  await expectPixel(canvas, [255, 0, 0, 255], 0)
  await page.evaluate(async () => {
    const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
    const a = useTimelineStore.getState().tracks.find((track) => track.type === 'a')!.clips[0]
    useTimelineStore.setState({
      tracks: useTimelineStore
        .getState()
        .tracks.map((track) =>
          track.type === 'b'
            ? { ...track, clips: track.clips.map((clip) => ({ ...clip, mediaId: a.mediaId })) }
            : track,
        ),
    })
  })
  await expectPixel(canvas, [0, 0, 0, 255], 0)
  expect((await counters(page)).canvases).toBe(2)
})
