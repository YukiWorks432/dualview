import { mkdir } from 'node:fs/promises'

import { chromium } from '@playwright/test'

// Entirely local, original vector artwork: two grades of one landscape.
const output = 'tmp/pdfs'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.OG_CHROMIUM_PATH || undefined })
const context = await browser.newContext({
  viewport: { width: 1440, height: 820 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
  locale: 'en-US',
})
// Keep capture independent of remote font availability and private/network media.
await context.route('**/*', (route) =>
  new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort(),
)
const artwork = await context.newPage()
for (const [name, sky, sun, ridge] of [
  ['reference', '#9daecb', '#f5dbc1', '#527980'],
  ['revision', '#a4a0d3', '#ffd2a3', '#416b79'],
]) {
  await artwork.setViewportSize({ width: 960, height: 540 })
  await artwork.setContent(`<style>body{margin:0}</style><svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="${sun}"/></linearGradient></defs>
  <rect width="960" height="540" fill="url(#sky)"/>
  <circle cx="706" cy="160" r="56" fill="${sun}"/>
  <path d="M0 335 170 155 330 337 493 205 694 365 837 232 960 351V540H0Z" fill="${ridge}"/>
  <path d="m170 155-56 107 58-24 48 22Z" fill="#dbe1dc"/>
  <path d="m493 205-45 82 47-19 38 26Z" fill="#dbe1dc"/>
  <path d="M0 400 190 321 407 427 621 325 960 407V540H0Z" fill="#294e59"/>
  <path d="M0 465Q210 407 460 469T960 450V540H0Z" fill="#163440"/>
  <path d="M590 403Q520 456 662 540H550Q446 475 569 413Z" fill="#c0ced0"/>
  </svg>`)
  await artwork.screenshot({ path: `${output}/${name}.png` })
}
await artwork.close()
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
await page.goto(process.env.OG_BASE_URL || 'http://127.0.0.1:4175/')
for (const [track, file] of [
  ['A', 'reference'],
  ['B', 'revision'],
]) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByText(`Media ${track}`, { exact: true }).last().click()
  await (await chooser).setFiles(`${output}/${file}.png`)
  await page
    .locator('[data-clip]')
    .nth(track === 'A' ? 0 : 1)
    .waitFor()
}
await page.evaluate(() => document.fonts.ready)
await page.mouse.move(0, 0)
await page.waitForTimeout(1500)
await page.screenshot({ path: `${output}/current-ui.png`, animations: 'disabled' })
console.log(await page.locator('body').innerText())
await browser.close()
if (errors.length) throw new Error(errors.join('\n'))
