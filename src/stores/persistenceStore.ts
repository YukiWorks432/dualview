/**
 * Persistence Store (PERSIST-001, PERSIST-002, PERSIST-003, PERSIST-004, PROJECT-001)
 *
 * Manages project persistence to IndexedDB with:
 * - Auto-save with debouncing
 * - Project load/restore
 * - Project export/import as .dualview files
 * - Project metadata (title, description, tags)
 */

import { v4 as uuidv4 } from 'uuid'
import { create } from 'zustand'

import {
  initDB,
  saveProjectWithMedia,
  getProject,
  getAllProjects,
  deleteProject as deleteProjectFromDB,
  getProjectMediaBlobs,
  estimateStorageUsage,
  isIndexedDBAvailable,
  type ProjectRecord,
  type MediaManifestEntry,
} from '../lib/indexedDB'
import { LatestRequestGate } from '../lib/media/requestGate'
import {
  disposeProjectMedia,
  prepareProject,
  type PreparedProject,
} from '../lib/projectPreparation'
import { projectSession } from '../lib/projectSession'
import type { TimelineTrack } from '../types'
import { useHistoryStore } from './historyStore'
import { useKeyframeStore } from './keyframeStore'
import { useMediaStore } from './mediaStore'
import { usePlaybackStore } from './playbackStore'
import { useProjectStore } from './projectStore'
import { useTimelineStore } from './timelineStore'

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

export interface ProjectMetadata {
  id: string
  name: string
  description: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
  thumbnail: string | null
}

interface PersistenceStore {
  // State
  currentProjectId: string | null
  projectMetadata: ProjectMetadata | null
  saveStatus: SaveStatus
  lastSavedAt: Date | null
  isLoading: boolean
  error: string | null
  projects: ProjectMetadata[] // List of all saved projects
  storageUsage: { used: number; quota: number; percentUsed: number }
  isIndexedDBSupported: boolean

  // Auto-save timer
  _autoSaveTimeoutId: ReturnType<typeof setTimeout> | null
  _autoSaveDelay: number // ms
  _changeRevision: number

  // Actions
  init: () => Promise<void>
  createNewProject: (name?: string) => Promise<string | null>
  saveCurrentProject: () => Promise<boolean>
  loadProject: (projectId: string) => Promise<boolean>
  deleteProject: (projectId: string) => Promise<void>
  duplicateProject: (projectId: string) => Promise<string>
  updateProjectMetadata: (
    updates: Partial<Pick<ProjectMetadata, 'name' | 'description' | 'tags'>>,
  ) => void
  refreshProjectList: () => Promise<void>
  updateStorageUsage: () => Promise<void>

  // Export/Import
  exportProject: (projectId?: string) => Promise<Blob>
  importProject: (file: File) => Promise<string>

  // PROJECT-002: Templates
  applyTemplate: (templateConfig: {
    aspectRatioSettings: import('../types').AspectRatioSettings
    trackCount: number
    trackNames: string[]
    trackTypes: ('a' | 'b' | 'c' | 'd')[]
    comparisonMode: import('../types').ComparisonMode
    blendMode: import('../types').BlendMode
    sliderOrientation: 'vertical' | 'horizontal'
    sliderPosition: number
  }) => Promise<void>

  // Auto-save
  triggerAutoSave: () => void
  cancelAutoSave: () => void

  // Internal
  _markUnsaved: () => void
  _captureProjectThumbnail: () => Promise<string | null>
}

// Serialize timeline state for storage
function serializeTimelineState(state = useTimelineStore.getState()): string {
  return JSON.stringify({
    tracks: state.tracks,
    currentTime: state.currentTime,
    duration: state.duration,
    zoom: state.zoom,
    playbackSpeed: state.playbackSpeed,
    loopRegion: state.loopRegion,
    frameRate: state.frameRate,
    markers: state.markers,
    snapEnabled: state.snapEnabled,
    snapThreshold: state.snapThreshold,
    rippleEnabled: state.rippleEnabled,
  })
}

