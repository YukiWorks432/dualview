import { analyzeDifferences } from '../lib/difference/analyze'
import type { DifferenceRequest, DifferenceWorkerMessage } from '../lib/difference/model'

// Keep the worker's small protocol typed without mixing DOM and WebWorker global declarations.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<{ jobId: number; request: DifferenceRequest }>) => void) | null
  postMessage: (message: DifferenceWorkerMessage) => void
  close: () => void
}
scope.onmessage = (event) => {
  scope.onmessage = null
  const { jobId, request } = event.data
  void (async () => {
    try {
      if (typeof OffscreenCanvas === 'undefined')
        throw new Error('OffscreenCanvas is unavailable in this worker')
      await analyzeDifferences(
        request,
        (batch) => scope.postMessage({ type: 'progress', jobId, batch }),
        (descriptions) => scope.postMessage({ type: 'metadata', jobId, descriptions }),
        new AbortController().signal,
      )
      scope.postMessage({ type: 'complete', jobId })
    } catch (error) {
      scope.postMessage({
        type: 'error',
        jobId,
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      scope.close()
    }
  })()
}
