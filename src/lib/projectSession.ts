// A session changes only when a prepared project is adopted or the active project is deleted.
// Async media work can capture it without importing the persistence store.
let version = 0

export const projectSession = {
  capture: () => version,
  isCurrent: (capturedVersion: number) => capturedVersion === version,
  advance: () => {
    version += 1
  },
}
