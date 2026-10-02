import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProjectRecord } from '../lib/indexedDB'

const db = vi.hoisted(() => ({
  records: new Map<string, ProjectRecord>(),
  blobs: new Map<string, Map<string, Blob>>(),
  save: vi.fn<(record: ProjectRecord, blobs: ReadonlyMap<string, Blob>) => Promise<void>>(),
  read: vi.fn<(id: string) => Promise<ProjectRecord | null>>(),
  remove: vi.fn<(id: string) => Promise<void>>(),
}))
vi.mock('../lib/indexedDB', () => ({
  isIndexedDBAvailable: () => true,
  initDB: async () => ({}),
  saveProjectWithMedia: db.save,
  getProject: db.read,
  getProjectMediaBlobs: async (id: string) => db.blobs.get(id) ?? new Map(),
  getAllProjects: async () => [...db.records.values()],
  deleteProject: db.remove,
  estimateStorageUsage: async () => ({ used: 0, quota: 0, percentUsed: 0 }),
}))

import { useHistoryStore as history } from './historyStore'
import { useKeyframeStore as keyframes } from './keyframeStore'
import { useMediaStore as media } from './mediaStore'
import { usePersistenceStore as persistence } from './persistenceStore'
import { usePlaybackStore as playback } from './playbackStore'
import { useProjectStore as project } from './projectStore'
import { useTimelineStore as timeline } from './timelineStore'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

class TestImage {
  naturalWidth = 16
  naturalHeight = 16
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(url: string) {
    if (!url) return
    const control = imageControls.get(url)
    if (control) control(this)
    else queueMicrotask(() => this.onload?.())
  }
}
const imageControls = new Map<string, (image: TestImage) => void>()
const revoked = vi.fn<(url: string) => void>()
const cancelFrame = vi.fn<(id: number) => void>()

function storedProject(id: string, fileNames = [`${id}.png`]): ProjectRecord {
  const initial = timeline.getInitialState()
  const record: ProjectRecord = {
    id,
    name: id,
    description: '',
    tags: [],
    createdAt: 1,
    updatedAt: 1,
    thumbnail: null,
    mediaManifest: fileNames.map((name, index) => ({
      id: `${id}-media-${index}`,
      name,
      type: 'image',
    })),
    timelineState: JSON.stringify({
      ...initial,
      tracks: initial.tracks.map((track, index) => ({
        ...track,
        clips:
          index === 0 && fileNames.length
            ? [
                {
                  id: `${id}-clip`,
                  mediaId: `${id}-media-0`,
                  trackId: track.id,
                  startTime: 0,
                  endTime: 10,
                  inPoint: 0,
                  outPoint: 10,
                },
              ]
            : [],
      })),
    }),
    projectSettings: JSON.stringify(project.getInitialState()),
    keyframeData: '[]',
  }
  db.records.set(id, record)
  db.blobs.set(
    id,
    new Map(
      record.mediaManifest.map((entry) => [entry.id, new Blob(['image'], { type: 'image/png' })]),
    ),
  )
  return record
}

function clips() {
  return timeline.getState().tracks.flatMap((track) => track.clips)
}

async function openA() {
  storedProject('A')
  expect(await persistence.getState().loadProject('A')).toBe(true)
  db.save.mockClear()
  revoked.mockClear()
}

function editA() {
  history.getState().pushState()
  timeline.getState().updateClip('A-clip', { endTime: 8 })
  timeline.getState().selectClip('A-clip')
  timeline.getState().copyClip('A-clip')
  media.getState().selectFile('A-media-0')
  keyframes.getState().addKeyframeToClip('A-clip', 'opacity', 0, 0.5)
  const firstKeyframe = keyframes.getState().clipKeyframes.get('A-clip')!.tracks[0].keyframes[0]
  keyframes.setState({ selectedKeyframeId: firstKeyframe.id, clipboardKeyframes: [firstKeyframe] })
  persistence.getState().updateProjectMetadata({ name: 'Edited A' })
}

