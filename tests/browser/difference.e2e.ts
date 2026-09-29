import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
async function seed(page: Page, names: [string, string]) {
  await page.goto('/')
  await page.waitForFunction(async () => {
    const path = '/src/stores/persistenceStore.ts'
    return Boolean((await import(path)).usePersistenceStore.getState().currentProjectId)
  })
  const inputs = await Promise.all(
    names.map(async (name) => ({
      name,
      base64: (
        await readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)))
      ).toString('base64'),
    })),
  )
  await page.evaluate(async (files) => {
    const mediaPath = '/src/stores/mediaStore.ts'
    const timelinePath = '/src/stores/timelineStore.ts'
    const playbackPath = '/src/stores/playbackStore.ts'
    const { useMediaStore } = await import(mediaPath)
    const { useTimelineStore } = await import(timelinePath)
    const { usePlaybackStore } = await import(playbackPath)
    const tracks = useTimelineStore.getState().tracks
    for (let index = 0; index < files.length; index++) {
      const input = files[index]
      const data = Uint8Array.from(atob(input.base64), (character) => character.charCodeAt(0))
      const file = new File([data], input.name, {
        type: input.name.endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
      })
      const media = await useMediaStore.getState().addFile(file)
      const track = tracks.find((item: { type: string }) => item.type === (index === 0 ? 'a' : 'b'))
      useTimelineStore.getState().addClip(track.id, media.id, 0, media.duration)
    }
    usePlaybackStore.getState().seek(0.1)
  }, inputs)
}
async function result(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/stores/differenceStore.ts'
    const state = (await import(path)).useDifferenceStore.getState()
    return {
      status: state.status,
      regions: state.regions as { start: number; end: number }[],
      jobId: state.jobId,
      unavailable: state.unavailable,
      options: state.options,
    }
  })
}
async function analyze(page: Page) {
  await page.getByRole('button', { name: 'Analyze differences', exact: true }).first().click()
  await expect(page.getByTestId('difference-status').first()).toHaveAttribute(
    'data-status',
    'complete',
  )
  return result(page)
}
test('identical videos remain unchanged and analysis does not seek the preview', async ({
  page,
}) => {
  await seed(page, ['base.mp4', 'base.mp4'])
  expect((await analyze(page)).regions).toHaveLength(0)
  const time = await page.evaluate(async () => {
    const path = '/src/stores/playbackStore.ts'
    return (await import(path)).usePlaybackStore.getState().currentTime
  })
  expect(time).toBeCloseTo(0.1, 5)
})
for (const changed of ['changed.mp4', 'changed.mov']) {
  test(`detects a single frame and a plateau with ${changed}`, async ({ page }) => {
    await seed(page, ['base.mp4', changed])
    const state = await analyze(page)
    expect(state.unavailable).toBe(0)
    expect(state.regions).toHaveLength(2)
    expect(state.regions[0].start).toBeCloseTo(7 / 24, 4)
    expect(state.regions[0].end).toBeCloseTo(8 / 24, 4)
    expect(state.regions[1].start).toBeCloseTo(12 / 24, 4)
    expect(state.regions[1].end).toBeCloseTo(16 / 24, 4)
    await page.getByRole('button', { name: 'Next difference', exact: true }).first().click()
    await expect(page.getByLabel('Difference at playhead').first()).toContainText('100.00%')
    await page.getByTestId('difference-lane').hover()
    await expect(page.getByTestId('difference-lane')).toBeVisible()
  })
}
test('finds a short VFR interval absent from the other video frame grid', async ({ page }) => {
  await seed(page, ['base.mp4', 'vfr.mp4'])
  const state = await analyze(page)
  expect(state.unavailable).toBe(0)
  expect(state.regions).toHaveLength(1)
  expect(state.regions[0].start).toBeCloseTo(8 / 48, 4)
  expect(state.regions[0].end).toBeCloseTo(9 / 48, 4)
})
test('area changes reuse scores; source edits invalidate them', async ({ page }) => {
  await seed(page, ['base.mp4', 'partial.mp4'])
  const initial = await analyze(page)
  expect(initial.regions).toHaveLength(1)
  await page.getByLabel('Difference settings', { exact: true }).first().click()
  await page.getByLabel('Difference area (%)', { exact: true }).first().fill('10')
  const updated = await result(page)
  expect(updated.regions).toHaveLength(0)
  expect(updated.jobId).toBe(initial.jobId)
  await page.evaluate(async () => {
    const path = '/src/stores/timelineStore.ts'
    const store = (await import(path)).useTimelineStore
    const track = store.getState().tracks.find((item: { type: string }) => item.type === 'b')
    store.getState().updateClip(track.clips[0].id, { startTime: 0.1 })
  })
  await expect(page.getByTestId('difference-status').first()).toHaveAttribute(
    'data-status',
    'stale',
  )
})
test('reports missing footage rather than reporting a matching tail', async ({ page }) => {
  await seed(page, ['base.mp4', 'short.mp4'])
  const state = await analyze(page)
  expect(state.unavailable).toBeGreaterThan(0)
  expect(state.regions).toHaveLength(0)
  await expect(page.getByTestId('difference-status').first()).toContainText('unavailable')
})
test('preserves results across comparison modes', async ({ page }) => {
  await seed(page, ['base.mp4', 'changed.mp4'])
  const initial = await analyze(page)
  await page.evaluate(async () => {
    const path = '/src/stores/projectStore.ts'
    ;(await import(path)).useProjectStore.getState().setComparisonMode('side-by-side')
  })
  expect((await result(page)).regions).toEqual(initial.regions)
  expect((await result(page)).jobId).toBe(initial.jobId)
})

test('colour tolerance can suppress small decoded changes without suppressing a strict comparison', async ({
  page,
}) => {
  await seed(page, ['base.mp4', 'near-black.mp4'])
  const tolerant = await analyze(page)
  expect(tolerant.unavailable).toBe(0)
  expect(tolerant.regions).toHaveLength(0)
  await page.getByLabel('Difference settings', { exact: true }).first().click()
  await page.getByLabel('Colour tolerance (0–1)', { exact: true }).first().fill('0')
  await expect(page.getByTestId('difference-status').first()).toHaveAttribute(
    'data-status',
    'stale',
  )
  await page.getByLabel('Difference settings', { exact: true }).first().click()
  expect((await analyze(page)).regions).toHaveLength(1)
})

test('maps actual decoded frames through placement, trim, speed and reverse', async ({ page }) => {
  await seed(page, ['base.mp4', 'changed.mp4'])
  await page.evaluate(async () => {
    const path = '/src/stores/timelineStore.ts'
    const store = (await import(path)).useTimelineStore
    for (const track of store
      .getState()
      .tracks.filter((item: { type: string }) => ['a', 'b'].includes(item.type))) {
      store
        .getState()
        .updateClip(track.clips[0].id, {
          startTime: 2,
          endTime: 2.25,
          inPoint: 0.25,
          outPoint: 0.75,
          speed: 2,
          reverse: true,
        })
    }
  })
  const state = await analyze(page)
  expect(state.regions).toHaveLength(2)
  expect(state.regions[0].start).toBeCloseTo(2 + (0.75 - 16 / 24) / 2, 4)
  expect(state.regions[0].end).toBeCloseTo(2.125, 4)
  expect(state.regions[1].start).toBeCloseTo(2 + (0.75 - 8 / 24) / 2, 4)
  expect(state.regions[1].end).toBeCloseTo(2 + (0.75 - 7 / 24) / 2, 4)
})
