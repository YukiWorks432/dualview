/// <reference types="node" />

import { getEventListeners } from 'node:events'
import { setImmediate } from 'node:timers'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAudioTaskYield } from './audioTask'

function waitingTask(signal?: AbortSignal) {
  // 十分な処理時間が経過した状況を作る。処理を譲る間隔の数値は検査しない。
  vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(1000)
  const pending = createAudioTaskYield(signal)()
  expect(pending).toBeDefined()
  return pending!
}

afterEach(async () => {
  await vi.runAllTimersAsync()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('音声処理を譲っている間の取消', () => {
  it.each([undefined, new Error('source replaced'), 'cancelled'])(
    '再開タイマーの配送を待たず取消理由 %s で拒否する',
    async (reason) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const controller = new AbortController()
      let outcome: unknown = 'pending'
      const settled = waitingTask(controller.signal).then(
        () => {
          outcome = 'fulfilled'
        },
        (error: unknown) => {
          outcome = error
        },
      )
      controller.abort(reason)
      // タイマーを保留したまま、Promiseのマイクロタスクを実タスク境界まで処理する。
      await new Promise<void>((resolve) => setImmediate(resolve))
      const abortError = expect.objectContaining({ name: 'AbortError' })
      expect(outcome).toEqual(reason instanceof Error ? reason : abortError)
      expect(vi.getTimerCount()).toBe(0)
      expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
      await settled
    },
  )

  it('取消済みならタイマーを作らず拒否する', () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    controller.abort()
    expect(() => createAudioTaskYield(controller.signal)()).toThrowError(
      expect.objectContaining({ name: 'AbortError' }),
    )
    expect(vi.getTimerCount()).toBe(0)
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
  })

  it('正常再開時は取消の購読を残さず、その後の取消で結果を変えない', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const pending = waitingTask(controller.signal)
    await vi.runAllTimersAsync()
    await expect(pending).resolves.toBeUndefined()
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
    controller.abort()
    await expect(pending).resolves.toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('タイマー配送直後でも処理再開前の取消を見落とさない', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const pending = waitingTask(controller.signal)
    // 同期的にタイマーだけを配送し、Promiseの継続処理より前に取り消す。
    vi.runOnlyPendingTimers()
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('取消シグナルなしでも次のタスクで再開する', async () => {
    vi.useFakeTimers()
    const pending = waitingTask()
    await vi.runAllTimersAsync()
    await expect(pending).resolves.toBeUndefined()
  })
})
