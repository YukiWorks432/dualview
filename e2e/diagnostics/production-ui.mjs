import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { cpus, totalmem, release } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'
import { build, preview } from 'vite'

import { summarizeTrial, summarizeGroups } from './production-ui-summary.mjs'
const root = fileURLToPath(new URL('../..', import.meta.url))
process.chdir(root)
const out = path.resolve(process.argv[2] ?? 'test-results/production-audio-ui')
// Refuse to overwrite previous attempts, including failures.
mkdirSync(path.dirname(out), { recursive: true })
mkdirSync(out)
const trials = Array.from({ length: 3 }, (_, repetition) =>
  [1, 4].flatMap((rate) =>
    [true, false].map((cancel) => ({
      id: `r${repetition + 1}-cpu${rate}-${cancel ? 'cancel' : 'complete'}`,
      repetition: repetition + 1,
      rate,
      cancel,
    })),
  ),
).flat()

const manifest = {
  build: 'production; test-only export/API observers injected; no application source edits',
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  scriptSha256: createHash('sha256')
    .update(readFileSync(fileURLToPath(import.meta.url)))
    .digest('hex'),
  lockSha256: createHash('sha256').update(readFileSync('pnpm-lock.yaml')).digest('hex'),
  node: process.version,
  playwright: JSON.parse(readFileSync('node_modules/@playwright/test/package.json', 'utf8'))
    .version,
  kernel: release(),
  cpu: cpus()[0]?.model,
  cpus: cpus().length,
  memoryBytes: totalmem(),
  fixture: {
    name: 'audio-long.webm',
    sha256: createHash('sha256')
      .update(readFileSync(root + '/e2e/fixtures/audio-long.webm'))
      .digest('hex'),
  },
  trials,
  notes: [
    'Production-only exploratory series. Three prespecified repetitions per condition, alternating normal/CDP 4x CPU throttle, cancellation/completion. No development-mode pooling.',
    'One browser, fresh context per trial, zero retries; retain every failure. Report n, missing n, min, median, max and all raw values, not a tail estimate or performance pass/fail threshold.',
    'Cold means no prior audio decode/analysis in the page; browser/server/disk cache are shared. Warm-page repeat runs are not part of this series.',
    'Rate4 means CDP 4x CPU throttle, not controlled external host load. Shared-host scheduling, CPU quotas and power state are not controlled.',
    'All clocks are page performance.now except driver requested/returned times, which are separate and never subtracted from page times. DOM event.timeStamp is reported with its limitations.',
    'Fixtures uploaded via real file chooser, Audio QA entered by real UI. Exit click notified at actual analyzeAudio entry; notification never awaits or holds work. No timer cancels analysis; real pointer does.',
    'All trials keep edge/queue/API aggregate observers; instrumentation has overhead. No CPU sampling, tracing, video, yield-loop changes or physical display measurement.',
    'DOM disappearance and two requestAnimationFrame callbacks mark render opportunities, not physical screen presentation. Missed overlap is invalid, not zero.',
    'No resident-memory measurement in this diagnostic. JS heap endpoint readings are not a peak. Each trial has a 45-second observation cap; timeout remains failed, never a performance success.',
  ],
}
writeFileSync(out + '/plan.json', JSON.stringify(manifest, null, 2))
const extra = {
  name: 'ui-profile-edges',
  enforce: 'pre',
  transform(code, id) {
    if (id.endsWith('/src/main.tsx'))
      return (
        code +
        `
import * as o from '/e2e/diagnostics/observers.ts';
import { audioAnalysisQueue } from '/src/lib/audio/AudioJobQueue.ts';
import { useProjectStore } from '/src/stores/projectStore.ts';
window.__uiModules={o,audioAnalysisQueue,useProjectStore};`
      )
  },
}
await build({
  root,
  configFile: root + '/vite.audio-diagnostic.config.ts',
  plugins: [extra],
  build: { outDir: out + '/dist', emptyOutDir: false, sourcemap: true },
})
const server = await preview({
  root,
  configFile: root + '/vite.config.ts',
  build: { outDir: out + '/dist' },
  preview: { host: '127.0.0.1', port: 4178, strictPort: true },
})
const browser = await chromium
  .launch({
    executablePath: process.env.BROWSER_EXECUTABLE_PATH,
    headless: true,
    chromiumSandbox: true,
  })
  .catch(async (error) => {
    await new Promise((resolve) => server.httpServer.close(resolve))
    throw error
  })
