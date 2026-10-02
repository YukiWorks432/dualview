// A session changes only when a prepared project is adopted or the active project is deleted.
// Async media work can capture it without importing the persistence store.
let version = 0
let controller = new AbortController()

export const projectSession = {
  capture: () => version,
  signal: () => controller.signal,
  isCurrent: (capturedVersion: number) => capturedVersion === version,
  advance: () => {
    version += 1
    controller.abort()
    controller = new AbortController()
  },
}
