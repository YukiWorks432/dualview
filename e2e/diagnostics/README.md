# PR60 audio responsiveness diagnostic

This opt-in diagnostic does not change production source. Following the approved
test correction in #71, `audio-budget.e2e.ts` checks cancellation before settlement,
rejection with `AbortError`, and no successful result. It records timer delay,
abort-to-settlement response, and total elapsed time even on success. The former
assistant-added 100 ms assertion is now diagnostic only. Ordinary CI passing does
not establish the overall responsiveness or performance acceptance items in #51.
Those require an agreed environment, load, measurement window, and criterion. This
diagnostic retains its broader observations without adding a latency threshold.

## Run

Use the repository's pinned Node 24.21.0 / pnpm 12.5.1 environment and locked
Playwright 1.63 dependencies. CI installs its matching Chromium build; each result
records the actual browser version and the artifact includes `browsers.json`.

```sh
git fetch --no-tags --depth=1 origin daf3ac0111486b1233d21bac0c53144375779acb
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
node e2e/diagnostics/prepare.mjs
pnpm exec tsc -p tsconfig.audio-diagnostic.json
pnpm exec playwright test --config playwright.audio-diagnostic.config.ts
```

The preparation step verifies baseline and current audio Git blob hashes, writes
unaltered baseline modules to ignored `.generated/`, and records SHA-256 digests
of the actual synthetic fixtures. A future audio source change requires an
intentional update of the expected source identity. Do not silently skip a mismatch.

## Prespecified observations

One worker, zero retries, no early stop after failures, three ordered pairs:

1. Baseline algorithm, baseline full-media window
2. Current algorithm, current full-media window
3. Repeat this baseline/current ordering for pairs 2 and 3
4. Two current-UI scenarios

Each test gets a fresh browser context/page. The browser process and current
locked dependencies are shared; this is an exact algorithm/extraction source
comparison, not a historical whole-app or historical dependency comparison.
A failure may cause Playwright to replace its worker/browser; the report retains
that failure rather than rerunning it until it passes.

- Algorithm: a real 120-second, 48 kHz stereo `AudioBuffer`, constant +0.25/-0.25,
  allocated and filled before t0. Record t0, requested t0+10 ms abort, actual timer
  callback, and actual fulfillment/rejection. The baseline's delayed callback is
  retained even when analysis fulfills first. Callback-to-settlement can therefore
  be negative. This is independent of media extraction or UI input dispatch.
- Full media: t0 precedes fetch/blob/File materialization, then metadata/decode/copy,
  extraction settlement and analysis settlement. The 10 ms heartbeat runs over the
  entire window. Max/first/final callback gaps include both window edges, even when
  no heartbeat runs. Record Long Task and Event Timing entries where supported.
- Real UI exit: upload A/B, enter Audio QA with Playwright, then dispatch an actual
  pointer click on Slider as soon as the driver is notified of the first long PCM
  allocation. No workload gate or awaited diagnostic hook holds production work.
  DOM pointer/click arrival, project-store mode change, controller abort,
  `Input.dispose`, post-abort sample close if observed, work settlement and queue
  release are separate observations. Driver-side click request/return use a
  separate clock and must never be subtracted from browser timestamps. If A is no
  longer active/B no longer pending at actual click arrival, the scenario fails
  explicitly; a missed overlap is not cancellation evidence.
- Synthetic same-ID replacement: a zero-delay timer replaces the store's File
  objects after the first long allocation, using the same IDs. This is explicitly
  a synthetic store mutation, not a user file-picker event. Assert active A/pending
  B overlap, no old B extraction, only one long allocation, replacement sample
  peaks, replacement-owned playback buffers, mode-exit buffer release and no later
  playback restart. Display is checked after all jobs settle and again after the
  original 200 ms regression observation interval; this is not proof against every
  possible transient rendered frame.

The media fixture is the repository's `audio-long.webm` (120-second, 997 Hz,
anti-phase Opus). It is **not** the historical PCM/ProRes fixture with SHA-256
`56cf200e0354f9bcb5f9a5776731448f27a25e16732f0b4838eebbb030e121e3`.
Results from this run cannot establish that old ProRes full-window criterion.
Replacement is the synthetic four-second `audio-stereo.mov` fixture.

## Interpret the artifacts

`test-results/` contains the run log, manifest, Playwright JSON report, every test's
JSON attachments and full Playwright traces, including failed and timed-out tests.
GitHub uploads artifacts with `if: always()`. If installation/preparation fails,
there may be no browser traces; the failed step is not a completed observation.
A final snapshot that cannot be read within two seconds is labeled unavailable,
and the test error/trace is retained. No missing stage is reported as 0 ms.

The Vite configuration wraps only exported analysis/extraction calls and returns
their original promises. Queue and browser API observers preserve original return
values and do not await diagnostic hooks. Instrumentation still has overhead:
metadata/analysis edges are logged; copy/close/IndexedDB calls use aggregate counters
rather than an event per sample. Queue `active` writes are directly observed using
a test-only property accessor on the current implementation. The old baseline has
no queue, so UI queue comparisons are not fabricated.

An `Input.dispose` return is not proof that work settled; inspect the separate
work rejection and queue release. A sample-close event only exists if a sample
was actually held when cancellation arrived. Decoder-internal asynchronous time,
React private ref release, OS memory reclamation and precise browser input-request
arrival are not directly observed. Overlapping marks/Long Tasks are timing
associations, not proof of which subsystem caused a delay. Playwright traces are
interaction traces, not a CPU profile. Nodes are intentionally retained to check
`node.buffer === null`; this is not a GC or resident-memory benchmark.

Only repository synthetic fixtures and their metadata are used. No existing user
profile, authenticated context, user media, credentials or third-party data is
loaded. The workflow has read-only repository permissions and does not publish
results elsewhere.
