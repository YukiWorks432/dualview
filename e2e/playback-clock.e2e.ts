import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

async function upload(page: Page, label: string, file: string) {
  const previousClips = await page.locator('[data-clip]').count()
  const chooser = page.waitForEvent('filechooser')
  await page.getByText(label, { exact: true }).last().click()
  await (await chooser).setFiles(path.join(process.cwd(), 'e2e', 'fixtures', file))
  await expect(page.locator('[data-clip]')).toHaveCount(previousClips + 1)
}

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
    const state = usePlaybackStore.getState()
    const timeline = useTimelineStore.getState()
    return {
      time: state.currentTime,
      speed: state.playbackSpeed,
      direction: state.playbackDirection,
      playing: state.isPlaying,
      shuttle: timeline.shuttleSpeed,
      projectedTime: timeline.currentTime,
      wall: performance.now(),
    }
  })
}

async function seek(page: Page, time: number) {
  await page.evaluate(async (time) => {
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    usePlaybackStore.getState().seek(time)
  }, time)
}

async function expectColor(page: Page, track: 'a' | 'b', color: 'red' | 'blue') {
  const source = page
    .locator(`${track === 'a' ? 'video' : 'canvas'}[data-track="${track}"]`)
    .first()
  await expect
    .poll(
      () =>
        source.evaluate(async (element: HTMLVideoElement | HTMLCanvasElement) => {
          const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
          const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
          const { calculateMediaTime, findActiveClip } = await import('/src/lib/media/timeline.ts')
          const time = usePlaybackStore.getState().currentTime
          const clips =
            useTimelineStore.getState().tracks.find((track) => track.type === element.dataset.track)
              ?.clips ?? []
          const clip = findActiveClip(clips, time)
          if (!clip) return null
          const target = calculateMediaTime(time, clip)
          if (target === null) return null
          if (element instanceof HTMLVideoElement) {
            // An initial decoded frame need not trigger another frame callback.
            // Inspect real pixels only at this clip's current requested position.
            if (
              Math.abs(element.currentTime - target) > 0.000001 ||
              element.dataset.frameSourceClipId !== clip.id
            )
              return null
          } else if (
            element.dataset.frameReady !== 'true' ||
            Number(element.dataset.frameRequestedMediaTime) !== target ||
            element.dataset.frameClipId !== clip.id ||
            element.dataset.frameSeekGeneration !== element.dataset.framePresentedGeneration
          )
            return null
          if (element instanceof HTMLVideoElement && (element.seeking || element.readyState < 2))
            return null
          const canvas = document.createElement('canvas')
          canvas.width = canvas.height = 64
          const context = canvas.getContext('2d')!
          context.drawImage(element, 0, 0, 64, 64)
          const [r, g, b] = context.getImageData(32, 32, 1, 1).data
          if (r > 220 && g < 30 && b < 30) return 'red'
          if (b > 220 && r < 30 && g < 30) return 'blue'
          return `${r},${g},${b}`
        }),
      { timeout: 15_000 },
    )
    .toBe(color)
}

async function preparePair(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()
  await upload(page, 'Media A', 'playback-colors.webm')
  await upload(page, 'Media B', 'playback-colors.mov')
  await expectColor(page, 'a', 'red')
  await expectColor(page, 'b', 'red')
}

