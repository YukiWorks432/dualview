import { throwIfAudioAborted } from './audioTask'

interface AudioJob {
  signal: AbortSignal
  start: () => Promise<void>
  abort: () => void
}

// 取消を要求しただけでは枠を空けない。進行中のdecode/解析のfinallyを待つ。
export class AudioJobQueue {
  private active = false
  private pending: AudioJob[] = []

  run<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      throwIfAudioAborted(signal)
      const job: AudioJob = {
        signal,
        start: async () => {
          try {
            throwIfAudioAborted(signal)
            const result = await work()
            throwIfAudioAborted(signal)
            resolve(result)
          } catch (error) {
            reject(error)
          }
        },
        abort: () => {
          const index = this.pending.indexOf(job)
          if (index < 0) return
          this.pending.splice(index, 1)
          signal.removeEventListener('abort', job.abort)
          reject(
            signal.reason instanceof Error
              ? signal.reason
              : new DOMException('Aborted', 'AbortError'),
          )
        },
      }
      signal.addEventListener('abort', job.abort, { once: true })
      this.pending.push(job)
      this.startNext()
    })
  }

  private startNext(): void {
    if (this.active) return
    const job = this.pending.shift()
    if (!job) return
    this.active = true
    job.signal.removeEventListener('abort', job.abort)
    void job.start().finally(() => {
      this.active = false
      this.startNext()
    })
  }
}

// 画面の退出直後に再度入った場合も、前の所有者の終了を待つ。
export const audioAnalysisQueue = new AudioJobQueue()