beforeEach(() => {
  vi.resetAllMocks()
  db.records.clear()
  db.blobs.clear()
  imageControls.clear()
  db.save.mockImplementation(async (record, blobs) => {
    db.records.set(record.id, structuredClone(record))
    db.blobs.set(record.id, new Map(blobs))
  })
  db.read.mockImplementation(async (id) => structuredClone(db.records.get(id) ?? null))
  db.remove.mockImplementation(async (id) => {
    db.records.delete(id)
    db.blobs.delete(id)
  })
  vi.stubGlobal('window', { dispatchEvent: vi.fn<(event: unknown) => void>() })
  vi.stubGlobal('requestAnimationFrame', () => 7)
  vi.stubGlobal('cancelAnimationFrame', cancelFrame)
  vi.stubGlobal(
    'CustomEvent',
    class {
      type: string
      detail: unknown
      constructor(type: string, init: { detail: unknown }) {
        this.type = type
        this.detail = init.detail
      }
    },
  )
  vi.stubGlobal('Image', TestImage)
  vi.stubGlobal('document', {
    createElement: () => ({
      getContext: () => ({ drawImage: vi.fn<() => void>() }),
      toDataURL: () => 'thumbnail',
    }),
  })
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => `blob:${(blob as File).name}`)
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revoked)
  persistence.getState().cancelAutoSave()
  persistence.setState({
    ...persistence.getInitialState(),
    _autoSaveDelay: 60_000,
    _captureProjectThumbnail: async () => null,
  })
  playback.setState(playback.getInitialState())
  timeline.setState(timeline.getInitialState())
  media.setState(media.getInitialState())
  project.setState(project.getInitialState())
  keyframes.setState(keyframes.getInitialState())
  history.getState().clear()
})

