// 長い音声処理でも、入力イベントと取消が次の処理単位の間に届くようにする。
export function throwIfAudioAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  throw signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError')
}

export function createAudioTaskYield(signal?: AbortSignal): () => Promise<void> | undefined {
  let lastYield = performance.now()
  return () => {
    throwIfAudioAborted(signal)
    if (performance.now() - lastYield < 8) return
    return new Promise<void>((resolve, reject) => {
      // 取消の配送後は、処理再開用タイマーが届くまで待たない。
      const onAbort = () => {
        try {
          throwIfAudioAborted(signal)
        } catch (error) {
          clearTimeout(timer)
          signal?.removeEventListener('abort', onAbort)
          reject(error)
        }
      }
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }, 0)
      signal?.addEventListener('abort', onAbort)
    }).then(() => {
      throwIfAudioAborted(signal)
      lastYield = performance.now()
    })
  }
}
