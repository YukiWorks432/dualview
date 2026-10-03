import { expect, test, type Page } from '@playwright/test'

import { expectColor, seek, upload } from './mediaPlayback'

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
    const { useKeyframeStore } = await import('/src/stores/keyframeStore.ts')
    const { useHistoryStore } = await import('/src/stores/historyStore.ts')
    return {
      clips: useTimelineStore.getState().tracks.flatMap((track) => track.clips),
      duration: useTimelineStore.getState().duration,
      keyframes: [...useKeyframeStore.getState().clipKeyframes],
      past: useHistoryStore.getState().past.length,
      future: useHistoryStore.getState().future.length,
    }
  })
}

test('分割前後・Undo/Redoで通常動画とProResの既知フレームを保持する', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()
  await upload(page, 'Media A', 'playback-colors.webm')
  await upload(page, 'Media B', 'playback-colors.mov')
  const originals = (await snapshot(page)).clips

  // 素材の0.5〜3.5秒を使う。赤は2秒より前、青は2秒以降。
  for (const example of [
    { speed: 1, end: 3, split: 1.5, before: 0.4, after: 2.4 },
    { speed: 2, end: 1.5, split: 0.7, before: 0.2, after: 1.2 },
    { speed: 0.5, end: 6, split: 3, before: 0.8, after: 4.8 },
  ]) {
    for (const reverse of [false, true]) {
      await page.evaluate(
        async ({ originals, example, reverse }) => {
          const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
          const { useHistoryStore } = await import('/src/stores/historyStore.ts')
          useTimelineStore.setState({
            tracks: useTimelineStore.getState().tracks.map((track) => ({
              ...track,
              clips: originals
                .filter((clip) => clip.trackId === track.id)
                .map((clip) => ({
                  ...clip,
                  startTime: 0,
                  endTime: example.end,
                  inPoint: 0.5,
                  outPoint: 3.5,
                  speed: example.speed,
                  reverse,
                  label: `編集${track.type.toUpperCase()}`,
                })),
            })),
            duration: example.end,
          })
          useHistoryStore.getState().clear()
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        },
        { originals, example, reverse },
      )
      await seek(page, example.before)
      await expectColor(page, 'a', reverse ? 'blue' : 'red')
      await expectColor(page, 'b', reverse ? 'blue' : 'red')
      await seek(page, example.split)
      for (const original of originals) {
        await page.evaluate(async (id) => {
          const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
          useTimelineStore.getState().selectClip(id)
        }, original.id)
        await page.keyboard.press('s')
      }
      await expect(page.locator('[data-clip]')).toHaveCount(4)
      const edited = await snapshot(page)
      expect(
        edited.clips.every(
          (clip) =>
            clip.speed === example.speed &&
            clip.reverse === reverse &&
            clip.label?.startsWith('編集'),
        ),
      ).toBe(true)
      await seek(page, example.before)
      await expectColor(page, 'a', reverse ? 'blue' : 'red')
      await expectColor(page, 'b', reverse ? 'blue' : 'red')
      await seek(page, example.after)
      await expectColor(page, 'a', reverse ? 'red' : 'blue')
      await expectColor(page, 'b', reverse ? 'red' : 'blue')
      await page.getByRole('button', { name: 'Undo', exact: true }).click()
      await page.getByRole('button', { name: 'Undo', exact: true }).click()
      await expect(page.locator('[data-clip]')).toHaveCount(2)
      await page.getByRole('button', { name: 'Redo', exact: true }).click()
      await page.getByRole('button', { name: 'Redo', exact: true }).click()
      expect((await snapshot(page)).clips).toEqual(edited.clips)
    }
  }
})