afterEach(() => {
  persistence.getState().cancelAutoSave()
  playback.getState().pause()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('transactional project switching', () => {
  it('restores saved time and speed without carrying reverse playback into the loaded session', async () => {
    await openA()
    const b = storedProject('B')
    b.timelineState = JSON.stringify({
      ...JSON.parse(b.timelineState),
      currentTime: 4,
      playbackSpeed: 2,
    })
    playback.getState().seek(3)
    timeline.getState().shuttleBackward()
    timeline.getState().shuttleBackward()
    expect(playback.getState().playbackDirection).toBe(-1)
    const revision = playback.getState().seekRevision
    expect(await persistence.getState().loadProject('B')).toBe(true)
    expect(playback.getState()).toMatchObject({
      currentTime: 4,
      playbackSpeed: 2,
      playbackDirection: 1,
      isPlaying: false,
      isShuttling: false,
    })
    expect(playback.getState().seekRevision).toBeGreaterThan(revision)
    expect(timeline.getState()).toMatchObject({ currentTime: 4, playbackSpeed: 2, shuttleSpeed: 0 })
    await persistence.getState().saveCurrentProject()
    const saved = JSON.parse(db.records.get('B')!.timelineState)
    expect(saved.currentTime).toBe(4)
    expect(saved.playbackSpeed).toBe(2)
    expect(saved.playbackDirection).toBeUndefined()
  })

  it.each(['new', 'load'])(
    'saves outgoing edits before %s and isolates all session state',
    async (operation) => {
      await openA()
      storedProject('B')
      editA()
      playback.getState().setSpeed(2)
      playback.getState().seek(3)
      playback.getState().play()
      timeline.setState({ shuttleSpeed: -2 })
      const result =
        operation === 'new'
          ? await persistence.getState().createNewProject('B')
          : await persistence.getState().loadProject('B')
      expect(result).toBeTruthy()
      const savedA = db.records.get('A')!
      expect(savedA.name).toBe('Edited A')
      expect(JSON.parse(savedA.timelineState).tracks[0].clips[0].endTime).toBe(8)
      expect(JSON.parse(savedA.keyframeData!)).toHaveLength(1)
      expect(revoked).toHaveBeenCalledWith('blob:A.png')
      expect(history.getState().canUndo()).toBe(false)
      expect(history.getState().canRedo()).toBe(false)
      const expectedClips = clips()
      history.getState().undo()
      history.getState().redo()
      expect(clips()).toEqual(expectedClips)
      expect(timeline.getState()).toMatchObject({
        selectedClipId: null,
        selectedClipIds: [],
        clipboardClipId: null,
        shuttleSpeed: 0,
        isPlaying: false,
      })
      expect(media.getState().selectedIds).toEqual([])
      expect(keyframes.getState()).toMatchObject({
        selectedKeyframeId: null,
        clipboardKeyframes: null,
      })
      expect(playback.getState()).toMatchObject({
        isPlaying: false,
        currentTime: 0,
        playbackSpeed: 1,
        _animationFrameId: null,
      })
      expect(cancelFrame).toHaveBeenCalledWith(7)
    },
  )

  it.each(['new', 'load'])(
    'retains edits, resources and history after outgoing save failure on %s, then retries',
    async (operation) => {
      await openA()
      storedProject('B')
      editA()
      const oldFiles = media.getState().files
      const oldTracks = timeline.getState().tracks
      db.save.mockRejectedValueOnce(new Error('quota exceeded'))
      const switchNow = () =>
        operation === 'new'
          ? persistence.getState().createNewProject('B')
          : persistence.getState().loadProject('B')
      expect(await switchNow()).toBeFalsy()
      expect(persistence.getState()).toMatchObject({
        currentProjectId: 'A',
        isLoading: false,
        saveStatus: 'error',
      })
      expect(persistence.getState().error).toBeTruthy()
      expect(media.getState().files).toBe(oldFiles)
      expect(timeline.getState().tracks).toBe(oldTracks)
      expect(history.getState().canUndo()).toBe(true)
      expect(revoked).not.toHaveBeenCalled()
      expect(await switchNow()).toBeTruthy()
      expect(db.records.get('A')!.name).toBe('Edited A')
    },
  )

  it('does not replace the active project when saving the initial new project fails', async () => {
    await openA()
    db.save
      .mockImplementationOnce(async (record) => {
        db.records.set(record.id, record)
      })
      .mockRejectedValueOnce(new Error('new project write failed'))
    expect(await persistence.getState().createNewProject('B')).toBeNull()
    expect(persistence.getState()).toMatchObject({
      currentProjectId: 'A',
      error: 'new project write failed',
      isLoading: false,
    })
    expect(media.getState().files[0].id).toBe('A-media-0')
    expect(revoked).not.toHaveBeenCalled()
  })

  it.each(['read', 'parse', 'decode'])(
    'preserves the active project on %s failure and releases only prepared media',
    async (failure) => {
      await openA()
      editA()
      const b = storedProject('B', ['first.png', 'broken.png'])
      if (failure === 'read') db.read.mockRejectedValueOnce(new Error('read failed'))
      if (failure === 'parse') b.timelineState = '{'
      if (failure === 'decode')
        imageControls.set('blob:broken.png', (image) => queueMicrotask(() => image.onerror?.()))
      const oldFiles = media.getState().files
      const oldTracks = timeline.getState().tracks
      expect(await persistence.getState().loadProject('B')).toBe(false)
      expect(persistence.getState()).toMatchObject({ currentProjectId: 'A', isLoading: false })
      expect(persistence.getState().error).toBeTruthy()
      expect(media.getState().files).toBe(oldFiles)
      expect(timeline.getState().tracks).toBe(oldTracks)
      expect(history.getState().canUndo()).toBe(true)
      expect(revoked).not.toHaveBeenCalledWith('blob:A.png')
      expect(revoked.mock.calls.map(([url]) => url).sort()).toEqual(
        failure === 'decode' ? ['blob:broken.png', 'blob:first.png'] : [],
      )
      storedProject('B')
      expect(await persistence.getState().loadProject('B')).toBe(true)
    },
  )

  it.each(['load', 'new'])(
    'disposes a stale decode when a newer %s has already succeeded',
    async (latest) => {
      await openA()
      storedProject('B')
      storedProject('C')
      let pendingImage: TestImage | undefined
      imageControls.set('blob:B.png', (image) => {
        pendingImage = image
      })
      const slow = persistence.getState().loadProject('B')
      await vi.waitFor(() => expect(pendingImage).toBeDefined())
      const newest =
        latest === 'load'
          ? await persistence.getState().loadProject('C')
          : await persistence.getState().createNewProject('C')
      expect(newest).toBeTruthy()
      const newestId = persistence.getState().currentProjectId
      pendingImage!.onload?.()
      expect(await slow).toBe(false)
      expect(persistence.getState()).toMatchObject({
        currentProjectId: newestId,
        isLoading: false,
        error: null,
      })
      expect(revoked).toHaveBeenCalledWith('blob:B.png')
      expect(media.getState().files.some((file) => file.id.startsWith('B-'))).toBe(false)
    },
  )

  it('never adopts an older request when the latest request fails', async () => {
    await openA()
    const pending = deferred<ProjectRecord | null>()
    const b = storedProject('B')
    db.read.mockImplementationOnce(() => pending.promise)
    const slow = persistence.getState().loadProject('B')
    await vi.waitFor(() => expect(db.read).toHaveBeenCalledWith('B'))
    expect(await persistence.getState().loadProject('missing')).toBe(false)
    pending.resolve(b)
    expect(await slow).toBe(false)
    expect(persistence.getState()).toMatchObject({
      currentProjectId: 'A',
      error: 'Project not found',
    })
    expect(media.getState().files[0].id).toBe('A-media-0')
  })

  it('tracks and flushes edits made while the destination is decoding', async () => {
    await openA()
    storedProject('B')
    let pendingImage: TestImage | undefined
    imageControls.set('blob:B.png', (image) => {
      pendingImage = image
    })
    const loading = persistence.getState().loadProject('B')
    await vi.waitFor(() => expect(pendingImage).toBeDefined())
    editA()
    expect(persistence.getState().saveStatus).toBe('unsaved')
    pendingImage!.onload?.()
    expect(await loading).toBe(true)
    expect(db.records.get('A')!.name).toBe('Edited A')
    expect(JSON.parse(db.records.get('A')!.timelineState).tracks[0].clips[0].endTime).toBe(8)
  })

  it('retains edits and frees the prepared destination when the final outgoing flush fails', async () => {
    await openA()
    storedProject('B')
    let pendingImage: TestImage | undefined
    imageControls.set('blob:B.png', (image) => {
      pendingImage = image
    })
    const loading = persistence.getState().loadProject('B')
    await vi.waitFor(() => expect(pendingImage).toBeDefined())
    editA()
    db.save.mockRejectedValueOnce(new Error('quota exceeded'))
    pendingImage!.onload?.()
    expect(await loading).toBe(false)
    expect(persistence.getState()).toMatchObject({
      currentProjectId: 'A',
      saveStatus: 'error',
      isLoading: false,
    })
    expect(clips()[0].endTime).toBe(8)
    expect(media.getState().files[0].id).toBe('A-media-0')
    expect(history.getState().canUndo()).toBe(true)
    expect(revoked).toHaveBeenCalledWith('blob:B.png')
    expect(revoked).not.toHaveBeenCalledWith('blob:A.png')
  })

  it('flushes again when an outgoing edit arrives during an in-flight save', async () => {
    await openA()
    storedProject('B')
    const writing = deferred<void>()
    db.save.mockImplementationOnce(async (record, blobs) => {
      await writing.promise
      db.records.set(record.id, structuredClone(record))
      db.blobs.set(record.id, new Map(blobs))
    })
    const loading = persistence.getState().loadProject('B')
    await vi.waitFor(() => expect(db.save).toHaveBeenCalledTimes(1))
    editA()
    writing.resolve()
    expect(await loading).toBe(true)
    expect(db.records.get('A')!.name).toBe('Edited A')
    expect(JSON.parse(db.records.get('A')!.timelineState).tracks[0].clips[0].endTime).toBe(8)
  })

  it('re-prepares a same-project reload when edits arrive during decoding', async () => {
    await openA()
    let pendingImage: TestImage | undefined
    imageControls.set('blob:A.png', (image) => {
      pendingImage = image
      imageControls.delete('blob:A.png')
    })
    const loading = persistence.getState().loadProject('A')
    await vi.waitFor(() => expect(pendingImage).toBeDefined())
    editA()
    pendingImage!.onload?.()
    expect(await loading).toBe(true)
    expect(persistence.getState().projectMetadata!.name).toBe('Edited A')
    expect(clips()[0].endTime).toBe(8)
    expect(history.getState().canUndo()).toBe(false)
  })

  it('does not let delayed older thumbnail capture overwrite the switch flush', async () => {
    await openA()
    storedProject('B')
    const thumbnail = deferred<string | null>()
    persistence.setState({
      _captureProjectThumbnail: vi
        .fn<() => Promise<string | null>>()
        .mockImplementationOnce(() => thumbnail.promise)
        .mockResolvedValue(null),
    })
    const oldSave = persistence.getState().saveCurrentProject()
    editA()
    expect(await persistence.getState().loadProject('B')).toBe(true)
    thumbnail.resolve(null)
    await oldSave
    expect(db.records.get('A')!.name).toBe('Edited A')
    expect(JSON.parse(db.records.get('A')!.timelineState).tracks[0].clips[0].endTime).toBe(8)
    expect(persistence.getState()).toMatchObject({ currentProjectId: 'B', saveStatus: 'saved' })
  })

  it('keeps same-session Undo and Redo working, then clears them on active deletion', async () => {
    await openA()
    editA()
    history.getState().undo()
    expect(clips()[0].endTime).toBe(10)
    history.getState().redo()
    expect(clips()[0].endTime).toBe(8)
    playback.getState().play()
    await persistence.getState().deleteProject('A')
    history.getState().undo()
    history.getState().redo()
    expect(clips()).toEqual([])
    expect(history.getState().canUndo()).toBe(false)
    expect(history.getState().canRedo()).toBe(false)
    expect(timeline.getState()).toMatchObject({
      selectedClipId: null,
      selectedClipIds: [],
      clipboardClipId: null,
    })
    expect(keyframes.getState().clipKeyframes.size).toBe(0)
    expect(keyframes.getState()).toMatchObject({
      selectedKeyframeId: null,
      clipboardKeyframes: null,
    })
    expect(playback.getState()).toMatchObject({
      currentTime: 0,
      isPlaying: false,
      playbackSpeed: 1,
    })
    expect(media.getState().files).toEqual([])
  })

  it.each(['A', 'B'])('invalidates pending adoption when %s is deleted', async (deletedId) => {
    await openA()
    storedProject('B')
    let pendingImage: TestImage | undefined
    imageControls.set('blob:B.png', (image) => {
      pendingImage = image
    })
    const loading = persistence.getState().loadProject('B')
    await vi.waitFor(() => expect(pendingImage).toBeDefined())
    await persistence.getState().deleteProject(deletedId)
    pendingImage!.onload?.()
    expect(await loading).toBe(false)
    expect(persistence.getState().currentProjectId).toBe(deletedId === 'A' ? null : 'A')
    expect(revoked).toHaveBeenCalledWith('blob:B.png')
    expect(db.records.has(deletedId)).toBe(false)
  })

  it('retains the session and Undo when active deletion fails', async () => {
    await openA()
    editA()
    db.remove.mockRejectedValueOnce(new Error('delete failed'))
    await persistence.getState().deleteProject('A')
    expect(persistence.getState().currentProjectId).toBe('A')
    expect(media.getState().files[0].id).toBe('A-media-0')
    expect(revoked).not.toHaveBeenCalled()
    history.getState().undo()
    expect(clips()[0].endTime).toBe(10)
  })
})
