import { expect, test, type Page } from '@playwright/test'
async function seed(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.waitForFunction(async () => {
    const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
    const state = usePersistenceStore.getState()
    return Boolean(state.currentProjectId) && !state.isLoading
  })
  await page.evaluate(async () => {
    const { useMediaStore } = await import('/src/stores/mediaStore.ts')
    const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    const { useHistoryStore } = await import('/src/stores/historyStore.ts')
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 16
    const context = canvas.getContext('2d')!
    for (const [index, color] of ['red', 'blue'].entries()) {
      context.fillStyle = color
      context.fillRect(0, 0, 16, 16)
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!)))
      const media = await useMediaStore
        .getState()
        .addFile(new File([blob], `${color}.png`, { type: 'image/png' }))
      if (!media) throw new Error('検証用画像の取込が取り消されました')
      const clip = useTimelineStore
        .getState()
        .addClip(index === 0 ? 'track-a' : 'track-b', media.id, 0, 10)
      if (index === 0) useTimelineStore.getState().selectClip(clip.id)
    }
    usePlaybackStore.getState().seek(5)
    useHistoryStore.getState().clear()
  })
  await expect(page.locator('[data-clip]')).toHaveCount(2)
  await page.locator('[data-timeline-panel]').focus()
}

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const t = (await import('/src/stores/timelineStore.ts')).useTimelineStore.getState()
    const p = (await import('/src/stores/playbackStore.ts')).usePlaybackStore.getState()
    const h = (await import('/src/stores/historyStore.ts')).useHistoryStore.getState()
    return {
      clips: t.tracks.flatMap((t) => t.clips),
      selected: t.selectedClipIds,
      time: p.currentTime,
      loop: t.loopRegion,
      zoom: t.zoom,
      past: h.past.length,
      future: h.future.length,
      playing: p.isPlaying,
    }
  })
}
test.beforeEach(async ({ page }) => {
  await seed(page)
})
test('AEのフレーム移動・I/O・B/Nは末尾フレームを含む', async ({ page }) => {
  await page.keyboard.press('i')
  expect((await snapshot(page)).time).toBe(0)
  await page.keyboard.press('PageDown')
  expect((await snapshot(page)).time).toBeCloseTo(1 / 30)
  await page.keyboard.press('Shift+PageDown')
  expect((await snapshot(page)).time).toBeCloseTo(11 / 30)
  await page.keyboard.press('b')
  await page.keyboard.press('o')
  await page.keyboard.press('n')
  const s = await snapshot(page)
  expect(s.time).toBeCloseTo(10 - 1 / 30)
  expect(s.loop!.inPoint).toBeCloseTo(11 / 30)
  expect(s.loop!.outPoint).toBe(10)
})
test('空白クリックとパンは再生位置・クリップを変えない', async ({ page }) => {
  const before = await snapshot(page),
    el = page.locator('[data-timeline-scroll]'),
    r = (await el.boundingBox())!
  await page.mouse.click(r.x + 700, r.y + 80)
  expect((await snapshot(page)).time).toBe(before.time)
  expect((await snapshot(page)).selected).toEqual([])
  await page.mouse.move(r.x + 300, r.y + 85)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(r.x + 100, r.y + 85)
  await page.mouse.up({ button: 'middle' })
  const after = await snapshot(page)
  expect(after.clips).toEqual(before.clips)
  expect(after.time).toBe(before.time)
  expect(after.past).toBe(0)
})
test('複数選択のドラッグは時間差を保ち一回で取り消せる', async ({ page }) => {
  await page.keyboard.press('Control+a')
  const clip = page.locator('[data-clip]').first(),
    r = (await clip.boundingBox())!
  await page.mouse.move(r.x + 50, r.y + 20)
  await page.mouse.down()
  await page.mouse.move(r.x + 150, r.y + 20, { steps: 5 })
  await page.mouse.up()
  let s = await snapshot(page)
  expect(s.clips.map((c) => c.startTime)).toEqual([2, 2])
  expect(s.selected).toHaveLength(2)
  expect(s.past).toBe(1)
  await page.keyboard.press('Control+z')
  s = await snapshot(page)
  expect(s.clips.map((c) => c.startTime)).toEqual([0, 0])
})
test('トリムのEscape取消はデータと履歴を保つ', async ({ page }) => {
  const before = await snapshot(page),
    handle = page.getByTitle('末尾をトリム').first(),
    r = (await handle.boundingBox())!
  await page.mouse.move(r.x + 3, r.y + 15)
  await page.mouse.down()
  await page.mouse.move(r.x - 100, r.y + 15, { steps: 5 })
  expect((await snapshot(page)).clips).toEqual(before.clips)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  const after = await snapshot(page)
  expect(after.clips).toEqual(before.clips)
  expect(after.past).toBe(0)
})
test('定規ドラッグでシークしSpaceドラッグでは再生しない', async ({ page }) => {
  const r = (await page.locator('[data-time-ruler]').boundingBox())!
  await page.mouse.move(r.x + 50, r.y + 12)
  await page.mouse.down()
  await page.mouse.move(r.x + 100, r.y + 12)
  await page.mouse.up()
  expect((await snapshot(page)).time).toBeCloseTo(2)
  await page.keyboard.down('Space')
  await page.mouse.move(r.x + 200, r.y + 80)
  await page.mouse.down()
  await page.mouse.move(r.x + 100, r.y + 80)
  await page.mouse.up()
  await page.keyboard.up('Space')
  expect((await snapshot(page)).playing).toBe(false)
})
test('Altホイールのズームはポインターの時刻を保つ', async ({ page }) => {
  const el = page.locator('[data-timeline-scroll]'),
    r = (await el.boundingBox())!
  await page.mouse.move(r.x + 150, r.y + 80)
  await page.keyboard.down('Alt')
  await page.mouse.wheel(0, -900)
  await page.keyboard.up('Alt')
  await expect.poll(async () => (await snapshot(page)).zoom).toBeGreaterThan(1)
  await expect
    .poll(async () => {
      const s = await snapshot(page)
      const scroll = await el.evaluate((e) => e.scrollLeft)
      return (scroll + 150) / (50 * s.zoom)
    })
    .toBeCloseTo(3, 1)
})
test('単一選択への置換後の削除は他のクリップを残す', async ({ page }) => {
  await page.keyboard.press('Control+a')
  await page
    .locator('[data-clip]')
    .first()
    .click({ position: { x: 80, y: 20 } })
  await page.keyboard.press('Delete')
  const s = await snapshot(page)
  expect(s.clips).toHaveLength(1)
  expect(s.clips[0].trackId).toBe('track-b')
})

