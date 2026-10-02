import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProjectRecord } from '../lib/indexedDB'
import { prepareProject } from '../lib/projectPreparation'
import type { MediaFile } from '../types'

const db = vi.hoisted(() => ({
  records: new Map<string, ProjectRecord>(),
  blobs: new Map<string, Map<string, Blob>>(),
  save: vi.fn<(record: ProjectRecord, blobs: ReadonlyMap<string, Blob>) => Promise<void>>(),
}))
vi.mock('../lib/indexedDB', () => ({
  isIndexedDBAvailable: () => true,
  initDB: async () => ({}),
  saveProjectWithMedia: db.save,
  getProject: async (id: string) => structuredClone(db.records.get(id) ?? null),
  getProjectMediaBlobs: async (id: string) => new Map(db.blobs.get(id)),
  getAllProjects: async () => [...db.records.values()],
  deleteProject: async () => undefined,
  estimateStorageUsage: async () => ({ used: 0, quota: 0, percentUsed: 0 }),
}))

import { useKeyframeStore as keyframes } from './keyframeStore'
import { useMediaStore as media } from './mediaStore'
import { usePersistenceStore as persistence } from './persistenceStore'
import { usePlaybackStore as playback } from './playbackStore'
import { useProjectStore as project } from './projectStore'
import { useTimelineStore as timeline } from './timelineStore'

const pendingCleanups: (() => void)[] = []

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  pendingCleanups.push(() => resolve(undefined as T))
  return { promise, resolve }
}

function write(record: ProjectRecord, blobs: ReadonlyMap<string, Blob>) {
  db.records.set(record.id, structuredClone(record))
  db.blobs.set(record.id, new Map(blobs))
}

async function stored() {
  const { getProject } = await import('../lib/indexedDB')
  return (await getProject(persistence.getState().currentProjectId!))!
}

async function autosave() {
  expect(persistence.getState().saveStatus).toBe('unsaved')
  await vi.advanceTimersByTimeAsync(500)
  expect(db.save).toHaveBeenCalledTimes(1)
  expect(persistence.getState().saveStatus).toBe('saved')
  expect(persistence.getState().error).toBeNull()
  return stored()
}

async function restore(record: ProjectRecord) {
  // 保存済みレコードを直接復元する。同一プロジェクトの切替前保存で検知漏れを隠さない。
  return (await prepareProject(record, db.blobs.get(record.id)!, () => true))!
}

beforeEach(async () => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  db.records.clear()
  db.blobs.clear()
  db.save.mockImplementation(async (record, blobs) => write(record, blobs))
  vi.stubGlobal('window', { dispatchEvent: vi.fn<(event: unknown) => void>() })
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', vi.fn<(id: number) => void>())
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 16
      naturalHeight = 16
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(url: string) {
        if (url) Promise.resolve().then(() => this.onload?.())
      }
    },
  )
  vi.stubGlobal('document', {
    createElement: () => ({ getContext: () => null }),
  })
  persistence.getState().cancelAutoSave()
  persistence.setState({
    ...persistence.getInitialState(),
    _captureProjectThumbnail: async () => null,
  })
  playback.setState(playback.getInitialState())
  project.setState(project.getInitialState())
  timeline.setState(timeline.getInitialState())
  media.setState(media.getInitialState())
  keyframes.setState(keyframes.getInitialState())
  await persistence.getState().createNewProject('Autosave')
  media.setState({
    files: [
      {
        id: 'image',
        name: 'image.png',
        type: 'image',
        file: new File(['first'], 'image.png', { type: 'image/png' }),
        url: 'blob:image',
        status: 'ready',
        width: 16,
        height: 16,
      },
    ],
  })
  timeline.getState().addClip('track-a', 'image', 0, 5)
  await persistence.getState().saveCurrentProject()
  db.save.mockClear()
})

