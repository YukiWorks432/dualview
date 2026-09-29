// Temporary integration helper for this feature branch; removed before final PR review.
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'
function replaceOnce(path, before, after, sentinel = after) {
  const source = readFileSync(path, 'utf8')
  if (source.includes(sentinel)) return
  if (source.split(before).length !== 2) throw new Error(`Expected one exact integration point in ${path}: ${before}`)
  writeFileSync(path, source.replace(before, after))
}
const app = 'src/App.tsx'
replaceOnce(app, "import { useKeyboardShortcutsHelp } from './hooks/useKeyboardShortcutsHelp'", "import { useDifferenceLifecycle } from './hooks/useDifferenceLifecycle'\nimport { useKeyboardShortcutsHelp } from './hooks/useKeyboardShortcutsHelp'", "import { useDifferenceLifecycle }")
replaceOnce(app, 'export default function App() {', 'export default function App() {\n  useDifferenceLifecycle()', '  useDifferenceLifecycle()')
const timeline = 'src/components/timeline/Timeline.tsx'
replaceOnce(timeline, "import { TimelineClip } from './TimelineClip'", "import { DifferenceControls } from './DifferenceControls'\nimport { DifferencePlot } from './DifferencePlot'\nimport { TimelineClip } from './TimelineClip'", "import { DifferenceControls }")
replaceOnce(timeline, '    rulerHeight: 24,', '    rulerHeight: 44,')
replaceOnce(timeline, 'h-40 md:h-64 bg-surface border-t border-border flex flex-col', 'h-64 md:h-84 bg-surface border-t border-border flex flex-col')
replaceOnce(timeline, '      {/* Timeline area */}', '      <DifferenceControls containerRef={containerRef} pixelsPerSecond={pixelsPerSecond} />\n\n      {/* Timeline area */}', '<DifferenceControls containerRef=')
replaceOnce(timeline, '          <div className="h-6 border-b border-border" /> {/* Ruler spacer */}', '          <div className="h-6 border-b border-border" /> {/* Ruler spacer */}\n          <div className="h-5 border-b border-border px-2 text-[10px] text-text-muted">Diff</div>', '>Diff</div>')
replaceOnce(timeline, '            {/* Tracks */}', '            <DifferencePlot duration={duration} pixelsPerSecond={pixelsPerSecond} containerRef={containerRef} />\n\n            {/* Tracks */}', '<DifferencePlot duration=')
replaceOnce('vite.config.ts', '  plugins: [react(), tailwindcss()],', "  plugins: [react(), tailwindcss()],\n  worker: { format: 'es' },", '  worker:')
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
pkg.dependencies.pixelmatch = '^7.2.0'
pkg.devDependencies['@playwright/test'] = '^1.63.0'
pkg.scripts['test:browser'] = 'node scripts/create-difference-fixtures.mjs && playwright test'
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
for (const [path, sentinel, content] of [
  ['.gitignore', '# Difference browser tests', '\n# Difference browser tests\ntests/browser/fixtures/\nplaywright-report/\ntest-results/\n'],
  ['README.md', 'docs/timeline-differences.md', '\n### Timeline difference intervals\n\nUse **Analyze differences** above the timeline to inspect A/B video changes without seeking the preview. Colour tolerance and changed-area thresholds are separate; standard analysis reduces spatial detail, and results stay in the current session. See [analysis conditions and testing](docs/timeline-differences.md).\n'],
  ['public/licenses/additional-notices.md', 'pixelmatch-license.txt', '\n## pixelmatch\n\nThe timeline analysis worker includes pixelmatch (ISC, Copyright (c) 2025, Mapbox). See [the full license](pixelmatch-license.txt) and [the upstream source](https://github.com/mapbox/pixelmatch/tree/v7.2.0). This notice is included explicitly for the separately bundled worker.\n'],
]) {
  if (!readFileSync(path, 'utf8').includes(sentinel)) appendFileSync(path, content)
}
const ci = '.github/workflows/ci.yml'
if (!readFileSync(ci, 'utf8').includes('Browser difference tests')) appendFileSync(ci, '\n      - name: Set up FFmpeg\n        run: sudo apt-get update && sudo apt-get install -y ffmpeg\n\n      - name: Install test browser\n        run: pnpm exec playwright install --with-deps chromium\n\n      - name: Browser difference tests\n        run: pnpm test:browser\n')
