import { projectSession } from '../projectSession'

let library = new AbortController()

// ファイル切り離し・URL取得より前に捕捉し、同じ操作の全素材へ渡す。
export function captureMediaImport(signal?: AbortSignal): AbortSignal {
  return AbortSignal.any([projectSession.signal(), library.signal, ...(signal ? [signal] : [])])
}

export function invalidateMediaImports(): void {
  library.abort()
  library = new AbortController()
}
