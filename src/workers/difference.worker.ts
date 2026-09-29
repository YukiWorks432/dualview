import { createDifferenceMask } from '../lib/difference/pixelmatchAdapter'
import { extractDifferenceRegions } from '../lib/difference/regions'
import type {
  DifferenceWorkerRequest,
  DifferenceWorkerResponse,
} from '../lib/difference/workerProtocol'

interface WorkerScope {
  onmessage: ((event: MessageEvent<DifferenceWorkerRequest>) => void) | null
  postMessage: (message: DifferenceWorkerResponse) => void
}

const workerScope = globalThis as unknown as WorkerScope

workerScope.onmessage = (event) => {
  const request = event.data
  if (request.type !== 'analyze') return

  try {
    const a = new Uint8ClampedArray(request.a)
    const b = new Uint8ClampedArray(request.b)
    const { mask, diffPixelCount } = createDifferenceMask(
      a,
      b,
      request.width,
      request.height,
      request.threshold,
    )
    const regions = extractDifferenceRegions(mask, request.width, request.height, {
      minPixels: request.minPixels,
      mergeGap: request.mergeGap,
      padding: request.padding,
      maxRegions: request.maxRegions,
    })

    workerScope.postMessage({
      type: 'result',
      id: request.id,
      diffPixelCount,
      regions,
    })
  } catch (error) {
    workerScope.postMessage({
      type: 'error',
      id: request.id,
      message: error instanceof Error ? error.message : 'Difference analysis failed',
    })
  }
}