afterEach(async () => {
  persistence.getState().cancelAutoSave()
  pendingCleanups.splice(0).forEach((finish) => finish())
  await vi.advanceTimersByTimeAsync(0)
  playback.getState().pause()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const settingsChanges = [
  ['comparisonMode', () => project.getState().setComparisonMode('webgl-compare')],
  ['blendMode', () => project.getState().setBlendMode('overlay')],
  ['splitLayout', () => project.getState().setSplitLayout('1x2')],
  ['sliderPosition', () => project.getState().setSliderPosition(72)],
  ['sliderOrientation', () => project.getState().setSliderOrientation('horizontal')],
  ['hideSlider', () => project.getState().toggleHideSlider()],
  ['aspectRatioSettings', () => project.getState().setAspectRatioPreset('1:1')],
  [
    'webglComparisonSettings',
    () => project.getState().setWebGLComparisonSettings({ threshold: 0.17 }),
  ],
  ['scopesSettings', () => project.getState().setScopesSettings({ scopeIntensity: 2 })],
  ['quadViewSettings', () => project.getState().setQuadViewSettings({ showDifference: true })],
  ['radialLoupeSettings', () => project.getState().setRadialLoupeSettings({ radius: 80 })],
  ['gridTileSettings', () => project.getState().setGridTileSettings({ tileSize: 32 })],
  ['pixelGridSettings', () => project.getState().setPixelGridSettings({ showRGBValues: true })],
  ['morphologicalSettings', () => project.getState().setMorphologicalSettings({ elementSize: 7 })],
  ['exportSettings', () => project.getState().setExportSettings({ fps: 60 })],
] as const

const timelineChanges = [
  ['tracks', () => timeline.getState().renameTrack('track-a', 'Renamed A')],
  ['zoom', () => timeline.getState().setZoom(2)],
  ['playbackSpeed', () => timeline.getState().setPlaybackSpeed(0.5)],
  ['loopRegion', () => timeline.getState().setLoopOut()],
  ['frameRate', () => timeline.setState({ frameRate: 60 })],
  ['markers', () => timeline.getState().addMarker('Review')],
  ['snapEnabled', () => timeline.getState().toggleSnap()],
  ['snapThreshold', () => timeline.getState().setSnapThreshold(0.25)],
  ['rippleEnabled', () => timeline.getState().toggleRipple()],
] as const

describe('保存項目の単独変更と復元', () => {
  it.each(settingsChanges)('%s だけを変更しても自動保存・復元する', async (key, edit) => {
    const before = JSON.parse((await stored()).projectSettings)[key]
    edit()
    const expected = project.getState()[key]
    expect(expected).not.toEqual(before)
    const record = await autosave()
    expect(JSON.parse(record.projectSettings)[key]).toEqual(expected)
    expect((await restore(record)).settings[key]).toEqual(expected)
  })

  it.each(timelineChanges)('タイムラインの %s だけを自動保存・復元する', async (key, edit) => {
    const before = JSON.parse((await stored()).timelineState)[key]
    edit()
    const expected = timeline.getState()[key]
    expect(expected).not.toEqual(before)
    const record = await autosave()
    expect(JSON.parse(record.timelineState)[key]).toEqual(expected)
    expect((await restore(record)).timeline[key]).toEqual(expected)
  })

  it('継続時間だけの変更も保存対象として検知する', async () => {
    timeline.getState().setDuration(90)
    const record = await autosave()
    expect(JSON.parse(record.timelineState).duration).toBe(90)
  })

  it('クリップ終端と一致する継続時間を自動保存して復元する', async () => {
    const clip = timeline.getState().tracks[0].clips[0]
    timeline.getState().updateClip(clip.id, { endTime: 90, outPoint: 90 })
    expect(timeline.getState().duration).toBe(90)
    const record = await autosave()
    expect(JSON.parse(record.timelineState).duration).toBe(90)
    const restored = await restore(record)
    expect(restored.timeline.duration).toBe(90)
    expect(restored.timeline.tracks?.[0]?.clips[0]?.endTime).toBe(90)
  })

  it.each([
    ['name', 'Changed project'],
    ['description', 'Delivery review'],
    ['tags', ['approved']],
  ] as const)('メタデータの %s を自動保存する', async (key, value) => {
    const expected = Array.isArray(value) ? [...value] : value
    persistence.getState().updateProjectMetadata({ [key]: expected })
    expect((await autosave())[key]).toEqual(expected)
  })

  it('キーフレームの追加・更新・削除を単独で自動保存・復元する', async () => {
    const clipId = timeline.getState().tracks[0].clips[0].id
    keyframes.getState().addKeyframeToClip(clipId, 'opacity', 0, 0.5)
    let record = await autosave()
    expect((await restore(record)).keyframes).toEqual(keyframes.getState().clipKeyframes)
    const keyframe = keyframes.getState().clipKeyframes.get(clipId)!.tracks[0].keyframes[0]
    db.save.mockClear()
    keyframes.getState().updateKeyframeById(clipId, keyframe.id, { value: 0.8 })
    record = await autosave()
    expect((await restore(record)).keyframes.get(clipId)!.tracks[0].keyframes[0].value).toBe(0.8)
    db.save.mockClear()
    keyframes.getState().removeKeyframeById(clipId, keyframe.id)
    record = await autosave()
    expect((await restore(record)).keyframes.size).toBe(0)
  })

  it.each([
    ['id', 'replacement'],
    ['name', 'renamed.png'],
    ['type', 'video'],
    ['duration', 6],
    ['width', 32],
    ['height', 32],
    ['waveformPeaks', [0.2, 0.8]],
    ['status', 'processing'],
  ] as const)('素材数が同じでも %s の変更を自動保存する', async (key, value) => {
    const expected = Array.isArray(value) ? [...value] : value
    media.setState({
      files: media.getState().files.map((file) => ({ ...file, [key]: expected })) as MediaFile[],
    })
    expect((await autosave()).mediaManifest[0][key]).toEqual(expected)
  })

  it('素材の追加・削除も自動保存し、不要になった Blob を残さない', async () => {
    const original = media.getState().files[0]
    media.setState({ files: [original, { ...original, id: 'second', name: 'second.png' }] })
    let record = await autosave()
    expect(record.mediaManifest.map((file) => file.id)).toEqual(['image', 'second'])
    expect([...db.blobs.get(record.id)!.keys()]).toEqual(['image', 'second'])
    db.save.mockClear()
    media.getState().removeFile('second')
    record = await autosave()
    expect(record.mediaManifest.map((file) => file.id)).toEqual(['image'])
    expect([...db.blobs.get(record.id)!.keys()]).toEqual(['image'])
  })

  it('メタデータが同一でも File の置換を保存する', async () => {
    const replacement = new File(['replacement bytes'], 'image.png', { type: 'image/png' })
    media.setState({
      files: media.getState().files.map((file) => ({ ...file, file: replacement })),
    })
    const record = await autosave()
    const { getProjectMediaBlobs } = await import('../lib/indexedDB')
    const savedFile = (await getProjectMediaBlobs(record.id)).get('image')!
    expect(await savedFile.text()).toBe('replacement bytes')
    expect(await (await restore(record)).files[0].file.text()).toBe('replacement bytes')
  })
})

describe('保存状態と一時状態', () => {
  it('再生・解析進捗・ポインター・選択だけでは書き込まない', async () => {
    for (let index = 0; index < 60; index++) {
      timeline.getState().seek(index / 30)
      project.getState().setMetrics(index, index)
      project.getState().setExportProgress({ progress: index })
      project.getState().setPixelInfo('a', { x: index, y: 0, r: 1, g: 2, b: 3 })
      media.setState({
        files: media.getState().files.map((file) => ({ ...file, processingProgress: index })),
      })
    }
    playback.getState().play()
    playback.getState().pause()
    timeline.getState().selectClip(timeline.getState().tracks[0].clips[0].id)
    media.getState().selectFile('image')
    keyframes.getState().selectKeyframe('selected')
    keyframes.setState({ clipboardKeyframes: [] })
    await vi.advanceTimersByTimeAsync(1000)
    expect(db.save).not.toHaveBeenCalled()
    expect(persistence.getState().saveStatus).toBe('saved')
    // 復帰位置は、次の編集による保存に同梱する。
    project.getState().toggleHideSlider()
    const record = await autosave()
    expect(JSON.parse(record.timelineState).currentTime).toBe(timeline.getState().currentTime)
  })

  it('連続編集をまとめ、古い保存完了で新しい編集を保存済みにしない', async () => {
    const pending = deferred<void>()
    db.save.mockImplementationOnce(async (record, blobs) => {
      await pending.promise
      write(record, blobs)
    })
    project.getState().setWebGLComparisonSettings({ threshold: 0.1 })
    await vi.advanceTimersByTimeAsync(500)
    expect(persistence.getState().saveStatus).toBe('saving')
    project.getState().setWebGLComparisonSettings({ threshold: 0.2 })
    expect(persistence.getState().saveStatus).toBe('unsaved')
    pending.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(persistence.getState().saveStatus).toBe('unsaved')
    expect(JSON.parse((await stored()).projectSettings).webglComparisonSettings.threshold).toBe(0.1)
    project.getState().setWebGLComparisonSettings({ threshold: 0.3 })
    await vi.advanceTimersByTimeAsync(499)
    expect(db.save).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(db.save).toHaveBeenCalledTimes(2)
    expect(persistence.getState().saveStatus).toBe('saved')
    expect(JSON.parse((await stored()).projectSettings).webglComparisonSettings.threshold).toBe(0.3)
  })

  it.each(['成功', '失敗'])('古い保存が%sしても、新しい保存の実行中表示を保つ', async (outcome) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const first = deferred<void>()
    const second = deferred<void>()
    db.save
      .mockImplementationOnce(async (record, blobs) => {
        await first.promise
        if (outcome === '失敗') throw new Error('older write failed')
        write(record, blobs)
      })
      .mockImplementationOnce(async (record, blobs) => {
        await second.promise
        write(record, blobs)
      })
    project.getState().setWebGLComparisonSettings({ threshold: 0.1 })
    await vi.advanceTimersByTimeAsync(500)
    project.getState().setWebGLComparisonSettings({ threshold: 0.2 })
    await vi.advanceTimersByTimeAsync(500)
    expect(persistence.getState().saveStatus).toBe('saving')
    first.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(db.save).toHaveBeenCalledTimes(2)
    expect(persistence.getState().saveStatus).toBe('saving')
    second.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(persistence.getState().saveStatus).toBe('saved')
    expect(JSON.parse((await stored()).projectSettings).webglComparisonSettings.threshold).toBe(0.2)
  })

  it('失敗を表示し、次の変更で自動保存を再試行する', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    db.save.mockRejectedValueOnce(new Error('quota exceeded'))
    project.getState().setWebGLComparisonSettings({ threshold: 0.1 })
    await vi.advanceTimersByTimeAsync(500)
    expect(persistence.getState().saveStatus).toBe('error')
    expect(JSON.parse((await stored()).projectSettings).webglComparisonSettings.threshold).toBe(
      0.02,
    )
    db.save.mockClear()
    project.getState().setWebGLComparisonSettings({ threshold: 0.2 })
    expect(JSON.parse((await autosave()).projectSettings).webglComparisonSettings.threshold).toBe(
      0.2,
    )
  })

  it('復元の適用自体は新たな自動保存を予約しない', async () => {
    project.getState().setWebGLComparisonSettings({ threshold: 0.3 })
    const record = await autosave()
    await persistence.getState().createNewProject('Other')
    await persistence.getState().loadProject(record.id)
    db.save.mockClear()
    await vi.advanceTimersByTimeAsync(1000)
    expect(db.save).not.toHaveBeenCalled()
    expect(persistence.getState().saveStatus).toBe('saved')
    expect(project.getState().webglComparisonSettings.threshold).toBe(0.3)
  })
})