test('J/K/L, Space and speed selection advance the real clock and both displayed frames together', async ({
  page,
}) => {
  await preparePair(page)
  await seek(page, 2.7)
  await expectColor(page, 'a', 'blue')
  await expectColor(page, 'b', 'blue')
  await page.keyboard.press('j')
  await expect.poll(async () => (await snapshot(page)).shuttle).toBe(-1)
  const reverseStart = await snapshot(page)
  await page.waitForTimeout(300)
  await page.keyboard.press('Space')
  const reverseEnd = await snapshot(page)
  expect(reverseEnd.playing).toBe(false)
  expect(
    Math.abs(
      (reverseStart.time - reverseEnd.time) / ((reverseEnd.wall - reverseStart.wall) / 1000) - 1,
    ),
  ).toBeLessThan(0.3)
  expect(reverseEnd.projectedTime).toBe(reverseEnd.time)
  expect(reverseEnd.time).toBeLessThan(reverseStart.time - 0.2)
  await page.keyboard.press('k')
  await seek(page, 0.5)
  await page.keyboard.press('l')
  await page.keyboard.press('l')
  await expect(page.getByText('▶▶ 2×', { exact: true })).toBeVisible()
  const forwardStart = await snapshot(page)
  await page.waitForTimeout(300)
  await page.keyboard.press('Space')
  const forwardEnd = await snapshot(page)
  expect(forwardEnd.time - forwardStart.time).toBeGreaterThan(0.45)
  expect(
    Math.abs(
      (forwardEnd.time - forwardStart.time) / ((forwardEnd.wall - forwardStart.wall) / 1000) - 2,
    ),
  ).toBeLessThan(0.4)
  await page.getByRole('button', { name: '0.5×', exact: true }).click()
  expect(await snapshot(page)).toMatchObject({ speed: 0.5, direction: 1, shuttle: 0 })
  await seek(page, 1.9)
  await page.keyboard.press('Space')
  await expect.poll(async () => (await snapshot(page)).time).toBeGreaterThan(2.2)
  await page.keyboard.press('Space')
  await expectColor(page, 'a', 'blue')
  await expectColor(page, 'b', 'blue')
  await page.getByTitle('Go to start (Home)').click()
  await expectColor(page, 'a', 'red')
  await expectColor(page, 'b', 'red')
  await page.getByTitle('Go to end (End)').click()
  await expectColor(page, 'a', 'blue')
  await expectColor(page, 'b', 'blue')
})

test('paused markers, rapid seeks, clip crossings and project reload present the newest native/ProRes frame', async ({
  page,
}) => {
  await preparePair(page)
  const savedId = await page.evaluate(async () => {
    const { useTimelineStore: timeline } = await import('/src/stores/timelineStore.ts')
    const { usePlaybackStore: playback } = await import('/src/stores/playbackStore.ts')
    const { usePersistenceStore: persistence } = await import('/src/stores/persistenceStore.ts')
    timeline.setState({
      tracks: timeline.getState().tracks.map((track) => ({
        ...track,
        clips: track.clips.flatMap((clip) => [
          { ...clip, endTime: 2, outPoint: 2 },
          { ...clip, id: `${clip.id}-second`, startTime: 2, endTime: 4, inPoint: 2, outPoint: 4 },
        ]),
      })),
    })
    playback.getState().seek(2.5)
    timeline.getState().addMarker('Blue frame')
    await persistence.getState().saveCurrentProject()
    return persistence.getState().currentProjectId!
  })
  await seek(page, 0.5)
  await expectColor(page, 'a', 'red')
  await expectColor(page, 'b', 'red')
  await page.getByTitle(/^Blue frame -/).click({ position: { x: 5, y: 20 } })
  expect((await snapshot(page)).time).toBe(2.5)
  await expectColor(page, 'a', 'blue')
  await expectColor(page, 'b', 'blue')
  await page.evaluate(async () => {
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    for (const time of [0.4, 2.6, 0.6, 2.5]) usePlaybackStore.getState().seek(time)
  })
  await expectColor(page, 'a', 'blue')
  await expectColor(page, 'b', 'blue')
  const video = page.locator('video[data-track="a"]').first()
  const prores = page.locator('canvas[data-track="b"]').first()
  await expect
    .poll(() =>
      video.evaluate((element) => ({
        time: element.currentTime,
        clip: element.dataset.framePresentedClipId,
      })),
    )
    .toMatchObject({ time: 2.5, clip: expect.stringMatching(/-second$/) })
  await expect
    .poll(() =>
      prores.evaluate((element) => ({
        time: element.dataset.frameRequestedMediaTime,
        clip: element.dataset.frameClipId,
        current: element.dataset.frameSeekGeneration === element.dataset.framePresentedGeneration,
      })),
    )
    .toMatchObject({ time: '2.5', clip: expect.stringMatching(/-second$/), current: true })
  await page.evaluate(async (id) => {
    const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    await usePersistenceStore.getState().saveCurrentProject()
    await usePersistenceStore.getState().createNewProject('Other playback session')
    usePlaybackStore.getState().shuttleBackward()
    if (!(await usePersistenceStore.getState().loadProject(id))) throw new Error('reload failed')
  }, savedId)
  expect(await snapshot(page)).toMatchObject({
    time: 2.5,
    playing: false,
    direction: 1,
    shuttle: 0,
  })
  await expectColor(page, 'a', 'blue')
  await expectColor(page, 'b', 'blue')
})

