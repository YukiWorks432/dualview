export async function detachFile(file: File, signal?: AbortSignal): Promise<File> {
  signal?.throwIfAborted()
  const detachedStream = file.stream().pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk.slice())
      },
    }),
    { signal },
  )

  const blob = await new Response(detachedStream).blob()
  return new File([blob], file.name, {
    type: file.type,
    lastModified: file.lastModified,
  })
}
