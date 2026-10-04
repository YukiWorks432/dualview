// Missing boundaries stay null. Correlate cancellation to the active analysis signal.
export function summarizeTrial(record) {
  if (!record.valid || record.error || record.pageErrors?.length) return null
  const events = record.observation?.events ?? []
  const find = (kind, predicate = () => true) => events.find((e) => e.kind === kind && predicate(e))
  const entry = find('dom:click', (e) => e.label === 'Audio QA comparison mode')
  const click = find('dom:click', (e) => e.label === 'Slider comparison mode')
  const active = click?.active?.find((e) => e.name === 'analyzeAudio')
  const abort =
    active &&
    find('controller:abort-call', (e) => e.signalId === active.signalId && e.at >= click.at)
  const rejected =
    active &&
    find(
      'analyzeAudio:rejected',
      (e) => e.call === active.call && e.errorName === 'AbortError' && e.at >= click.at,
    )
  const released = click && find('queue:release', (e) => e.at >= click.at)
  const frame = find(record.cancel ? 'ui:slider-frame-2' : 'ui:results-frame-2')
  const start = find('ui:measurement-start')
  const end = find('ui:measurement-end')
  const gap = (a, b) => (a && b && b.at >= a.at ? b.at - a.at : null)
  const beats = events.filter(
    (e) => e.kind === 'timer:heartbeat' && e.at >= start?.at && e.at <= end?.at,
  )
  const times = start && end ? [start.at, ...beats.map((e) => e.at), end.at] : []
  return {
    domToAbortMs: gap(click, abort),
    abortToRejectionMs: gap(abort, rejected),
    domToQueueReleaseMs: gap(click, released),
    domToFrameOpportunityMs: record.cancel ? gap(click, frame) : null,
    audioEntryToResultsOpportunityMs: record.cancel ? null : gap(entry, frame),
    maxHeartbeatGapMs:
      times.length > 1 ? Math.max(...times.slice(1).map((t, i) => t - times[i])) : null,
  }
}

export function summarizeGroups(records) {
  return [1, 4].flatMap((rate) =>
    [true, false].map((cancel) => {
      const rows = records.filter((r) => r.rate === rate && r.cancel === cancel)
      const names = new Set(rows.flatMap((r) => Object.keys(r.metrics ?? {})))
      return {
        rate,
        cancel,
        attempted: rows.length,
        valid: rows.filter((r) => r.metrics).length,
        metrics: Object.fromEntries(
          [...names].map((name) => {
            const values = rows.map((r) => r.metrics?.[name]).filter(Number.isFinite)
            const sorted = [...values].sort((a, b) => a - b)
            const n = values.length
            return [
              name,
              {
                n,
                missing: rows.length - n,
                values,
                min: n ? sorted[0] : null,
                median: n
                  ? (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2
                  : null,
                max: n ? sorted[n - 1] : null,
              },
            ]
          }),
        ),
      }
    }),
  )
}
