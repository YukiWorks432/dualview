import { describe, expect, it } from 'vitest'

import { AudioJobQueue } from './AudioJobQueue'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('音声処理の待ち列', () => {
  it('Aの取消後も後片付けが終わるまでBを開始しない', async () => {
    const queue = new AudioJobQueue(),
      a = new AbortController(),
      b = new AbortController()
    const cleanup = deferred()
    const events: string[] = []
    const first = queue.run(a.signal, async () => {
      events.push('A start')
      await cleanup.promise
      events.push('A released')
      return 'old result'
    })
    const firstRejected = first.catch((error: unknown) => error)
    const second = queue.run(b.signal, async () => {
      events.push('B start')
      return 'new result'
    })
    a.abort()
    await Promise.resolve()
    expect(events).toEqual(['A start'])
    cleanup.resolve()
    expect(await firstRejected).toMatchObject({ name: 'AbortError' })
    await expect(second).resolves.toBe('new result')
    expect(events).toEqual(['A start', 'A released', 'B start'])
  })

  it('待機中に取り消した要求を開始せず後続の要求を実行する', async () => {
    const queue = new AudioJobQueue(),
      active = deferred(),
      cancelled = new AbortController()
    const first = queue.run(new AbortController().signal, () => active.promise)
    let started = false
    const pending = queue.run(cancelled.signal, async () => {
      started = true
    })
    const rejected = pending.catch((error: unknown) => error)
    cancelled.abort()
    expect(await rejected).toMatchObject({ name: 'AbortError' })
    expect(started).toBe(false)
    const last = queue.run(new AbortController().signal, async () => 'done')
    active.resolve()
    await first
    await expect(last).resolves.toBe('done')
    expect(started).toBe(false)
  })

  it('失敗した処理の後でも次の要求を開始できる', async () => {
    const queue = new AudioJobQueue()
    await expect(
      queue.run(new AbortController().signal, async () => {
        throw new Error('decode failed')
      }),
    ).rejects.toThrow('decode failed')
    await expect(queue.run(new AbortController().signal, async () => 'done')).resolves.toBe('done')
  })
})
