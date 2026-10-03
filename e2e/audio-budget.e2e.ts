import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

interface StartedAudio {
  node: AudioBufferSourceNode
  rate: number
  offset: number
  duration: number | undefined
  channels: number | undefined
}

type AudioTestWindow = typeof window & {
  __startedAudio: StartedAudio[]
  __largeAudioBuffers: number
  __onLargeAudioBuffer?: () => void
}

async function observeAudio(page: Page) {
  await page.addInitScript(() => {
    const state = window as AudioTestWindow
    state.__startedAudio = []
    state.__largeAudioBuffers = 0
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration?: number) {
      state.__startedAudio.push({
        node: this,
        rate: this.playbackRate.value,
        offset,
        duration,
        channels: this.buffer?.numberOfChannels,
      })
      if (duration === undefined) start.call(this, when, offset)
      else start.call(this, when, offset, duration)
    }
    const OriginalAudioBuffer = window.AudioBuffer
    window.AudioBuffer = new Proxy(OriginalAudioBuffer, {
      construct(target, args) {
        const result = Reflect.construct(target, args) as AudioBuffer
        if (result.duration > 100) {
          state.__largeAudioBuffers++
          if (state.__onLargeAudioBuffer) setTimeout(state.__onLargeAudioBuffer, 0)
        }
        return result
      },
    })
  })
}

async function upload(page: Page, label: string, file: string) {
  const count = await page.locator('[data-clip]').count()
  const chooser = page.waitForEvent('filechooser')
  await page.getByText(label, { exact: true }).last().click()
  await (await chooser).setFiles(path.join(process.cwd(), 'e2e', 'fixtures', file))
  await expect(page.locator('[data-clip]')).toHaveCount(count + 1)
}

async function open(page: Page) {
  await observeAudio(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hide filmstrip' }).click()
}

async function started(page: Page) {
  return page.evaluate(() =>
    (window as AudioTestWindow).__startedAudio.map(({ node, ...event }) => ({
      ...event,
      released: node.buffer === null,
    })),
  )
}

test('mono通常動画と逆相stereo ProResを解析し、配置・trim・速度・無音の逆再生を保つ', async ({
  page,
}) => {
  await open(page)
  await upload(page, 'Media A', 'playback-colors.webm')
  await upload(page, 'Media B', 'audio-stereo.mov')
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
  await expect(page.getByText('INTEGRATED', { exact: true })).toHaveCount(2)
  await expect(page.getByText('Sample Peak', { exact: true })).toHaveCount(2)
  await expect(page.getByText('-6.0 dB', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'B', exact: true }).click()
  await page.getByRole('button', { name: 'Stereo', exact: true }).click()
  await expect(page.getByText('-1.00', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'A+B', exact: true }).click()
  await page.evaluate(async () => {
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    usePlaybackStore.getState().play()
  })
  await expect.poll(async () => (await started(page)).length).toBeGreaterThanOrEqual(2)
  const sources = (await started(page)).slice(0, 2)
  expect(sources.map((source) => source.channels).sort()).toEqual([1, 2])
  for (const source of sources) {
    expect(source.rate).toBe(4)
    expect(source.offset).toBeGreaterThanOrEqual(1.5)
    expect(source.offset).toBeLessThan(2.1)
    expect(source.offset + source.duration!).toBeCloseTo(4)
  }
  await page.evaluate(async () => {
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    usePlaybackStore.getState().shuttleBackward()
  })
  await expect.poll(async () => (await started(page)).every((source) => source.released)).toBe(true)
  const reverseStarts = (await started(page)).length
  await page.waitForTimeout(100)
  expect((await started(page)).length).toBe(reverseStarts)
  await page.evaluate(async () => {
    const { usePlaybackStore: playback } = await import('/src/stores/playbackStore.ts')
    const { useTimelineStore: timeline } = await import('/src/stores/timelineStore.ts')
    playback.getState().pause()
    playback.getState().setSpeed(1)
    timeline.setState({
      tracks: timeline.getState().tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => ({ ...clip, reverse: true })),
      })),
    })
    playback.getState().seek(1.25)
    playback.getState().play()
  })
  await page.waitForTimeout(100)
  expect((await started(page)).length).toBe(reverseStarts)
})

