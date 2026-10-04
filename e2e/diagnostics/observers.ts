import { AudioSample, Input, InputAudioTrack } from 'mediabunny'

type Detail = Record<string, unknown>
type Entry = Detail & { kind: string; at: number }
type Counts = { calls: number; totalMs: number; firstAt: number; lastAt: number }
type QueueView = { active: boolean; pending: number }

type Diagnostic = {
  events: Entry[]
  counts: Record<string, Counts>
  active: Map<number, Detail>
  sources: AudioBufferSourceNode[]
  ids: WeakMap<object, number>
  owners: WeakMap<AudioBuffer, number>
  serial: number
  abortedSignals: Set<number>
  queue: QueueView | null
  onLargeBuffer?: () => void
  stopHeartbeat?: () => void
}

declare global {
  interface Window {
    __audioDiagnostic?: Diagnostic
    __largeBufferReady?: () => Promise<void>
  }
}

function state() {
  return window.__audioDiagnostic
}

export function objectId(value?: object | null): number | null {
  const d = state()
  if (!d || !value) return null
  let id = d.ids.get(value)
  if (id === undefined) {
    id = ++d.serial
    d.ids.set(value, id)
  }
  return id
}

export function mark(kind: string, detail: Detail = {}) {
  const d = state()
  if (!d) return
  const at = performance.now()
  d.events.push({ kind, at, ...detail })
  performance.mark(`audio-diagnostic:${kind}`, { detail })
}

function aggregate(name: string, start: number) {
  const d = state()!
  const end = performance.now()
  const counter = (d.counts[name] ??= { calls: 0, totalMs: 0, firstAt: start, lastAt: end })
  counter.calls++
  counter.totalMs += end - start
  counter.lastAt = end
}

// Attach observers, then return the exact original promise, without an awaited hook.
export function observeCall<T>(
  name: string,
  args: unknown[],
  invoke: () => Promise<T>,
): Promise<T> {
  const d = state()
  if (!d) return invoke()
  const call = ++d.serial
  const source = args[0]
  const detail = {
    call,
    sourceId: typeof source === 'object' && source !== null ? objectId(source) : null,
    signalId: args[1] instanceof AbortSignal ? objectId(args[1]) : null,
  }
  d.active.set(call, { name, ...detail })
  mark(`${name}:start`, detail)
  let result: Promise<T>
  try {
    result = invoke()
  } catch (error) {
    d.active.delete(call)
    mark(`${name}:throw`, { ...detail, errorName: error instanceof Error ? error.name : 'unknown' })
    throw error
  }
  void result.then(
    (value) => {
      d.active.delete(call)
      if (
        name === 'extractPrimaryAudioBuffer' &&
        value instanceof AudioBuffer &&
        source instanceof File
      ) {
        d.owners.set(value, objectId(source)!)
      }
      mark(`${name}:fulfilled`, {
        ...detail,
        resultId: value instanceof AudioBuffer ? objectId(value) : null,
      })
    },
    (error: unknown) => {
      d.active.delete(call)
      mark(`${name}:rejected`, {
        ...detail,
        errorName: error instanceof Error ? error.name : 'unknown',
      })
    },
  )
  return result
}