test('embedded audio keeps clip placement, trims and speed, and stops during reverse shuttle', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const events: {
      id: number
      type: string
      rate?: number
      offset?: number
      duration?: number
    }[] = []
    const ids = new WeakMap<AudioBufferSourceNode, number>()
    let nextId = 0
    Object.defineProperty(window, '__playbackAudioEvents', { value: events })
    const start = AudioBufferSourceNode.prototype.start
    const stop = AudioBufferSourceNode.prototype.stop
    AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration?: number) {
      const id = ++nextId
      ids.set(this, id)
      events.push({ id, type: 'start', rate: this.playbackRate.value, offset, duration })
      if (duration === undefined) start.call(this, when, offset)
      else start.call(this, when, offset, duration)
    }
    AudioBufferSourceNode.prototype.stop = function (when = 0) {
      events.push({ id: ids.get(this) ?? -1, type: 'stop' })
      stop.call(this, when)
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()
  await upload(page, 'Media A', 'playback-colors.webm')
  await page.evaluate(async () => {
    const { useTimelineStore: timeline } = await import('/src/stores/timelineStore.ts')
    const { usePlaybackStore: playback } = await import('/src/stores/playbackStore.ts')
    const { useProjectStore: project } = await import('/src/stores/projectStore.ts')
    timeline.setState({
      tracks: timeline.getState().tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => ({
          ...clip,
          startTime: 1,
          endTime: 2.5,
          inPoint: 1,
          outPoint: 4,
          speed: 2,
        })),
      })),
    })
    playback.getState().seek(1.25)
    playback.getState().setSpeed(2)
    project.getState().setComparisonMode('audio')
  })
  await expect(page.getByText('INTEGRATED', { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  })
  await page.keyboard.press('Space')
  const audioEvents = () =>
    page.evaluate(
      () =>
        (
          window as typeof window & {
            __playbackAudioEvents: {
              id: number
              type: string
              rate?: number
              offset?: number
              duration?: number
            }[]
          }
        ).__playbackAudioEvents,
    )
  await expect
    .poll(async () => (await audioEvents()).filter((event) => event.type === 'start').length)
    .toBeGreaterThan(0)
  const started = (await audioEvents()).find((event) => event.type === 'start')!
  expect(started.rate).toBe(4)
  expect(started.offset).toBeGreaterThanOrEqual(1.5)
  expect(started.offset).toBeLessThan(2.1)
  expect(started.offset! + started.duration!).toBeCloseTo(4)
  await page.keyboard.press('j')
  await expect
    .poll(async () => {
      const events = await audioEvents()
      return events
        .filter((event) => event.type === 'start')
        .every((event) => events.some((stop) => stop.type === 'stop' && stop.id === event.id))
    })
    .toBe(true)
  const count = (await audioEvents()).filter((event) => event.type === 'start').length
  await page.waitForTimeout(150)
  expect((await audioEvents()).filter((event) => event.type === 'start')).toHaveLength(count)
  await page.keyboard.press('k')
})