test('長尺Aの処理中に同じIDの素材を交換し、旧Bのdecodeと旧結果採用を止める', async ({ page }) => {
  await open(page)
  await upload(page, 'Media A', 'audio-long.webm')
  await upload(page, 'Media B', 'audio-long.webm')
  await page.evaluate(async () => {
    const { useMediaStore } = await import('/src/stores/mediaStore.ts')
    const { useProjectStore } = await import('/src/stores/projectStore.ts')
    const file = new File(
      [await (await fetch('/e2e/fixtures/audio-stereo.mov')).blob()],
      'replacement.mov',
      { type: 'video/quicktime' },
    )
    const state = window as AudioTestWindow
    state.__onLargeAudioBuffer = () => {
      state.__onLargeAudioBuffer = undefined
      useMediaStore.setState({
        files: useMediaStore.getState().files.map((media) => ({
          ...media,
          file,
          name: file.name,
          duration: 4,
          playbackBackend: 'mediabunny' as const,
          videoCodec: 'prores',
        })),
      })
    }
    useProjectStore.getState().setComparisonMode('audio')
  })
  await expect(page.getByText('INTEGRATED', { exact: true })).toHaveCount(2, { timeout: 30000 })
  await expect(
    page
      .getByText('Sample Peak', { exact: true })
      .locator('..')
      .getByText('-6.0 dB', { exact: true }),
  ).toHaveCount(2)
  expect(await page.evaluate(() => (window as AudioTestWindow).__largeAudioBuffers)).toBe(1)
  await page.waitForTimeout(200)
  await expect(
    page
      .getByText('Sample Peak', { exact: true })
      .locator('..')
      .getByText('-6.0 dB', { exact: true }),
  ).toHaveCount(2)
  await page.evaluate(async () => {
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    usePlaybackStore.getState().play()
  })
  await expect.poll(async () => (await started(page)).length).toBeGreaterThanOrEqual(2)
  await page.evaluate(async () => {
    const { useProjectStore } = await import('/src/stores/projectStore.ts')
    useProjectStore.getState().setComparisonMode('slider')
  })
  await expect.poll(async () => (await started(page)).every((source) => source.released)).toBe(true)
  await page.evaluate(async () => {
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    const { useProjectStore } = await import('/src/stores/projectStore.ts')
    usePlaybackStore.getState().pause()
    useProjectStore.getState().setComparisonMode('audio')
  })
  await expect(page.getByText('INTEGRATED', { exact: true })).toHaveCount(2)
  await page.evaluate(async () => {
    const { useMediaStore } = await import('/src/stores/mediaStore.ts')
    useMediaStore.getState().clearFiles()
  })
  await expect(page.getByText('INTEGRATED', { exact: true })).toHaveCount(0)
  await expect.poll(async () => (await started(page)).every((source) => source.released)).toBe(true)
})

test('実ブラウザーの長尺解析がイベントを処理し、取消後に結果を返さない', async ({
  page,
  browser,
}, testInfo) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { analyzeAudio } = await import('/src/lib/audio/AudioAnalyzer.ts')
    const buffer = new AudioBuffer({ length: 48000 * 120, sampleRate: 48000, numberOfChannels: 2 })
    buffer.getChannelData(0).fill(0.25)
    buffer.getChannelData(1).fill(-0.25)
    const controller = new AbortController()
    const requestedDelayMs = 10
    const start = performance.now()
    let abortAt: number | null = null
    let settled = false
    let abortBeforeSettlement = false
    let outcome = 'fulfilled'
    let errorName: string | null = null
    const timer = setTimeout(() => {
      abortAt = performance.now()
      abortBeforeSettlement = !settled
      controller.abort()
    }, requestedDelayMs)
    try {
      await analyzeAudio(buffer, controller.signal)
    } catch (error) {
      outcome = 'rejected'
      errorName = error instanceof Error ? error.name : String(error)
    } finally {
      settled = true
      clearTimeout(timer)
    }
    const end = performance.now()
    return {
      outcome,
      errorName,
      abortBeforeSettlement,
      requestedDelayMs,
      timerDelayMs: abortAt === null ? null : abortAt - start - requestedDelayMs,
      abortResponseMs: abortAt === null ? null : end - abortAt,
      totalMs: end - start,
      // 旧100ms値は診断専用。環境・負荷を定めた性能基準の達成とは扱わない。
      exceededPrevious100ms: end - start >= 100,
    }
  })
  const diagnostic = { browser: browser.version(), ...result }
  console.info('audio-cancellation:', JSON.stringify(diagnostic))
  await testInfo.attach('audio-cancellation', {
    body: JSON.stringify(diagnostic, null, 2),
    contentType: 'application/json',
  })
  expect(result.abortBeforeSettlement).toBe(true)
  expect(result.outcome).toBe('rejected')
  expect(result.errorName).toBe('AbortError')
})
