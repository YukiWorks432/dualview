import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { cpus, loadavg, platform, release, totalmem } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'
import { build, preview } from 'vite'

import { startMemorySampling, summarizeMemory, summarizeMemoryTrials } from './process-memory.mjs'

if (platform() !== 'linux') throw new Error('This RSS diagnostic requires Linux procps ps')
const root = fileURLToPath(new URL('../..', import.meta.url))
process.chdir(root)
const out = path.resolve(process.argv[2] ?? 'test-results/production-audio-memory')
mkdirSync(path.dirname(out), { recursive: true })
mkdirSync(out) // Keep previous attempts; never overwrite evidence.
const fixture = path.join(root, 'e2e/fixtures/audio-long.webm')
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const trials = Array.from({ length: 3 }, (_, i) =>
  [1, 4].map((rate) => ({ id: `r${i + 1}-cpu${rate}`, repetition: i + 1, rate })),
).flat()
const manifest = {
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  scriptSha256: sha256(fileURLToPath(import.meta.url)),
  samplerSha256: sha256('e2e/diagnostics/process-memory.mjs'),
  lockSha256: sha256('pnpm-lock.yaml'),
  fixtureSha256: sha256(fixture),
  node: process.version,
  playwright: JSON.parse(readFileSync('node_modules/@playwright/test/package.json', 'utf8'))
    .version,
  kernel: release(),
  cpu: cpus()[0]?.model,
  cpus: cpus().length,
  totalMemoryBytes: totalmem(),
  build: 'Unmodified production build; no page instrumentation, tracing or forced GC',
  intervalMs: 100,
  trials,
  notes: [
    'Fresh dedicated browser for each trial, one context/page; no retries. OS/file/server caches remain shared.',
    'Sum of Linux procps RSS for root and current descendants; shared pages are double-counted. This is sampled process RSS, not unique physical memory, a strict peak, JS heap, or a memory budget guarantee.',
    'Short-lived or reparented processes and memory between samples may be missed; external GPU/driver allocations are not comprehensively measured. ps collection is not atomic across processes.',
    '100ms is a requested delay after each sample, not a guaranteed sampling period. Raw sample starts/ends, errors, phase changes and PID rows are retained.',
    'CPU rate4 is CDP throttling, not an actual slow device or controlled host load. Load averages are context, not proof of causation or isolation.',
    'Before/completed/exited observations each span 1000ms without forced GC. RSS retained after exit alone is not a leak; reclamation is browser/OS-dependent.',
    'Three trials per condition: keep all raw values. No tail quantile, improvement claim, performance threshold or Issue closure.',
  ],
}
const records = []
const save = () =>
  writeFileSync(
    path.join(out, 'results.json'),
    JSON.stringify({ manifest, records, groups: summarizeMemoryTrials(records) }, null, 2),
  )
writeFileSync(path.join(out, 'plan.json'), JSON.stringify(manifest, null, 2))
await build({
  root,
  configFile: path.join(root, 'vite.config.ts'),
  build: { outDir: path.join(out, 'dist'), emptyOutDir: false },
})
const server = await preview({
  root,
  configFile: path.join(root, 'vite.config.ts'),
  build: { outDir: path.join(out, 'dist') },
  preview: { host: '127.0.0.1', port: 4179, strictPort: true },
})
const dwell = () => new Promise((resolve) => setTimeout(resolve, 1000))
const cap = (promise, ms) => {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Trial observation cap exceeded')), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}
try {
  for (const trial of trials) {
    const record = { ...trial, loadBefore: loadavg(), samples: [], phaseMarks: [] }
    records.push(record)
    let browserServer, browser, sampler
    let phase = 'setup'
    const enter = (next) => {
      phase = next
      record.phaseMarks.push({ phase, at: performance.now() })
    }
    try {
      browserServer = await chromium.launchServer({
        executablePath: process.env.BROWSER_EXECUTABLE_PATH,
        headless: true,
        chromiumSandbox: true,
      })
      const rootPid = browserServer.process().pid
      if (!rootPid) throw new Error('Browser process ID unavailable')
      record.rootPid = rootPid
      browser = await chromium.connect(browserServer.wsEndpoint())
      record.browser = browser.version()
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await context.newPage()
      page.on('pageerror', (error) => (record.pageErrors ??= []).push(String(error)))
      page.setDefaultTimeout(30000)
      await cap(
        (async () => {
          await page.goto('http://127.0.0.1:4179')
          await page.bringToFront()
          await page.getByRole('button', { name: 'Hide filmstrip' }).click()
          for (const label of ['Media A', 'Media B']) {
            const n = await page.locator('[data-clip]').count()
            const chooser = page.waitForEvent('filechooser')
            await page.getByText(label, { exact: true }).last().click()
            await (await chooser).setFiles(fixture)
            await page.waitForFunction(
              (n) => document.querySelectorAll('[data-clip]').length === n + 1,
              n,
            )
          }
          const cdp = await context.newCDPSession(page)
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: trial.rate })
          record.pageState = await page.evaluate(() => ({
            visibility: document.visibilityState,
            focused: document.hasFocus(),
          }))
          enter('before-audio')
          sampler = startMemorySampling(rootPid, () => phase)
          await dwell()
          enter('audio-processing')
          await page.getByRole('tab', { name: 'Audio QA comparison mode', exact: true }).click()
          await page.getByText('INTEGRATED', { exact: true }).nth(1).waitFor()
          enter('completed')
          await dwell()
          await page.getByRole('tab', { name: 'Slider comparison mode', exact: true }).click()
          await page.waitForFunction(
            () =>
              document
                .querySelector('[role="tab"][aria-label="Slider comparison mode"]')
                ?.getAttribute('aria-selected') === 'true',
          )
          enter('exited')
          await dwell()
        })(),
        60000,
      )
    } catch (error) {
      record.error = String(error)
    } finally {
      if (sampler) record.samples = await sampler.stop()
      record.summary = summarizeMemory(record.samples)
      record.loadAfter = loadavg()
      record.valid =
        !record.error &&
        !record.pageErrors?.length &&
        Object.values(record.summary).every((s) => s.samples > 0 && s.missing === 0)
      save()
      await browser?.close()
      await browserServer?.close()
      console.log(
        JSON.stringify({
          id: record.id,
          valid: record.valid,
          error: record.error,
          summary: record.summary,
        }),
      )
    }
  }
} finally {
  await new Promise((resolve) => server.httpServer.close(resolve))
  save()
}
if (records.some((r) => !r.valid)) process.exitCode = 1