test('複製した速度・逆再生・キーフレームを版1の保存ファイルから読み戻せる', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()
  await upload(page, 'Media A', 'playback-colors.webm')
  await page.evaluate(async () => {
    const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
    const { useKeyframeStore } = await import('/src/stores/keyframeStore.ts')
    const clip = useTimelineStore.getState().tracks[0].clips[0]
    useTimelineStore.getState().updateClip(clip.id, { speed: 2, reverse: true, label: '保存対象' })
    useKeyframeStore.getState().addKeyframeToClip(clip.id, 'opacity', 0.5, 0.25, 'ease-in')
    useTimelineStore.getState().selectClip(clip.id)
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
  await page.keyboard.press('Control+d')
  await expect(page.locator('[data-clip]')).toHaveCount(2)
  const before = await snapshot(page)
  expect(before.keyframes).toHaveLength(2)
  const result = await page.evaluate(async () => {
    const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
    const state = usePersistenceStore.getState()
    const saved = await state.saveCurrentProject()
    const blob = await state.exportProject()
    const data = JSON.parse(await blob.text())
    const id = await state.importProject(
      new File([blob], 'clip-roundtrip.dualview', { type: 'application/json' }),
    )
    const loaded = await state.loadProject(id)
    return {
      saved,
      loaded,
      version: data.version,
      keyframes: JSON.parse(data.project.keyframeData).length,
    }
  })
  expect(result).toEqual({ saved: true, loaded: true, version: 1, keyframes: 2 })
  const after = await snapshot(page)
  expect(after.clips).toEqual(before.clips)
  expect(after.keyframes).toEqual(before.keyframes)
  expect(after.duration).toBe(4)
  await seek(page, 2.5)
  await expectColor(page, 'a', 'blue')
  await seek(page, 3.5)
  await expectColor(page, 'a', 'red')
})

test('短すぎる素材への差替えは理由を表示し参照・トリム・Redo履歴を保持する', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()
  await upload(page, 'Media A', 'playback-colors.webm')
  await upload(page, 'Media B', 'difference-a.webm')
  await page.evaluate(async () => {
    const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
    const { useHistoryStore } = await import('/src/stores/historyStore.ts')
    const clip = useTimelineStore.getState().tracks[0].clips[0]
    useTimelineStore.getState().trimClip(clip.id, 'start', 3)
    useHistoryStore
      .getState()
      .runWithHistory(() => useTimelineStore.getState().duplicateClip(clip.id))
    useHistoryStore.getState().undo()
  })
  const before = await snapshot(page)
  await page.locator('[data-clip]').first().click({ button: 'right' })
  await page.getByRole('button', { name: 'Replace Media', exact: true }).hover()
  await page.getByRole('button', { name: 'difference-a.webm', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('トリム開始位置より短い')
  expect(await snapshot(page)).toEqual(before)
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(page.locator('[data-clip]')).toHaveCount(3)
})

test('既存形式から読んだキーフレーム付きクリップで3操作だけを理由付きで止める', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()
  await upload(page, 'Media A', 'playback-colors.webm')
  const loaded = await page.evaluate(async () => {
    const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
    const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
    const state = usePersistenceStore.getState()
    await state.saveCurrentProject()
    const data = JSON.parse(await (await state.exportProject()).text())
    const clip = useTimelineStore.getState().tracks[0].clips[0]
    // 既存の版1データをそのまま読み込む経路を使う。UIで生成したことにはしない。
    data.project.keyframeData = JSON.stringify([
      [
        clip.id,
        {
          clipId: clip.id,
          tracks: [
            {
              property: 'opacity',
              keyframes: [
                {
                  id: 'legacy-one',
                  time: 0.5,
                  value: 0.25,
                  easing: 'bezier',
                  bezier: { x1: 0.1, y1: 0.3, x2: 0.7, y2: 1 },
                },
                { id: 'legacy-two', time: 3.5, value: 1, easing: 'ease-out' },
              ],
            },
          ],
        },
      ],
    ])
    const imported = await state.importProject(
      new File([JSON.stringify(data)], 'legacy.dualview', { type: 'application/json' }),
    )
    return state.loadProject(imported)
  })
  expect(loaded).toBe(true)
  await page.locator('[data-clip]').first().click()
  await seek(page, 2)
  const before = await snapshot(page)
  for (const key of ['s', 'w']) {
    await page.keyboard.press(key)
    await expect(page.getByRole('alert')).toContainText('時刻変換の仕様が未定義')
    expect(await snapshot(page)).toEqual(before)
  }
  const handle = page.getByTitle('先頭をトリム').first()
  const bounds = (await handle.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 35, bounds.y + bounds.height / 2, { steps: 5 })
  await page.mouse.up()
  await expect(page.getByRole('alert')).toContainText('時刻変換の仕様が未定義')
  expect(await snapshot(page)).toEqual(before)
  await page.keyboard.press('q')
  await expect(page.getByRole('alert')).toHaveCount(0)
  const shortened = await snapshot(page)
  expect(shortened.clips[0].endTime).toBe(2)
  expect(shortened.keyframes).toEqual(before.keyframes)
  await page.keyboard.press('Control+d')
  await expect(page.locator('[data-clip]')).toHaveCount(2)
  expect((await snapshot(page)).keyframes).toHaveLength(2)
})

test('末尾静止区間を分割して速度変更・リセットしてもフレームと表示時間が残る', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()
  await upload(page, 'Media A', 'playback-colors.webm')
  const original = (await snapshot(page)).clips[0]
  for (const reverse of [false, true]) {
    await page.evaluate(
      async ({ original, reverse }) => {
        const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
        const { useHistoryStore } = await import('/src/stores/historyStore.ts')
        useTimelineStore.setState({
          tracks: useTimelineStore.getState().tracks.map((track) => ({
            ...track,
            clips:
              track.id === original.trackId
                ? [
                    {
                      ...original,
                      startTime: 0,
                      endTime: 6,
                      inPoint: 0.5,
                      outPoint: 3.5,
                      speed: 2,
                      reverse,
                    },
                  ]
                : [],
          })),
          duration: 6,
        })
        useHistoryStore.getState().clear()
        useTimelineStore.getState().selectClip(original.id)
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      },
      { original, reverse },
    )
    await seek(page, 4)
    await page.keyboard.press('s')
    await expect(page.locator('[data-clip]')).toHaveCount(2)
    await page.locator('[data-clip]').nth(1).click({ button: 'right' })
    if (reverse) await page.getByRole('button', { name: 'Reset to Original', exact: true }).click()
    else {
      await page.getByRole('button', { name: 'Speed 2x', exact: true }).hover()
      await page.getByRole('button', { name: '1x (Normal)', exact: true }).click()
    }
    const changed = await snapshot(page)
    expect(changed.clips[1]).toMatchObject({ startTime: 4, endTime: 6, speed: 1 })
    expect(changed.duration).toBe(6)
    await seek(page, 4.5)
    await expectColor(page, 'a', reverse ? 'red' : 'blue')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(page.locator('[data-clip]')).toHaveCount(1)
    await page.getByRole('button', { name: 'Redo', exact: true }).click()
    await page.getByRole('button', { name: 'Redo', exact: true }).click()
    expect((await snapshot(page)).clips).toEqual(changed.clips)
    await seek(page, 4.5)
    await expectColor(page, 'a', reverse ? 'red' : 'blue')
    await page.evaluate(async (id) => {
      const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
      useTimelineStore.getState().selectClip(id)
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    }, changed.clips[1].id)
    await seek(page, 5)
    await page.keyboard.press('q')
    expect((await snapshot(page)).clips[1]).toMatchObject({ startTime: 4, endTime: 5 })
    expect((await snapshot(page)).duration).toBe(5)
    await seek(page, 4.5)
    await expectColor(page, 'a', reverse ? 'red' : 'blue')
  }
})