test('Shiftを押して開始した移動は再生位置へ吸着する', async ({ page }) => {
  const r = (await page.locator('[data-clip]').first().boundingBox())!
  await page.keyboard.down('Shift')
  await page.mouse.move(r.x + 50, r.y + 20)
  await page.mouse.down()
  await page.mouse.move(r.x + 296, r.y + 20, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up('Shift')
  expect((await snapshot(page)).clips[0].startTime).toBe(5)
})
test('トリム確定を取り消した後の移動取消はやり直しを失わせない', async ({ page }) => {
  const r = (await page.getByTitle('末尾をトリム').first().boundingBox())!
  await page.mouse.move(r.x + 3, r.y + 15)
  await page.mouse.down()
  await page.mouse.move(r.x - 97, r.y + 15, { steps: 6 })
  await page.mouse.up()
  expect((await snapshot(page)).clips[0].endTime).toBe(8)
  await page.keyboard.press('Control+z')
  expect((await snapshot(page)).future).toBe(1)
  const c = (await page.locator('[data-clip]').first().boundingBox())!
  await page.mouse.move(c.x + 50, c.y + 20)
  await page.mouse.down()
  await page.mouse.move(c.x + 150, c.y + 20, { steps: 5 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  expect((await snapshot(page)).future).toBe(1)
  await page.keyboard.press('Control+Shift+z')
  expect((await snapshot(page)).clips[0].endTime).toBe(8)
})
test('Spaceを押してから入力欄へ移った場合は再生を始めない', async ({ page }) => {
  await page.keyboard.down('Space')
  await page.getByPlaceholder('Search files...').focus()
  await page.keyboard.up('Space')
  expect((await snapshot(page)).playing).toBe(false)
})
test('長尺を全体表示し直前の範囲へ戻せる', async ({ page }) => {
  await page.evaluate(async () => {
    const t = (await import('/src/stores/timelineStore.ts')).useTimelineStore
    t.setState({
      duration: 3600,
      tracks: t.getState().tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => ({ ...c, endTime: 3600, outPoint: 3600 })),
      })),
    })
  })
  await page.locator('[data-timeline-panel]').press('Shift+Semicolon')
  const el = page.locator('[data-timeline-scroll]')
  await expect
    .poll(async () => {
      const s = await snapshot(page)
      return 3600 * 50 * s.zoom
    })
    .toBeLessThanOrEqual((await el.evaluate((e) => e.clientWidth)) + 1)
  await page.locator('[data-timeline-panel]').press('Shift+Semicolon')
  expect((await snapshot(page)).zoom).toBe(1)
})

test('トラック設定と追加のメニューをマウスで操作できる', async ({ page }) => {
  await page.getByTitle('Track Settings', { exact: true }).first().click()
  await page.locator('div[data-track-settings]').getByRole('checkbox').first().uncheck()
  expect(
    await page.evaluate(
      async () =>
        !(await import('/src/stores/timelineStore.ts')).useTimelineStore
          .getState()
          .tracks[0].acceptedTypes.includes('video'),
    ),
  ).toBe(true)
  await page.getByTitle('Add new track', { exact: true }).click()
  await page.getByRole('button', { name: 'Media Track', exact: true }).click()
  expect(
    await page.evaluate(
      async () =>
        (await import('/src/stores/timelineStore.ts')).useTimelineStore.getState().tracks.length,
    ),
  ).toBe(3)
})
test('画面外の再生位置をフレーム拡大で画面内に表示する', async ({ page }) => {
  await page.evaluate(async () => {
    const t = (await import('/src/stores/timelineStore.ts')).useTimelineStore
    t.setState({
      duration: 3600,
      tracks: t.getState().tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => ({ ...c, endTime: 3600, outPoint: 3600 })),
      })),
    })
    ;(await import('/src/stores/playbackStore.ts')).usePlaybackStore.getState().seek(120)
  })
  await page.locator('[data-timeline-panel]').press('Semicolon')
  await expect(page.locator('[data-playhead-head]')).toBeInViewport()
  expect((await snapshot(page)).time).toBe(120)
})