export function installObservers() {
  if (state()) throw new Error('Install diagnostic observers only once per fresh page')
  const d: Diagnostic = {
    events: [],
    counts: {},
    active: new Map(),
    sources: [],
    ids: new WeakMap(),
    owners: new WeakMap(),
    serial: 0,
    queue: null,
    abortedSignals: new Set(),
  }
  window.__audioDiagnostic = d
  mark('observers:installed', {
    visibility: document.visibilityState,
    focused: document.hasFocus(),
    userAgent: navigator.userAgent,
  })

  const abort = AbortController.prototype.abort
  AbortController.prototype.abort = function (reason?: unknown) {
    const signalId = objectId(this.signal)
    if (signalId !== null) d.abortedSignals.add(signalId)
    mark('controller:abort-call', { signalId, sampleCloses: d.counts['sample.close']?.calls ?? 0 })
    try {
      return abort.call(this, reason)
    } finally {
      mark('controller:abort-return', { signalId })
    }
  }
  const dispose = Input.prototype.dispose
  Input.prototype.dispose = function () {
    mark('input:dispose-call', { inputId: objectId(this), active: [...d.active.values()] })
    try {
      return dispose.call(this)
    } finally {
      mark('input:dispose-return', { inputId: objectId(this) })
    }
  }
  const canRead = Input.prototype.canRead
  Input.prototype.canRead = function (...args) {
    return observeCall('input:canRead', [this], () => canRead.apply(this, args))
  }
  const primary = Input.prototype.getPrimaryAudioTrack
  Input.prototype.getPrimaryAudioTrack = function (...args) {
    return observeCall('input:getPrimaryAudioTrack', [this], () => primary.apply(this, args))
  }
  const duration = InputAudioTrack.prototype.computeDuration
  InputAudioTrack.prototype.computeDuration = function (...args) {
    return observeCall('track:computeDuration', [this], () => duration.apply(this, args))
  }
  const copy = AudioSample.prototype.copyTo
  AudioSample.prototype.copyTo = function (...args) {
    const start = performance.now()
    try {
      return copy.apply(this, args)
    } finally {
      aggregate('sample.copyTo', start)
    }
  }
  const close = AudioSample.prototype.close
  AudioSample.prototype.close = function () {
    const start = performance.now()
    try {
      return close.call(this)
    } finally {
      aggregate('sample.close', start)
      if ([...d.active.values()].some((call) => d.abortedSignals.has(call.signalId as number))) {
        mark('sample:close-after-abort', { startedAt: start })
      }
    }
  }
  const OriginalAudioBuffer = window.AudioBuffer
  window.AudioBuffer = new Proxy(OriginalAudioBuffer, {
    construct(target, args) {
      const start = performance.now()
      const result = Reflect.construct(target, args) as AudioBuffer
      if (result.duration > 100) {
        mark('buffer:large-allocated', {
          startedAt: start,
          bufferId: objectId(result),
          duration: result.duration,
          channels: result.numberOfChannels,
          sampleRate: result.sampleRate,
        })
        d.onLargeBuffer?.()
      }
      return result
    },
  })
  const channelCopy = AudioBuffer.prototype.copyToChannel
  AudioBuffer.prototype.copyToChannel = function (...args) {
    const start = performance.now()
    try {
      return channelCopy.apply(this, args)
    } finally {
      aggregate('buffer.copyToChannel', start)
    }
  }
  const sourceStart = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration?: number) {
    d.sources.push(this)
    mark('playback:start', {
      sourceId: objectId(this),
      bufferId: objectId(this.buffer),
      ownerFileId: this.buffer ? (d.owners.get(this.buffer) ?? null) : null,
      bufferDuration: this.buffer?.duration,
      offset,
      duration,
    })
    if (duration === undefined) return sourceStart.call(this, when, offset)
    return sourceStart.call(this, when, offset, duration)
  }
  const bufferDescriptor = Object.getOwnPropertyDescriptor(
    AudioBufferSourceNode.prototype,
    'buffer',
  )
  if (bufferDescriptor?.get && bufferDescriptor.set && bufferDescriptor.configurable) {
    Object.defineProperty(AudioBufferSourceNode.prototype, 'buffer', {
      ...bufferDescriptor,
      set(value: AudioBuffer | null) {
        bufferDescriptor.set!.call(this, value)
        if (value === null) mark('playback:buffer-cleared', { sourceId: objectId(this) })
      },
    })
  } else mark('playback:buffer-setter-unobservable')

  const blobRead = Blob.prototype.arrayBuffer
  Blob.prototype.arrayBuffer = function () {
    return observeCall('blob:arrayBuffer', [this], () => blobRead.call(this))
  }
  const put = IDBObjectStore.prototype.put
  IDBObjectStore.prototype.put = function (...args) {
    const start = performance.now()
    const result = put.apply(this, args)
    aggregate('indexedDB.put.sync', start)
    result.addEventListener('success', () => aggregate('indexedDB.put.request', start), {
      once: true,
    })
    return result
  }
  for (const kind of ['pointerdown', 'pointerup', 'click']) {
    document.addEventListener(
      kind,
      (event) => {
        const target = event.target instanceof Element ? event.target.closest('[role="tab"]') : null
        const label = target?.getAttribute('aria-label')
        if (label === 'Slider comparison mode' || label === 'Audio QA comparison mode') {
          mark(`dom:${kind}`, {
            label,
            eventTimeStamp: event.timeStamp,
            trusted: event.isTrusted,
            queue: d.queue ? { ...d.queue } : null,
            active: [...d.active.values()],
          })
        }
      },
      true,
    )
  }
  for (const type of ['longtask', 'event']) {
    if (!PerformanceObserver.supportedEntryTypes.includes(type)) {
      mark('performance:unsupported', { type })
      continue
    }
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const timing = entry as PerformanceEventTiming
        // No DOM text, stacks, URLs, or user data are recorded.
        d.events.push({
          kind: `performance:${type}`,
          at: entry.startTime,
          duration: entry.duration,
          name: entry.name,
          processingStart: timing.processingStart,
          processingEnd: timing.processingEnd,
        })
      }
    })
    observer.observe({
      type,
      buffered: false,
      ...(type === 'event' ? { durationThreshold: 16 } : {}),
    })
  }
}

