import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProjectRecord } from '../lib/indexedDB'

const dbMocks = vi.hoisted(() => ({
  initDB: vi.fn<() => Promise<IDBDatabase>>(async () => ({}) as IDBDatabase),
  saveProjectWithMedia: vi.fn<
    (project: ProjectRecord, mediaBlobs: ReadonlyMap<string, Blob>) => Promise<void>
  >(async () => undefined),
  getProject: vi.fn<(id: string) => Promise<ProjectRecord | null>>(async () => null),
  getAllProjects: vi.fn<() => Promise<ProjectRecord[]>>(async () => []),
  deleteProject: vi.fn<(id: string) => Promise<void>>(async () => undefined),
  getProjectMediaBlobs: vi.fn<(projectId: string) => Promise<Map<string, Blob>>>(
    async () => new Map<string, Blob>(),
  ),
  estimateStorageUsage: vi.fn<
    () => Promise<{ used: number; quota: number; percentUsed: number }>
  >(async () => ({ used: 0, quota: 0, percentUsed: 0 })),
}))

vi.mock('../lib/indexedDB', () => ({
  initDB: dbMocks.initDB,
  saveProjectWithMedia: dbMocks.saveProjectWithMedia,
  getProject: dbMocks.getProject,
  getAllProjects: dbMocks.getAllProjects,
  deleteProject: dbMocks.deleteProject,
  getProjectMediaBlobs: dbMocks.getProjectMediaBlobs,
  estimateStorageUsage: dbMocks.estimateStorageUsage,
  isIndexedDBAvailable: () => true,
}))

import { useMediaStore } from './mediaStore'
import { usePersistenceStore } from './persistenceStore'

const metadata = {
  id: 'project-a',
  name: 'Project A',
  description: '',
  tags: [],
  createdAt: new Date('2026-09-29T00:00:00.000Z'),
  updatedAt: new Date('2026-09-29T00:00:00.000Z'),
  thumbnail: null,
}

describe('project persistence ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePersistenceStore.getState().cancelAutoSave()
    useMediaStore.setState({ files: [], selectedIds: [] })
    usePersistenceStore.setState({
      currentProjectId: 'project-a',
      projectMetadata: { ...metadata },
      saveStatus: 'unsaved',
      lastSavedAt: null,
      error: null,
      projects: [],
      storageUsage: { used: 0, quota: 0, percentUsed: 0 },
      _autoSaveTimeoutId: null,
      _autoSaveDelay: 60_000,
      _changeRevision: 0,
      _captureProjectThumbnail: async () => null,
    })
  })

  afterEach(() => {
    usePersistenceStore.getState().cancelAutoSave()
  })

  it('marks a project saved only after the synchronized write commits', async () => {
    let finishWrite: (() => void) | undefined
    dbMocks.saveProjectWithMedia.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          finishWrite = () => resolve(undefined)
        }),
    )

    const savePromise = usePersistenceStore.getState().saveCurrentProject()

    await vi.waitFor(() => expect(dbMocks.saveProjectWithMedia).toHaveBeenCalledTimes(1))
    expect(usePersistenceStore.getState().saveStatus).toBe('saving')

    finishWrite?.()
    await savePromise

    expect(usePersistenceStore.getState().saveStatus).toBe('saved')
  })

  it('does not report an older save as current after a newer change', async () => {
    let finishWrite: (() => void) | undefined
    dbMocks.saveProjectWithMedia.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          finishWrite = () => resolve(undefined)
        }),
    )

    const savePromise = usePersistenceStore.getState().saveCurrentProject()
    await vi.waitFor(() => expect(dbMocks.saveProjectWithMedia).toHaveBeenCalledTimes(1))

    usePersistenceStore.getState().triggerAutoSave()
    expect(usePersistenceStore.getState().saveStatus).toBe('unsaved')

    finishWrite?.()
    await savePromise

    expect(usePersistenceStore.getState().saveStatus).toBe('unsaved')
  })

  it('keeps a failed write out of the saved state', async () => {
    dbMocks.saveProjectWithMedia.mockRejectedValueOnce(new Error('quota exceeded'))

    await usePersistenceStore.getState().saveCurrentProject()

    expect(usePersistenceStore.getState().saveStatus).toBe('error')
    expect(usePersistenceStore.getState().error).toBe('Failed to save project')
  })

  it('invalidates a save that has not entered the write queue before deletion', async () => {
    let finishThumbnail: (() => void) | undefined
    usePersistenceStore.setState({
      _captureProjectThumbnail: () =>
        new Promise<string | null>((resolve) => {
          finishThumbnail = () => resolve(null)
        }),
    })

    const savePromise = usePersistenceStore.getState().saveCurrentProject()
    expect(usePersistenceStore.getState().saveStatus).toBe('saving')

    await usePersistenceStore.getState().deleteProject('project-a')
    expect(dbMocks.deleteProject).toHaveBeenCalledTimes(1)

    finishThumbnail?.()
    await savePromise

    expect(dbMocks.saveProjectWithMedia).not.toHaveBeenCalled()
    expect(usePersistenceStore.getState().currentProjectId).toBeNull()
  })

  it('waits for an in-flight save before deleting the active project', async () => {
    const events: string[] = []
    let finishWrite: (() => void) | undefined

    dbMocks.saveProjectWithMedia.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          events.push('save-start')
          finishWrite = () => {
            events.push('save-finish')
            resolve(undefined)
          }
        }),
    )
    dbMocks.deleteProject.mockImplementationOnce(async () => {
      events.push('delete')
    })

    const savePromise = usePersistenceStore.getState().saveCurrentProject()
    await vi.waitFor(() => expect(events).toEqual(['save-start']))

    const deletePromise = usePersistenceStore.getState().deleteProject('project-a')
    await Promise.resolve()
    expect(dbMocks.deleteProject).not.toHaveBeenCalled()

    finishWrite?.()
    await Promise.all([savePromise, deletePromise])

    expect(events).toEqual(['save-start', 'save-finish', 'delete'])
    expect(usePersistenceStore.getState().currentProjectId).toBeNull()
  })
})
