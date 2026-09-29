import { useDifferenceStore } from '../../stores/differenceStore'
import { useMediaStore } from '../../stores/mediaStore'
import { usePersistenceStore } from '../../stores/persistenceStore'
import { useTimelineStore } from '../../stores/timelineStore'
import type { DifferenceRequest } from './model'

const fileIds = new WeakMap<Blob, number>()
let nextFileId = 0
function fileIdentity(file: Blob): number {
  let id = fileIds.get(file)
  if (id === undefined) { id = ++nextFileId; fileIds.set(file, id) }
  return id
}
/** Only analysis inputs are keyed; preview appearance and transport are deliberately absent. */
export function createDifferenceRequest(): DifferenceRequest {
  const timeline = useTimelineStore.getState()
  const clipsA = (timeline.tracks.find((track) => track.type === 'a')?.clips ?? []).map((clip) => ({ ...clip }))
  const clipsB = (timeline.tracks.find((track) => track.type === 'b')?.clips ?? []).map((clip) => ({ ...clip }))
  const ids = new Set([...clipsA, ...clipsB].map((clip) => clip.mediaId))
  const files = useMediaStore.getState().files.filter((file) => ids.has(file.id))
  const clipKey = (clips: typeof clipsA) => clips.map((clip) => [clip.id, clip.mediaId, clip.startTime, clip.endTime, clip.inPoint, clip.outPoint, clip.speed ?? 1, clip.reverse ?? false])
  const key = JSON.stringify([usePersistenceStore.getState().currentProjectId, timeline.duration, clipKey(clipsA), clipKey(clipsB), files.map((media) => [media.id, fileIdentity(media.file), media.type, media.status])])
  return { key, duration: timeline.duration, clipsA, clipsB, media: files.map(({ id, name, type, file }) => ({ id, name, type, file })), options: { ...useDifferenceStore.getState().options } }
}