manifest.browser = browser.version()
writeFileSync(out + '/plan.json', JSON.stringify(manifest, null, 2))
const records = []
const until = (promise, ms, label) => {
  let t
  return Promise.race([
    promise,
    new Promise((_, rej) => {
      t = setTimeout(() => rej(Error(label)), ms)
    }),
  ]).finally(() => clearTimeout(t))
}
async function upload(page, label) {
  const n = await page.locator('[data-clip]').count()
  const chooser = page.waitForEvent('filechooser')
  await page.getByText(label, { exact: true }).last().click()
  await (await chooser).setFiles(root + '/e2e/fixtures/audio-long.webm')
  await page.waitForFunction((n) => document.querySelectorAll('[data-clip]').length === n + 1, n)
}
async function waitIdle(page) {
  await page.waitForFunction(
    () => {
      const d = window.__audioDiagnostic
      return d && d.active.size === 0 && !d.queue?.active && d.queue?.pending === 0
    },
    {},
    { timeout: 30000 },
  )
}
try {
  for (const trial of trials) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }),
      page = await context.newPage(),
      cdp = await context.newCDPSession(page)
    const record = { ...trial }
    records.push(record)

    try {
      await until(
        (async () => {
          page.on('pageerror', (error) => (record.pageErrors ??= []).push(String(error)))
          await page.goto('http://127.0.0.1:4178/')
          await page.bringToFront()
          await page.getByRole('button', { name: 'Hide filmstrip' }).click()
          await page.evaluate(async () => {
            const o = window.__uiModules.o
            o.installObservers()
            window.__uiMark = o.mark
            const { audioAnalysisQueue } = window.__uiModules
            o.observeQueue(audioAnalysisQueue)
            const { useProjectStore } = window.__uiModules
            useProjectStore.subscribe((n, p) => {
              if (n.comparisonMode !== p.comparisonMode)
                o.mark('project:mode-change', { from: p.comparisonMode, to: n.comparisonMode })
            })
            const originalSet = window.__audioDiagnostic.active.set.bind(
              window.__audioDiagnostic.active,
            )
            window.__audioDiagnostic.active.set = function (k, v) {
              const ret = originalSet(k, v)
              if (v.name === 'analyzeAudio' && window.__notifyNextAnalysis) {
                window.__notifyNextAnalysis = false
                o.mark('driver:analysis-notified', { call: k })
                void window.__analysisReady()
              }
              return ret
            }
            let seenAudio = false,
              exitSeen = false,
              fullSeen = false
            const mutation = new MutationObserver(() => {
              const audio =
                document
                  .querySelector('[role="tab"][aria-label="Audio QA comparison mode"]')
                  ?.getAttribute('aria-selected') === 'true'
              if (audio) seenAudio = true
              if (window.__uiMeasuring && seenAudio && !audio && !exitSeen) {
                exitSeen = true
                o.mark('ui:slider-dom')
                requestAnimationFrame(() => {
                  o.mark('ui:slider-frame-1')
                  requestAnimationFrame(() => o.mark('ui:slider-frame-2'))
                })
              }
              if (
                window.__uiMeasuring &&
                audio &&
                !fullSeen &&
                [...document.querySelectorAll('*')].filter(
                  (x) => x.children.length === 0 && x.textContent === 'INTEGRATED',
                ).length === 2
              ) {
                fullSeen = true
                o.mark('ui:analysis-results-dom')
                requestAnimationFrame(() => {
                  o.mark('ui:results-frame-1')
                  requestAnimationFrame(() => o.mark('ui:results-frame-2'))
                })
              }
            })
            mutation.observe(document.body, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['aria-selected'],
            })
          })
          await upload(page, 'Media A')
          await upload(page, 'Media B')
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: trial.rate })
          const audio = page.getByRole('tab', { name: 'Audio QA comparison mode', exact: true }),
            slider = page.getByRole('tab', { name: 'Slider comparison mode', exact: true })
          const bounds = await slider.boundingBox()
          if (!bounds) throw Error('No slider target bounds')
          let ready
          const analysisReady = new Promise((resolve) => (ready = resolve))
          await page.exposeFunction('__analysisReady', () => ready())
          await page.evaluate(async () => {
            const o = window.__uiModules.o
            window.__audioDiagnostic.events = []
            window.__audioDiagnostic.counts = {}
            window.__uiMeasuring = true
            window.__notifyNextAnalysis = true
            o.startHeartbeat()
            o.mark('ui:measurement-start', {
              heap: performance.memory
                ? {
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                  }
                : null,
            })
          }, trial.profile)

          await audio.click({ noWaitAfter: true })
          await until(analysisReady, 30000, 'No analysis start notification')
          if (trial.cancel) {
            record.driver = { clock: 'node performance.now only', requestedAt: performance.now() }
            await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
            record.driver.returnedAt = performance.now()
            await slider.waitFor()
            await page.waitForFunction(
              () =>
                document
                  .querySelector('[role="tab"][aria-label="Slider comparison mode"]')
                  ?.getAttribute('aria-selected') === 'true',
            )
          }
          await waitIdle(page)
          await page.waitForFunction(
            (cancel) =>
              window.__audioDiagnostic.events.some(
                (e) => e.kind === (cancel ? 'ui:slider-frame-2' : 'ui:results-frame-2'),
              ),
            trial.cancel,
            { timeout: 5000 },
          )
          record.observation = await page.evaluate(async () => {
            const o = window.__uiModules.o
            o.mark('ui:measurement-end', {
              heap: performance.memory
                ? {
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                  }
                : null,
            })
            return o.finishObservation()
          })
          const click = record.observation.events.find(
            (e) => e.kind === 'dom:click' && e.label === 'Slider comparison mode',
          )
          const activeAnalysis = click?.active?.find((a) => a.name === 'analyzeAudio')
          record.valid = trial.cancel
            ? !!(
                click?.trusted &&
                click.queue?.active &&
                click.queue?.pending === 1 &&
                activeAnalysis &&
                !record.observation.queue?.active &&
                record.observation.queue?.pending === 0 &&
                record.observation.events.some(
                  (e) =>
                    e.kind === 'analyzeAudio:rejected' &&
                    e.call === activeAnalysis.call &&
                    e.errorName === 'AbortError' &&
                    e.at >= click.at,
                )
              )
            : record.observation.events.filter((e) => e.kind === 'analyzeAudio:fulfilled')
                .length === 2
          await page.screenshot({ path: out + '/' + trial.id + '.png' })
        })(),
        45000,
        'Trial resource/time cap reached',
      )
    } catch (error) {
      record.error = String(error)
      record.valid = false
      try {
        record.observation = await until(
          page.evaluate(async () => {
            const o = window.__uiModules.o
            return o.finishObservation()
          }),
          2000,
          'Snapshot unavailable',
        )
      } catch (e) {
        record.snapshotError = String(e)
      }
    } finally {
      record.metrics = summarizeTrial(record)
      await context.close()
      writeFileSync(
        out + '/results.json',
        JSON.stringify({ manifest, records, groups: summarizeGroups(records) }, null, 2),
      )
      console.log(
        JSON.stringify({
          id: record.id,
          valid: record.valid,
          error: record.error,
          events: record.observation?.events?.length,
        }),
      )
    }
  }
} finally {
  await browser.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
}
if (records.some((r) => !r.valid || r.error || r.pageErrors?.length)) process.exitCode = 1
