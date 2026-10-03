import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

const modulePath = '/e2e/diagnostics/observers.ts'
const manifest = JSON.parse(readFileSync('test-results/audio-diagnostic-manifest.json', 'utf8'))

async function setup(page: Page, ui = false) {
  await page.goto('/')
  await page.bringToFront()
  await page.evaluate(
    async ({ modulePath, ui }) => {
      const observer = await import(/* @vite-ignore */ modulePath)
      observer.installObservers()
      if (ui) {
        const queuePath = '/src/lib/audio/AudioJobQueue.ts'
        const projectPath = '/src/stores/projectStore.ts'
        const { audioAnalysisQueue } = await import(/* @vite-ignore */ queuePath)
        const { useProjectStore } = await import(/* @vite-ignore */ projectPath)
        observer.observeQueue(audioAnalysisQueue)
        useProjectStore.subscribe(
          (next: { comparisonMode: string }, previous: { comparisonMode: string }) => {
            if (next.comparisonMode !== previous.comparisonMode)
              observer.mark('project:mode-change', {
                from: previous.comparisonMode,
                to: next.comparisonMode,
              })
          },
        )
        observer.startHeartbeat()
      }
    },
    { modulePath, ui },
  )
  if (ui) await page.getByRole('button', { name: 'Hide filmstrip' }).click()
}

async function upload(page: Page, label: string, filename: string) {
  const count = await page.locator('[data-clip]').count()
  const chooser = page.waitForEvent('filechooser')
  await page.getByText(label, { exact: true }).last().click()
  await (await chooser).setFiles(path.join(process.cwd(), 'e2e', 'fixtures', filename))
  await expect(page.locator('[data-clip]')).toHaveCount(count + 1)
}

async function diagnostic(page: Page) {
  return page.evaluate(async (modulePath) => {
    const observer = await import(/* @vite-ignore */ modulePath)
    return observer.snapshot()
  }, modulePath)
}

async function waitForIdle(page: Page) {
  await expect
    .poll(
      async () => {
        const d = await diagnostic(page)
        return d.active.length === 0 && !d.queue?.active && d.queue?.pending === 0
      },
      { timeout: 30_000 },
    )
    .toBe(true)
}

test.afterEach(async ({ page, browser }, testInfo) => {
  let observation: unknown
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    observation = await Promise.race([
      page.evaluate(async (modulePath) => {
        const observer = await import(/* @vite-ignore */ modulePath)
        return observer.finishObservation()
      }, modulePath),
      new Promise((resolve) => {
        timer = setTimeout(
          () =>
            resolve({
              unavailable:
                'Renderer did not return the final snapshot within 2 seconds; inspect the preserved trace and test error.',
            }),
          2000,
        )
      }),
    ])
  } catch (error) {
    observation = { unavailable: String(error) }
  } finally {
    clearTimeout(timer)
  }
  const report = {
    title: testInfo.title,
    status: testInfo.status,
    expectedStatus: testInfo.expectedStatus,
    retry: testInfo.retry,
    browser: browser.version(),
    manifest,
    errors: testInfo.errors.map(({ message, stack }) => ({ message, stack })),
    observation,
  }
  console.log(
    `AUDIO_DIAGNOSTIC ${JSON.stringify({ title: report.title, status: report.status, retry: report.retry })}`,
  )
  await testInfo.attach('audio-diagnostic.json', {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: 'application/json',
  })
})