// Serialize project settings for storage
function serializeProjectSettings(): string {
  const state = useProjectStore.getState()
  return JSON.stringify({
    comparisonMode: state.comparisonMode,
    blendMode: state.blendMode,
    splitLayout: state.splitLayout,
    sliderPosition: state.sliderPosition,
    sliderOrientation: state.sliderOrientation,
    hideSlider: state.hideSlider,
    aspectRatioSettings: state.aspectRatioSettings,
    webglComparisonSettings: state.webglComparisonSettings,
    scopesSettings: state.scopesSettings,
    quadViewSettings: state.quadViewSettings,
    radialLoupeSettings: state.radialLoupeSettings,
    gridTileSettings: state.gridTileSettings,
    pixelGridSettings: state.pixelGridSettings,
    morphologicalSettings: state.morphologicalSettings,
    exportSettings: state.exportSettings,
  })
}

// KEYFRAME-001: Serialize keyframe data for storage
// Map doesn't serialize to JSON, so we convert to array of tuples
function serializeKeyframeData(): string {
  const state = useKeyframeStore.getState()
  const entries = Array.from(state.clipKeyframes.entries())
  return JSON.stringify(entries)
}

// Get media manifest (metadata without blobs)
function getMediaManifest(files = useMediaStore.getState().files): MediaManifestEntry[] {
  return files.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    duration: f.duration,
    width: f.width,
    height: f.height,
    waveformPeaks: f.waveformPeaks,
    // MEDIA-012: Include status (stored files should always be 'ready')
    status: f.status || 'ready',
  }))
}

let persistenceWriteQueue = Promise.resolve()
const deletingProjectIds = new Set<string>()
const projectWriteEpochs = new Map<string, number>()
let saveSequence = 0
const lastPersistedSequences = new Map<string, number>()

function getProjectWriteEpoch(projectId: string): number {
  return projectWriteEpochs.get(projectId) ?? 0
}

function invalidateProjectWrites(projectId: string): void {
  projectWriteEpochs.set(projectId, getProjectWriteEpoch(projectId) + 1)
}

function enqueuePersistenceWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = persistenceWriteQueue.then(operation, operation)
  persistenceWriteQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

const switchRequests = new LatestRequestGate()
let activeSwitch: { sourceId: string | null; targetId: string } | null = null
let isApplyingProject = false

// Include all stored edits even when their automatic-save subscriptions are incomplete.
// Playback time keeps advancing while preparation runs and is not an editing revision.
function editingFingerprint(): string {
  const metadata = usePersistenceStore.getState().projectMetadata
  const timeline = JSON.parse(serializeTimelineState())
  delete timeline.currentTime
  return JSON.stringify([
    metadata?.id,
    metadata?.name,
    metadata?.description,
    metadata?.tags,
    timeline,
    serializeProjectSettings(),
    serializeKeyframeData(),
    getMediaManifest(),
  ])
}

function resetProjectSession(prepared?: PreparedProject): void {
  const oldFiles = useMediaStore.getState().files
  isApplyingProject = true
  try {
    usePlaybackStore.getState().pause()
    projectSession.advance()
    useHistoryStore.getState().clear()
    useMediaStore.setState({ files: prepared?.files ?? [], selectedIds: [] })
    useTimelineStore.setState(
      prepared?.timeline ?? {
        ...JSON.parse(serializeTimelineState(useTimelineStore.getInitialState())),
        isPlaying: false,
        shuttleSpeed: 0,
        selectedClipId: null,
        selectedClipIds: [],
        clipboardClipId: null,
      },
    )
    useKeyframeStore.setState({
      clipKeyframes: prepared?.keyframes ?? new Map(),
      selectedKeyframeId: null,
      clipboardKeyframes: null,
    })
    if (prepared) useProjectStore.setState(prepared.settings)
    usePlaybackStore.getState().setSpeed(prepared?.timeline.playbackSpeed ?? 1)
    usePlaybackStore.getState().seek(prepared?.timeline.currentTime ?? 0)
    disposeProjectMedia(oldFiles)
  } finally {
    isApplyingProject = false
  }
}

