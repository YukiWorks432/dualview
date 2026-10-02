import { Output } from 'mediabunny'
import { afterEach, expect, it, vi } from 'vitest'

import { createAvcMp4Muxer } from './mp4Muxer'

afterEach(() => vi.restoreAllMocks())

it('keeps ownership of a container finalization already in progress until its failure cleanup completes', async () => {
  let rejectFinalization: (error: Error) => void = () => {}
  const finalization = new Promise<void>((_resolve, reject) => {
    rejectFinalization = reject
  })
  vi.spyOn(Output.prototype, 'finalize').mockImplementation(function (this: Output) {
    this.state = 'finalizing'
    return finalization.finally(() => {
      this.state = 'canceled'
    })
  })
  const muxer = await createAvcMp4Muxer()
  const result = muxer.finalize().catch((error: unknown) => error)
  await vi.waitFor(() => expect(Output.prototype.finalize).toHaveBeenCalledTimes(1))
  let disposed = false
  const disposal = muxer.dispose().then(() => {
    disposed = true
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(disposed).toBe(false)
  rejectFinalization(new Error('container failed'))
  await expect(result).resolves.toMatchObject({ message: 'container failed' })
  await disposal
  expect(disposed).toBe(true)
  await muxer.dispose()
})
