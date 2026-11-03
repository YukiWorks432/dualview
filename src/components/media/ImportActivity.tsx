import { useEffect, useState } from 'react'

import { useMediaStore } from '../../stores/mediaStore'

export function ImportActivity() {
  const files = useMediaStore((state) => state.files)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const active = files.filter((file) => file.status === 'processing' || file.status === 'pending')
  const missing = files.filter((file) => file.needsRelink && file.status !== 'processing')
  useEffect(() => {
    if (!active.length) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active.length])
  if (!active.length && !missing.length && !error) return null
  return (
    <section
      aria-label="素材の読み込み"
      className="fixed bottom-4 right-4 z-50 max-h-80 w-[min(24rem,calc(100vw-2rem))] overflow-auto rounded-lg border border-border bg-background p-3 shadow-lg text-sm"
    >
      {active.length > 0 && (
        <button
          className="surface-control ui-radius-md border px-2 py-1 my-1"
          onClick={() => useMediaStore.getState().cancelImports()}
        >
          すべて中止
        </button>
      )}
      {active.map((file) => (
        <div key={file.id} className="my-2">
          <p className="truncate">{file.name}</p>
          <p role="status">{file.statusMessage || '最初のフレームを準備しています'}</p>
          <p className="text-xs text-muted-foreground">
            {(file.file.size / 1_000_000_000).toFixed(2)} GB ・{' '}
            {Math.max(0, Math.floor((now - (file.importStartedAt ?? now)) / 1000))}秒
          </p>
          <progress aria-label={`${file.name}の読み込み`} className="w-full" />
          <button
            className="surface-control ui-radius-md border px-2 py-1 my-1"
            onClick={() => useMediaStore.getState().cancelImport(file.id)}
          >
            中止
          </button>
        </div>
      ))}
      {missing.map((file) => (
        <label key={file.id} className="block my-2">
          <span>{file.name}：素材を再指定</span>
          <input
            type="file"
            aria-label={`${file.name}を再指定`}
            onChange={async (event) => {
              const source = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (!source) return
              setError('')
              try {
                await useMediaStore.getState().reconnectFile(file.id, source)
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : '素材を読み込めませんでした')
              }
            }}
          />
        </label>
      ))}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