async function switchProject(
  targetId: string,
  prepare: (isCurrent: () => boolean) => Promise<PreparedProject | null>,
  persistNew = false,
): Promise<boolean> {
  const request = switchRequests.begin()
  const sourceId = usePersistenceStore.getState().currentProjectId
  const targetEpoch = getProjectWriteEpoch(targetId)
  const isCurrent = () =>
    switchRequests.isCurrent(request) &&
    !deletingProjectIds.has(targetId) &&
    getProjectWriteEpoch(targetId) === targetEpoch
  activeSwitch = { sourceId, targetId }
  usePersistenceStore.setState({ isLoading: true, error: null })
  let prepared: PreparedProject | null = null
  try {
    const flushOutgoing = async (): Promise<string> => {
      let fingerprint = editingFingerprint()
      while (sourceId && isCurrent()) {
        if (!(await usePersistenceStore.getState().saveCurrentProject())) {
          throw new Error(usePersistenceStore.getState().error || 'Failed to save project')
        }
        if (!isCurrent()) break
        const latest = editingFingerprint()
        if (latest === fingerprint) break
        fingerprint = latest
      }
      return fingerprint
    }
    let savedFingerprint = await flushOutgoing()
    if (!isCurrent()) return false
    prepared = await prepare(isCurrent)
    if (!prepared || !isCurrent()) return false

    if (persistNew && isIndexedDBAvailable()) {
      await enqueuePersistenceWrite(async () => {
        if (isCurrent()) await saveProjectWithMedia(prepared!.record, new Map())
      })
      if (!isCurrent()) return false
    }
    // Editing remains enabled while decoding/saving. Flush again before the synchronous commit.
    while (editingFingerprint() !== savedFingerprint) {
      savedFingerprint = await flushOutgoing()
      if (!isCurrent()) return false
      if (sourceId === targetId) {
        disposeProjectMedia(prepared.files)
        prepared = null
        prepared = await prepare(isCurrent)
        if (!prepared || !isCurrent()) return false
      }
    }
    if (!isCurrent()) return false
    usePersistenceStore.getState().cancelAutoSave()
    resetProjectSession(prepared)
    const record = prepared.record
    prepared = null // Ownership of these resources now belongs to the live media store.
    usePersistenceStore.setState({
      currentProjectId: targetId,
      projectMetadata: {
        id: record.id,
        name: record.name,
        description: record.description,
        tags: record.tags,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
        thumbnail: record.thumbnail,
      },
      saveStatus: isIndexedDBAvailable() ? 'saved' : 'error',
      lastSavedAt: isIndexedDBAvailable() ? new Date(record.updatedAt) : null,
      error: isIndexedDBAvailable() ? null : 'IndexedDB not available',
      _changeRevision: 0,
    })
    if (persistNew) {
      await usePersistenceStore.getState().refreshProjectList()
      await usePersistenceStore.getState().updateStorageUsage()
    }
    return switchRequests.isCurrent(request)
  } catch (error) {
    if (isCurrent()) {
      usePersistenceStore.setState({
        error: error instanceof Error ? error.message : 'Failed to switch project',
      })
    }
    return false
  } finally {
    if (prepared) disposeProjectMedia(prepared.files)
    if (switchRequests.isCurrent(request)) {
      activeSwitch = null
      usePersistenceStore.setState({ isLoading: false })
    }
  }
}