// Predeclared order: baseline/current pairs 1, 2, 3. No pass-seeking retries.
// Separate contexts per test; the same browser/dependencies/runner are used throughout.
for (const pair of [1, 2, 3]) {
  for (const variant of ['baseline', 'current'] as const) {
    test(`pair ${pair} ${variant}: real AudioBuffer algorithm cancellation`, async ({
      page,
    }, testInfo) => {
      await setup(page)
      const result = await page.evaluate(
        async ({ variant, modulePath }) => {
          const observer = await import(/* @vite-ignore */ modulePath)
          const analyzerPath =
            variant === 'baseline'
              ? '/e2e/diagnostics/.generated/AudioAnalyzer.ts'
              : '/src/lib/audio/AudioAnalyzer.ts?audio-diagnostic-original'
          const { analyzeAudio } = await import(/* @vite-ignore */ analyzerPath)
          // Allocation/fill are intentionally outside this algorithm-only measurement.
          const buffer = new AudioBuffer({
            length: 48000 * 120,
            sampleRate: 48000,
            numberOfChannels: 2,
          })
          buffer.getChannelData(0).fill(0.25)
          buffer.getChannelData(1).fill(-0.25)
          const controller = new AbortController()
          const t0 = performance.now()
          const requestedAt = t0 + 10
          let callbackAt: number | null = null
          let settledAt: number | null = null
          let outcome = 'not-settled'
          let returnedResult = false
          observer.mark('algorithm:t0', { t0, requestedAt, variant })
          let timerDone!: () => void
          const callback = new Promise<void>((resolve) => {
            timerDone = resolve
          })
          setTimeout(() => {
            callbackAt = performance.now()
            observer.mark('algorithm:abort-callback', { callbackAt })
            controller.abort()
            timerDone()
          }, 10)
          try {
            await analyzeAudio(buffer, controller.signal)
            returnedResult = true
            outcome = 'fulfilled'
          } catch (error) {
            outcome = error instanceof Error ? error.name : 'unknown-error'
          } finally {
            settledAt = performance.now()
            observer.mark('algorithm:settled', { settledAt, outcome, returnedResult })
          }
          // Do not cancel a delayed baseline timer: its actual arrival is essential evidence.
          await callback
          const measured = {
            variant,
            t0,
            requestedAt,
            callbackAt,
            settledAt,
            outcome,
            returnedResult,
            elapsedMs: settledAt - t0,
            callbackToSettleMs: settledAt - callbackAt!,
            callbackLatenessMs: callbackAt! - requestedAt,
          }
          observer.mark('algorithm:result', measured)
          return measured
        },
        { variant, modulePath },
      )
      await testInfo.attach('algorithm-result.json', {
        body: Buffer.from(JSON.stringify(result, null, 2)),
        contentType: 'application/json',
      })
      // Correctness only. The existing assistant-added <100 ms assertion is unchanged elsewhere;
      // it is not a user-approved latency requirement.
      if (variant === 'current') {
        expect(result.outcome).toBe('AbortError')
        expect(result.returnedResult).toBe(false)
      } else expect(result.outcome).toBe('fulfilled')
    })

    test(`pair ${pair} ${variant}: full synthetic Opus materialization extraction analysis window`, async ({
      page,
    }, testInfo) => {
      await setup(page)
      const result = await page.evaluate(
        async ({ variant, modulePath }) => {
          const observer = await import(/* @vite-ignore */ modulePath)
          const root = '/e2e/diagnostics/.generated/'
          const analyzerPath =
            variant === 'baseline'
              ? root + 'AudioAnalyzer.ts'
              : '/src/lib/audio/AudioAnalyzer.ts?audio-diagnostic-original'
          const extractionPath =
            variant === 'baseline'
              ? root + 'audio.ts'
              : '/src/lib/media/audio.ts?audio-diagnostic-original'
          const { analyzeAudio } = await import(/* @vite-ignore */ analyzerPath)
          const { extractPrimaryAudioBuffer } = await import(/* @vite-ignore */ extractionPath)
          observer.startHeartbeat()
          const t0 = performance.now()
          observer.mark('media:t0', {
            t0,
            variant,
            fixture: 'audio-long.webm',
            synthetic: true,
            codec: 'Opus',
            historicalProResUsed: false,
          })
          const response = await fetch('/e2e/fixtures/audio-long.webm')
          if (!response.ok) throw new Error(`Synthetic fixture fetch failed: ${response.status}`)
          observer.mark('media:response')
          const blob = await response.blob()
          observer.mark('media:blob-ready', { bytes: blob.size })
          const file = new File([blob], 'audio-long.webm', { type: 'video/webm' })
          observer.mark('media:file-ready', { bytes: file.size })
          const extracted = await observer.observeCall('extractPrimaryAudioBuffer', [file], () =>
            extractPrimaryAudioBuffer(file),
          )
          const extractedAt = performance.now()
          if (!extracted) throw new Error('No audio extracted from synthetic fixture')
          const analyzed = await observer.observeCall('analyzeAudio', [extracted], () =>
            analyzeAudio(extracted),
          )
          const settledAt = performance.now()
          const heartbeatTimes = window
            .__audioDiagnostic!.events.filter(
              (event) =>
                event.kind === 'timer:heartbeat' && event.at >= t0 && event.at <= settledAt,
            )
            .map((event) => event.at)
          const gapEdges = [t0, ...heartbeatTimes, settledAt]
          const gaps = gapEdges.slice(1).map((at, index) => at - gapEdges[index])
          const fullWindowTimer = {
            ticks: heartbeatTimes.length,
            maxGapMs: Math.max(...gaps),
            firstGapMs: gaps[0],
            finalGapMs: gaps.at(-1),
            includesWindowEdges: true,
          }
          const result = {
            t0,
            extractedAt,
            settledAt,
            fullWindowMs: settledAt - t0,
            fullWindowTimer,
            duration: analyzed.duration,
            sampleRate: analyzed.sampleRate,
            channels: analyzed.channels,
            samplePeak: analyzed.loudness.samplePeak,
            correlation: analyzed.stereo.correlation,
          }
          observer.mark('media:settled', result)
          window.__audioDiagnostic!.stopHeartbeat?.()
          // Let buffered Long Task/Event Timing entries arrive; this is outside the timed window.
          await new Promise((resolve) => setTimeout(resolve, 50))
          return result
        },
        { variant, modulePath },
      )
      await testInfo.attach('full-window-result.json', {
        body: Buffer.from(JSON.stringify(result, null, 2)),
        contentType: 'application/json',
      })
      expect(result.duration).toBeGreaterThanOrEqual(119)
      expect(result.duration).toBeLessThanOrEqual(121)
      expect(result.sampleRate).toBe(48000)
      expect(result.channels).toBe(2)
      expect(Number.isFinite(result.samplePeak)).toBe(true)
      expect(result.correlation).toBeLessThan(-0.99)
    })
  }
}

