const handles = new WeakMap<File, Promise<FileSystemFileHandle | undefined>>()

// ドロップのイベント中に取得を開始し、ブラウザーの読取権限を引き継ぐ。
export function captureDroppedHandles(event: DragEvent): void {
  if (!event.dataTransfer) return
  for (const item of Array.from(event.dataTransfer.items)) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    const entry = item as DataTransferItem & {
      getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>
    }
    if (file && entry.getAsFileSystemHandle) {
      handles.set(
        file,
        entry
          .getAsFileSystemHandle()
          .then((handle) =>
            handle?.kind === 'file' ? (handle as FileSystemFileHandle) : undefined,
          )
          .catch(() => undefined),
      )
    }
  }
}

export async function getDroppedHandle(file: File): Promise<FileSystemFileHandle | undefined> {
  return handles.get(file)
}
