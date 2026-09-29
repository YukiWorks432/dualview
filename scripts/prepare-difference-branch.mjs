// Temporary, exact source corrections for this feature branch. Removed before final review.
import { readFileSync, writeFileSync } from 'node:fs'
function replace(path, before, after) {
  const source = readFileSync(path, 'utf8')
  if (source.includes(after)) return
  if (source.split(before).length !== 2) throw new Error(`Unexpected integration point in ${path}`)
  writeFileSync(path, source.replace(before, after))
}
const controls = 'src/components/timeline/DifferenceControls.tsx'
replace(controls, 'container.scrollLeft = Math.max(0, x - container.clientWidth / 2)', 'container.scrollTo({ left: Math.max(0, x - container.clientWidth / 2) })')
replace(controls, 'state.descriptions.map((description) =>', 'state.descriptions.map((description, index) =>')
replace(controls, 'key={description}', 'key={`${index}:${description}`}')
const timingTests = 'src/lib/difference/model.test.ts'
replace(timingTests, 'expect(() => pairWindows([clip({ speed: 0 })], [], 1)).toThrow()', "expect(() => pairWindows([clip({ speed: 0 })], [], 1)).toThrow('Invalid timing for clip')")
replace(timingTests, 'expect(() => normalizeFrameTimings([], 1)).toThrow()', "expect(() => normalizeFrameTimings([], 1)).toThrow('No usable video frame timestamps')")
replace(timingTests, ').toThrow()', ").toThrow('Ambiguous or invalid video frame timestamps')")
const lifecycleTests = 'src/stores/differenceStore.test.ts'
replace(lifecycleTests, 'terminate = vi.fn()', 'terminate = vi.fn<() => void>()')
replace(lifecycleTests, 'postMessage = vi.fn()', 'postMessage = vi.fn<(message: unknown) => void>()')
const browserTests = 'tests/browser/difference.e2e.ts'
const addition = `

test('colour tolerance can suppress small decoded changes without suppressing a strict comparison', async ({ page }) => {
  await seed(page, ['base.mp4', 'near-black.mp4'])
  const tolerant = await analyze(page)
  expect(tolerant.unavailable).toBe(0)
  expect(tolerant.regions).toHaveLength(0)
  await page.getByLabel('Difference settings', { exact: true }).first().click()
  await page.getByLabel('Colour tolerance (0–1)', { exact: true }).first().fill('0')
  await expect(page.getByTestId('difference-status').first()).toHaveAttribute('data-status', 'stale')
  await page.getByLabel('Difference settings', { exact: true }).first().click()
  expect((await analyze(page)).regions).toHaveLength(1)
})

test('maps actual decoded frames through placement, trim, speed and reverse', async ({ page }) => {
  await seed(page, ['base.mp4', 'changed.mp4'])
  await page.evaluate(async () => {
    const path = '/src/stores/timelineStore.ts'
    const store = (await import(path)).useTimelineStore
    for (const track of store.getState().tracks.filter((item: { type: string }) => ['a', 'b'].includes(item.type))) {
      store.getState().updateClip(track.clips[0].id, { startTime: 2, endTime: 2.25, inPoint: 0.25, outPoint: 0.75, speed: 2, reverse: true })
    }
  })
  const state = await analyze(page)
  expect(state.regions).toHaveLength(2)
  expect(state.regions[0].start).toBeCloseTo(2 + (0.75 - 16 / 24) / 2, 4)
  expect(state.regions[0].end).toBeCloseTo(2.125, 4)
  expect(state.regions[1].start).toBeCloseTo(2 + (0.75 - 8 / 24) / 2, 4)
  expect(state.regions[1].end).toBeCloseTo(2 + (0.75 - 7 / 24) / 2, 4)
})
`
if (!readFileSync(browserTests, 'utf8').includes("test('colour tolerance can suppress")) writeFileSync(browserTests, readFileSync(browserTests, 'utf8') + addition)