test('current UI: real mode-exit click while A is active and B is pending', async ({
  page,
}, testInfo) => {
  await setup(page, true)
  await upload(page, 'Media A', 'audio-long.webm')
  await upload(page, 'Media B', 'audio-long.webm')
  const slider = page.getByRole('tab', { name: 'Slider comparison mode', exact: true })
  const bounds = await slider.boundingBox()
  expect(bounds).not.toBeNull()
  let ready!: () => void
  const allocated = new Promise<void>((resolve) => {
    ready = resolve
  })
  await page.exposeFunction('__largeBufferReady', () => ready())
  await page.evaluate(() => {
    window.__audioDiagnostic!.onLargeBuffer = () => {
      window.__audioDiagnostic!.onLargeBuffer = undefined
      // Notify the driver without delaying production work or gating the queue.
      void window.__largeBufferReady!()
    }
  })
  // Actual UI entry as well as exit. No setComparisonMode substitute for the exit.
  await page
    .getByRole('tab', { name: 'Audio QA comparison mode', exact: true })
    .click({ noWaitAfter: true })
  await allocated
  const driverRequestedAt = Date.now()
  await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2)
  const driverReturnedAt = Date.now()
  await testInfo.attach('driver-click.json', {
    body: Buffer.from(
      JSON.stringify(
        {
          driverRequestedAt,
          driverReturnedAt,
          durationMs: driverReturnedAt - driverRequestedAt,
          clock: 'driver Date.now; never subtracted from page performance.now',
        },
        null,
        2,
      ),
    ),
    contentType: 'application/json',
  })
  await expect(slider).toHaveAttribute('aria-selected', 'true')
  await waitForIdle(page)
  await expect(page.getByText('INTEGRATED', { exact: true })).toHaveCount(0)
  const d = await diagnostic(page)
  const click = d.events.find(
    (event: { kind: string; label?: string }) =>
      event.kind === 'dom:click' && event.label === 'Slider comparison mode',
  )
  expect(
    click,
    'The real exit click must arrive while A is active and B is pending; a missed overlap is retained as failure, never rerun until pass.',
  ).toMatchObject({ trusted: true, queue: { active: true, pending: 1 } })
  const aborts = d.events.filter(
    (event: { kind: string }) => event.kind === 'controller:abort-call',
  )
  expect(aborts.some((event: { at: number }) => event.at >= click.at)).toBe(true)
  expect(
    d.events.some(
      (event: { kind: string; at: number }) =>
        event.kind === 'queue:release' && event.at >= click.at,
    ),
  ).toBe(true)
  expect(
    d.events.filter((event: { kind: string }) => event.kind === 'extractPrimaryAudioBuffer:start'),
  ).toHaveLength(1)
  expect(
    d.events.filter((event: { kind: string }) => event.kind === 'playback:start'),
  ).toHaveLength(0)
  expect(
    d.events.some(
      (event: { kind: string; at: number }) =>
        event.kind === 'input:dispose-return' && event.at >= click.at,
    ),
  ).toBe(true)
  expect(
    d.events.some(
      (event: { kind: string; at: number }) =>
        event.kind === 'queue:work:rejected' && event.at >= click.at,
    ),
  ).toBe(true)
  expect(
    d.events.filter((event: { kind: string }) => event.kind === 'analyzeAudio:fulfilled'),
  ).toHaveLength(0)
  expect(d.sources.every((source: { released: boolean }) => source.released)).toBe(true)
})