export const usePersistenceStore = create<PersistenceStore>((set, get) => ({
  currentProjectId: null,
  projectMetadata: null,
  saveStatus: 'saved',
  lastSavedAt: null,
  isLoading: false,
  error: null,
  projects: [],
  storageUsage: { used: 0, quota: 0, percentUsed: 0 },
  isIndexedDBSupported: isIndexedDBAvailable(),
  _autoSaveTimeoutId: null,
  _autoSaveDelay: 500, // 500ms debounce
  _changeRevision: 0,

  init: async () => {
    if (!isIndexedDBAvailable()) {
      console.warn('IndexedDB is not available. Projects will not be persisted.')
      return
    }

    try {
      await initDB()
      await get().refreshProjectList()
      await get().updateStorageUsage()
    } catch (error) {
      console.error('Failed to initialize persistence:', error)
      set({ error: 'Failed to initialize project storage' })
    }
  },

  createNewProject: async (name?: string) => {
    const projectId = uuidv4()
    const now = Date.now()
    const record: ProjectRecord = {
      id: projectId,
      name: name || `Project ${new Date(now).toLocaleDateString()}`,
      description: '',
      tags: [],
      createdAt: now,
      updatedAt: now,
      thumbnail: null,
      timelineState: serializeTimelineState(useTimelineStore.getInitialState()),
      projectSettings: serializeProjectSettings(),
      mediaManifest: [],
      keyframeData: '[]',
    }
    const adopted = await switchProject(
      projectId,
      async (isCurrent) => {
        return prepareProject(record, new Map(), isCurrent)
      },
      true,
    )
    return adopted ? projectId : null
  },

  saveCurrentProject: async () => {
    const state = get()
    if (!state.currentProjectId || !state.projectMetadata) {
      console.warn('No active project to save')
      return false
    }

    if (!isIndexedDBAvailable()) {
      set({ saveStatus: 'error', error: 'IndexedDB not available' })
      return false
    }

    const projectId = state.currentProjectId
    if (deletingProjectIds.has(projectId)) return false

    state.cancelAutoSave()

    const projectWriteEpoch = getProjectWriteEpoch(projectId)
    const sequence = ++saveSequence
    const session = projectSession.capture()
    const changeRevision = state._changeRevision
    const metadata = { ...state.projectMetadata }
    const timelineState = serializeTimelineState()
    const projectSettings = serializeProjectSettings()
    const keyframeData = serializeKeyframeData()
    const mediaFiles = [...useMediaStore.getState().files]
    const mediaManifest = getMediaManifest(mediaFiles)
    const mediaBlobs = new Map<string, Blob>()

    for (const file of mediaFiles) {
      if (file.file) {
        mediaBlobs.set(file.id, file.file)
      }
    }

    set({ saveStatus: 'saving', error: null })

    try {
      const thumbnail = await state._captureProjectThumbnail()
      const projectRecord: ProjectRecord = {
        id: projectId,
        name: metadata.name,
        description: metadata.description,
        tags: metadata.tags,
        createdAt: metadata.createdAt.getTime(),
        updatedAt: Date.now(),
        thumbnail,
        timelineState,
        projectSettings,
        mediaManifest,
        keyframeData,
      }
      const result = await enqueuePersistenceWrite(async () => {
        if (
          deletingProjectIds.has(projectId) ||
          getProjectWriteEpoch(projectId) !== projectWriteEpoch
        )
          return 'invalidated'
        // A delayed thumbnail must not let an old snapshot overwrite a newer committed save.
        if ((lastPersistedSequences.get(projectId) ?? 0) > sequence) return 'superseded'
        await saveProjectWithMedia(projectRecord, mediaBlobs)
        lastPersistedSequences.set(projectId, sequence)
        return 'saved'
      })
      if (result === 'invalidated') return false
      if (result === 'superseded') return true

      const currentState = get()
      if (
        currentState.currentProjectId !== projectId ||
        deletingProjectIds.has(projectId) ||
        !projectSession.isCurrent(session)
      )
        return true

      const savedAt = new Date(projectRecord.updatedAt)
      const hasNewerChanges = currentState._changeRevision !== changeRevision
      set({
        saveStatus: hasNewerChanges ? 'unsaved' : 'saved',
        lastSavedAt: savedAt,
        projectMetadata: currentState.projectMetadata
          ? {
              ...currentState.projectMetadata,
              updatedAt: savedAt,
              thumbnail,
            }
          : null,
      })

      await get().refreshProjectList()
      await get().updateStorageUsage()
      return true
    } catch (error) {
      console.error('Failed to save project:', error)
      if (
        get().currentProjectId === projectId &&
        !deletingProjectIds.has(projectId) &&
        projectSession.isCurrent(session) &&
        (lastPersistedSequences.get(projectId) ?? 0) <= sequence
      ) {
        set({ saveStatus: 'error', error: 'Failed to save project' })
      }
      return false
    }
  },

  loadProject: async (projectId: string) => {
    if (!isIndexedDBAvailable()) {
      set({ error: 'IndexedDB not available' })
      return false
    }
    return switchProject(projectId, async (isCurrent) => {
      const record = await getProject(projectId)
      if (!isCurrent()) return null
      if (!record) throw new Error('Project not found')
      const blobs = await getProjectMediaBlobs(projectId)
      if (!isCurrent()) return null
      return prepareProject(record, blobs, isCurrent)
    })
  },

  deleteProject: async (projectId: string) => {
    if (!isIndexedDBAvailable()) {
      set({ error: 'IndexedDB not available' })
      return
    }

    if (get().currentProjectId === projectId) {
      get().cancelAutoSave()
    }

    if (activeSwitch?.sourceId === projectId || activeSwitch?.targetId === projectId) {
      switchRequests.invalidate()
      activeSwitch = null
      set({ isLoading: false })
    }
    deletingProjectIds.add(projectId)
    invalidateProjectWrites(projectId)

    try {
      await enqueuePersistenceWrite(() => deleteProjectFromDB(projectId))

      // If deleting current project, clear state only after the queued delete has committed.
      if (get().currentProjectId === projectId) {
        set({
          currentProjectId: null,
          projectMetadata: null,
          saveStatus: 'saved',
          lastSavedAt: null,
          error: null,
        })
        resetProjectSession()
      }

      await get().refreshProjectList()
      await get().updateStorageUsage()
    } catch (error) {
      console.error('Failed to delete project:', error)
      set({
        error: 'Failed to delete project',
        ...(get().currentProjectId === projectId ? { saveStatus: 'unsaved' as const } : {}),
      })
    } finally {
      deletingProjectIds.delete(projectId)
    }
  },

  duplicateProject: async (projectId: string) => {
    if (!isIndexedDBAvailable()) {
      throw new Error('IndexedDB not available')
    }

    // Load the original project
    const original = await getProject(projectId)
    if (!original) {
      throw new Error('Project not found')
    }

    // Create new project with duplicated data
    const newId = uuidv4()
    const now = Date.now()

    const duplicateRecord: ProjectRecord = {
      ...original,
      id: newId,
      name: `${original.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    }

    const mediaBlobs = await getProjectMediaBlobs(projectId)
    await enqueuePersistenceWrite(() => saveProjectWithMedia(duplicateRecord, mediaBlobs))

    await get().refreshProjectList()
    return newId
  },

  updateProjectMetadata: (updates) => {
    const state = get()
    if (!state.projectMetadata) return

    set({
      projectMetadata: {
        ...state.projectMetadata,
        ...updates,
      },
    })

    // Trigger auto-save
    state.triggerAutoSave()
  },

  refreshProjectList: async () => {
    if (!isIndexedDBAvailable()) return

    try {
      const records = await getAllProjects()
      const projects: ProjectMetadata[] = records.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        tags: r.tags,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
        thumbnail: r.thumbnail,
      }))
      set({ projects })
    } catch (error) {
      console.error('Failed to refresh project list:', error)
    }
  },

  updateStorageUsage: async () => {
    const usage = await estimateStorageUsage()
    set({ storageUsage: usage })
  },

  exportProject: async (projectId?: string) => {
    const id = projectId || get().currentProjectId
    if (!id) {
      throw new Error('No project to export')
    }

    const projectRecord = await getProject(id)
    if (!projectRecord) {
      throw new Error('Project not found')
    }

    const mediaBlobs = await getProjectMediaBlobs(id)

    // Build export package
    const exportData = {
      version: 1,
      exportedAt: Date.now(),
      project: projectRecord,
      mediaFiles: [] as Array<{ id: string; name: string; type: string; data: string }>,
    }

    // Convert media blobs to base64
    for (const entry of projectRecord.mediaManifest) {
      const blob = mediaBlobs.get(entry.id)
      if (blob) {
        const base64 = await blobToBase64(blob)
        exportData.mediaFiles.push({
          id: entry.id,
          name: entry.name,
          type: blob.type,
          data: base64,
        })
      }
    }

    // Create JSON blob
    const json = JSON.stringify(exportData)
    return new Blob([json], { type: 'application/json' })
  },

  importProject: async (file: File) => {
    const text = await file.text()
    const exportData = JSON.parse(text)

    if (exportData.version !== 1) {
      throw new Error('Unsupported project file version')
    }

    // Create new project ID
    const newId = uuidv4()
    const now = Date.now()

    const projectRecord: ProjectRecord = {
      ...exportData.project,
      id: newId,
      createdAt: now,
      updatedAt: now,
    }

    const mediaBlobs = new Map<string, Blob>()
    for (const mediaFile of exportData.mediaFiles) {
      mediaBlobs.set(mediaFile.id, base64ToBlob(mediaFile.data, mediaFile.type))
    }
    await enqueuePersistenceWrite(() => saveProjectWithMedia(projectRecord, mediaBlobs))

    await get().refreshProjectList()
    return newId
  },

  // PROJECT-002: Apply template to current project
  applyTemplate: async (templateConfig) => {
    // Apply to project store
    useProjectStore.setState({
      aspectRatioSettings: templateConfig.aspectRatioSettings,
      comparisonMode: templateConfig.comparisonMode,
      blendMode: templateConfig.blendMode,
      sliderOrientation: templateConfig.sliderOrientation,
      sliderPosition: templateConfig.sliderPosition,
    })

    // Update timeline tracks if needed
    const currentTracks = useTimelineStore.getState().tracks
    const newTracks = templateConfig.trackTypes.map((type, index) => {
      const existingTrack = currentTracks[index]
      return {
        id: existingTrack?.id || `track-${type}`,
        name: templateConfig.trackNames[index] || `Track ${type.toUpperCase()}`,
        type,
        acceptedTypes: ['video', 'image'] as TimelineTrack['acceptedTypes'],
        clips: existingTrack?.clips || [],
        muted: existingTrack?.muted || false,
        locked: existingTrack?.locked || false,
      }
    })

    useTimelineStore.setState({ tracks: newTracks as any })

    // Trigger a save after applying template
    get().triggerAutoSave()
  },

  triggerAutoSave: () => {
    const state = get()

    if (state._autoSaveTimeoutId) {
      clearTimeout(state._autoSaveTimeoutId)
    }

    set({
      saveStatus: 'unsaved',
      _changeRevision: state._changeRevision + 1,
    })

    const timeoutId = setTimeout(() => {
      set({ _autoSaveTimeoutId: null })
      void get().saveCurrentProject()
    }, state._autoSaveDelay)

    set({ _autoSaveTimeoutId: timeoutId })
  },

  cancelAutoSave: () => {
    const state = get()
    if (state._autoSaveTimeoutId) {
      clearTimeout(state._autoSaveTimeoutId)
      set({ _autoSaveTimeoutId: null })
    }
  },

  _markUnsaved: () => {
    get().triggerAutoSave()
  },

  _captureProjectThumbnail: async () => {
    // Try to capture a thumbnail from the comparison view
    try {
      const canvas = document.querySelector('.comparison-canvas') as HTMLCanvasElement
      if (canvas) {
        // Create a smaller thumbnail
        const thumbCanvas = document.createElement('canvas')
        thumbCanvas.width = 320
        thumbCanvas.height = 180
        const ctx = thumbCanvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height)
          return thumbCanvas.toDataURL('image/jpeg', 0.7)
        }
      }
    } catch {
      // Fallback: no thumbnail
    }
    return null
  },
}))

// Helper: Convert blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Helper: Convert base64 to blob
function base64ToBlob(base64: string, mimeType: string): Blob {
  // Handle data URLs
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64
  const byteCharacters = atob(base64Data)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
}

// Subscribe to store changes to trigger auto-save
// These subscriptions are set up when the module loads

// Timeline changes
useTimelineStore.subscribe((state, prevState) => {
  const persistence = usePersistenceStore.getState()
  if (!persistence.currentProjectId || isApplyingProject) return

  // Check for meaningful changes
  if (
    state.tracks !== prevState.tracks ||
    state.markers !== prevState.markers ||
    state.duration !== prevState.duration
  ) {
    persistence._markUnsaved()
  }
})

// Project settings changes
useProjectStore.subscribe((state, prevState) => {
  const persistence = usePersistenceStore.getState()
  if (!persistence.currentProjectId || isApplyingProject) return

  // Check for meaningful changes (excluding transient state)
  if (
    state.comparisonMode !== prevState.comparisonMode ||
    state.blendMode !== prevState.blendMode ||
    state.sliderOrientation !== prevState.sliderOrientation ||
    state.aspectRatioSettings !== prevState.aspectRatioSettings ||
    state.exportSettings !== prevState.exportSettings
  ) {
    persistence._markUnsaved()
  }
})

// Media library changes
useMediaStore.subscribe((state, prevState) => {
  const persistence = usePersistenceStore.getState()
  if (!persistence.currentProjectId || isApplyingProject) return

  if (state.files.length !== prevState.files.length) {
    persistence._markUnsaved()
  }
})
