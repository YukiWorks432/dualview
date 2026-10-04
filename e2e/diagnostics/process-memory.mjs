import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const exec = promisify(execFile)

// RSS is KiB in procps. Sum only the dedicated browser and its current descendants.
export function browserProcessSample(table, rootPid) {
  const rows = table
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const values = line.trim().split(/\s+/).map(Number)
      if (values.length !== 3 || values.some((n) => !Number.isSafeInteger(n) || n < 0)) {
        throw new Error('Malformed process-memory row')
      }
      return { pid: values[0], ppid: values[1], rssKiB: values[2] }
    })
  if (!rows.some((row) => row.pid === rootPid)) throw new Error('Browser root process missing')
  const included = new Set([rootPid])
  let changed
  do {
    changed = false
    for (const row of rows) {
      if (!included.has(row.pid) && included.has(row.ppid)) {
        included.add(row.pid)
        changed = true
      }
    }
  } while (changed)
  const processes = rows.filter((row) => included.has(row.pid))
  return { processes, rssBytes: processes.reduce((sum, row) => sum + row.rssKiB * 1024, 0) }
}

export function startMemorySampling(rootPid, phase, intervalMs = 100) {
  const samples = []
  let stopped = false
  let timer
  let running = Promise.resolve()
  const take = async () => {
    const startedAt = performance.now()
    const sample = { startedAt, phase: phase() }
    try {
      const { stdout } = await exec('ps', ['-e', '-o', 'pid=,ppid=,rss='], {
        timeout: 3000,
        maxBuffer: 4 * 1024 * 1024,
      })
      Object.assign(sample, browserProcessSample(stdout, rootPid))
    } catch (error) {
      sample.error = String(error)
      sample.rssBytes = null
    }
    sample.finishedAt = performance.now()
    sample.phaseAtEnd = phase()
    samples.push(sample)
  }
  const tick = () => {
    running = take().finally(() => {
      if (!stopped) timer = setTimeout(tick, intervalMs)
    })
  }
  tick()
  return {
    samples,
    async stop() {
      stopped = true
      clearTimeout(timer)
      await running
      return samples
    },
  }
}

export function summarizeMemory(samples) {
  const phases = ['overall', 'before-audio', 'audio-processing', 'completed', 'exited']
  return Object.fromEntries(
    phases.map((phase) => {
      const rows =
        phase === 'overall'
          ? samples
          : samples.filter((s) => s.phase === phase && s.phaseAtEnd === phase)
      const values = rows.map((s) => s.rssBytes).filter(Number.isFinite)
      return [
        phase,
        {
          samples: rows.length,
          missing: rows.length - values.length,
          observedMaxRssBytes: values.length ? Math.max(...values) : null,
          observedMinRssBytes: values.length ? Math.min(...values) : null,
        },
      ]
    }),
  )
}

export function summarizeMemoryTrials(records) {
  return [1, 4].map((rate) => {
    const attempted = records.filter((r) => r.rate === rate)
    const valid = attempted.filter((r) => r.valid)
    return {
      rate,
      attempted: attempted.length,
      valid: valid.length,
      phases: Object.fromEntries(
        ['overall', 'before-audio', 'audio-processing', 'completed', 'exited'].map((phase) => {
          const values = valid
            .map((r) => r.summary[phase].observedMaxRssBytes)
            .filter(Number.isFinite)
          const sorted = [...values].sort((a, b) => a - b)
          const n = values.length
          return [
            phase,
            {
              n,
              missing: attempted.length - n,
              values,
              min: n ? sorted[0] : null,
              median: n ? (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2 : null,
              max: n ? sorted[n - 1] : null,
            },
          ]
        }),
      ),
    }
  })
}