test('current UI: synthetic same-ID replacement rejects stale display and playback ownership', async ({
  page,
}) => {
  await setup(page, true)
  await upload(page, 'Media A', 'audio-long.webm')
  await upload(page, 'Media B', 'audio-long.webm')
  const ownership = await page.evaluate(async (modulePath) => {
    const observer = await import(/* @vite-ignore */ modulePath)
    const mediaPath = '/src/stores/mediaStore.ts'
    const { useMediaStore } = await import(/* @vite-ignore */ mediaPath)
    const originalIds = useMediaStore.getState().files.map((media: { id: string; file: File }) => ({
      mediaId: media.id,
      fileId: observer.objectId(media.file),
    }))
    const file = new File(
      [await (await fetch('/e2e/fixtures/audio-stereo.mov')).blob()],
      'replacement.mov',
      { type: 'video/quicktime' },
    )
    const replacementFileId = observer.objectId(file)
    window.__audioDiagnostic!.onLargeBuffer = () => {
      window.__audioDiagnostic!.onLargeBuffer = undefined
      observer.mark('synthetic:replacement-scheduled', { delayMs: 0 })
      setTimeout(() => {
        const d = window.__audioDiagnostic!
        observer.mark('synthetic:same-ID-replacement', {
          queue: d.queue ? { ...d.queue } : null,
          originalIds,
          replacementFileId,
        })
        useMediaStore.setState({
          files: useMediaStore.getState().files.map((media: Record<string, unknown>) => ({
            ...media,
            file,
            name: file.name,
            duration: 4,
            playbackBackend: 'mediabunny',
            videoCodec: 'prores',
          })),
        })
        observer.mark('synthetic:store-replacement-returned')
      }, 0)
    }
    return { originalIds, replacementFileId }
  }, modulePath)
  await page.getByRole('tab', { name: 'Audio QA comparison mode', exact: true }).click()
  await expect(page.getByText('INTEGRATED', { exact: true })).toHaveCount(2, { timeout: 30_000 })
  await waitForIdle(page)
  const peaks = page
    .getByText('Sample Peak', { exact: true })
    .locator('..')
    .getByText('-6.0 dB', { exact: true })
  await expect(peaks).toHaveCount(2)
  // Original ownership regression's observation interval, not a performance acceptance limit.
  await page.waitForTimeout(200)
  await expect(peaks).toHaveCount(2)
  const d = await diagnostic(page)
  expect(
    d.events.find((event: { kind: string }) => event.kind === 'synthetic:same-ID-replacement'),
  ).toMatchObject({ queue: { active: true, pending: 1 } })
  expect(
    d.events.filter((event: { kind: string }) => event.kind === 'buffer:large-allocated'),
  ).toHaveLength(1)
  expect(
    d.events.filter(
      (event: { kind: string; sourceId?: number }) =>
        event.kind === 'extractPrimaryAudioBuffer:start' &&
        event.sourceId === ownership.originalIds[1].fileId,
    ),
  ).toHaveLength(0)
  await page.evaluate(async () => {
    const playbackPath = '/src/stores/playbackStore.ts'
    const { usePlaybackStore } = await import(/* @vite-ignore */ playbackPath)
    usePlaybackStore.getState().seek(0)
    usePlaybackStore.getState().play()
  })
  await expect.poll(async () => (await diagnostic(page)).sources.length).toBeGreaterThanOrEqual(2)
  const playing = await diagnostic(page)
  const starts = playing.events.filter((event: { kind: string }) => event.kind === 'playback:start')
  for (const start of starts) {
    expect(start.ownerFileId).toBe(ownership.replacementFileId)
    expect(start.bufferDuration).toBeCloseTo(4)
  }
  await page.getByRole('tab', { name: 'Slider comparison mode', exact: true }).click()
  await expect
    .poll(async () =>
      (await diagnostic(page)).sources.every((source: { released: boolean }) => source.released),
    )
    .toBe(true)
  await expect(page.getByText('INTEGRATED', { exact: true })).toHaveCount(0)
  await waitForIdle(page)
  const released = await diagnostic(page)
  const totalStarts = released.sources.length
  await page.waitForTimeout(200)
  expect((await diagnostic(page)).sources).toHaveLength(totalStarts)
  // Nodes are intentionally held by this test solely to inspect buffer === null; no GC claim.
})