export function startHeartbeat() {
  const d = state()!
  let stopped = false
  let expected = performance.now() + 10
  let timer: ReturnType<typeof setTimeout>
  const tick = () => {
    if (stopped) return
    const actual = performance.now()
    d.events.push({
      kind: 'timer:heartbeat',
      at: actual,
      scheduledAt: expected,
      latenessMs: actual - expected,
    })
    expected = actual + 10
    timer = setTimeout(tick, 10)
  }
  timer = setTimeout(tick, 10)
  d.stopHeartbeat = () => {
    if (stopped) return
    stopped = true
    clearTimeout(timer)
    mark('timer:stopped')
  }
}

export function observeQueue(queue: {
  active: boolean
  pending: unknown[]
  run: <T>(signal: AbortSignal, work: () => Promise<T>) => Promise<T>
}) {
  const d = state()!
  let active = queue.active
  const update = () => {
    d.queue = { active, pending: queue.pending.length }
  }
  Object.defineProperty(queue, 'active', {
    configurable: true,
    get: () => active,
    set: (value: boolean) => {
      const prior = active
      active = value
      update()
      mark(value ? 'queue:acquire' : 'queue:release', { prior, ...d.queue })
    },
  })
  const run = queue.run
  queue.run = function <T>(signal: AbortSignal, work: () => Promise<T>) {
    const signalId = objectId(signal)
    mark('queue:enqueue', { signalId, active, pendingBefore: queue.pending.length })
    signal.addEventListener(
      'abort',
      () => {
        mark('queue:signal-abort', { signalId, active, pendingBefore: queue.pending.length })
      },
      { once: true },
    )
    const result = run.call(this, signal, () =>
      observeCall('queue:work', [null, signal], work),
    ) as Promise<T>
    update()
    void result.then(
      () => {
        update()
        mark('queue:promise-fulfilled', { signalId, ...d.queue })
      },
      (error: unknown) => {
        update()
        mark('queue:promise-rejected', {
          signalId,
          errorName: error instanceof Error ? error.name : 'unknown',
          ...d.queue,
        })
      },
    )
    return result
  }
  update()
}

export function snapshot() {
  const d = state()!
  return {
    events: d.events,
    counts: d.counts,
    active: [...d.active.values()],
    queue: d.queue,
    sources: d.sources.map((source) => ({
      sourceId: objectId(source),
      released: source.buffer === null,
      bufferDuration: source.buffer?.duration ?? null,
    })),
    visibility: document.visibilityState,
    focused: document.hasFocus(),
  }
}

export function finishObservation() {
  state()?.stopHeartbeat?.()
  mark('diagnostic:observation-end')
  return snapshot()
}
