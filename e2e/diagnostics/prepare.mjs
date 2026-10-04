import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const baseline = 'daf3ac0111486b1233d21bac0c53144375779acb'
const reference = 'd91ed547328a25e837dacca9ce2594e58fd72301'
const generated = 'e2e/diagnostics/.generated'
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const sources = [
  [
    'src/lib/audio/AudioAnalyzer.ts',
    '5c9c8fcdc29791f9e9779fbf2f97fcddcbbccc6f',
    'eb15443c42b1452b136dd73a48c614261f50b5e9',
  ],
  [
    'src/lib/media/audio.ts',
    '03584029314955df97dd5afbd49917e4bb79329d',
    '50a6a35bf0300351117d8dee8f698f3b01a83a5f',
  ],
]
const manifest = {
  schema: 1,
  baseline,
  current: git('rev-parse', 'HEAD'),
  currentAudioReference: reference,
  runtime: { node: process.version, platform: process.platform, architecture: process.arch },
  comparison:
    'Exact baseline algorithm/extraction source under current dependencies; current UI only',
  order: [1, 2, 3].flatMap((pair) => ['baseline', 'current'].map((variant) => ({ pair, variant }))),
  historicalProResSha256: '56cf200e0354f9bcb5f9a5776731448f27a25e16732f0b4838eebbb030e121e3',
  historicalProResUsed: false,
  sourceHashes: [],
  fixtures: [],
}
mkdirSync(generated, { recursive: true })
mkdirSync('test-results', { recursive: true })
try {
  // The workflow fetches this exact commit first; a shallow checkout alone is insufficient.
  for (const [file, expectedBaseline, expectedCurrent] of sources) {
    const baselineBytes = execFileSync('git', ['show', `${baseline}:${file}`])
    const currentBytes = readFileSync(file)
    const baselineBlob = git('rev-parse', `${baseline}:${file}`)
    const currentBlob = git('hash-object', file)
    manifest.sourceHashes.push({
      file,
      baselineBlob,
      currentBlob,
      baselineSha256: sha256(baselineBytes),
      currentSha256: sha256(currentBytes),
    })
    if (baselineBlob !== expectedBaseline || currentBlob !== expectedCurrent) {
      throw new Error(`Source identity precondition failed: ${file}`)
    }
    writeFileSync(path.join(generated, path.basename(file)), baselineBytes)
  }
  for (const [file, expected] of [
    ['src/lib/audio/audioTask.ts', '2ff73de50f14ae2f6eac2f64e7303d7839e284ff'],
    ['src/lib/audio/AudioJobQueue.ts', '8d65655469e0161b842aaf22f6ea1db1c22087ee'],
  ]) {
    const actual = git('hash-object', file)
    manifest.sourceHashes.push({ file, currentBlob: actual })
    if (actual !== expected) throw new Error(`Source identity precondition failed: ${file}`)
  }
  for (const file of ['audio-long.webm', 'audio-stereo.mov']) {
    const bytes = readFileSync(path.join('e2e/fixtures', file))
    manifest.fixtures.push({ file, bytes: bytes.length, sha256: sha256(bytes), synthetic: true })
  }
  manifest.prepared = true
} catch (error) {
  manifest.prepared = false
  manifest.error = String(error)
  process.exitCode = 1
} finally {
  writeFileSync(
    'test-results/audio-diagnostic-manifest.json',
    JSON.stringify(manifest, null, 2) + '\n',
  )
  console.log(JSON.stringify(manifest, null, 2))
}
