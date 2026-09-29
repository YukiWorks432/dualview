import { useEffect } from 'react'

import type { TimelineDiffFrameScore } from '../lib/media/timelineDiff'
import { useMediaStore } from '../stores/mediaStore'
import { usePersistenceStore } from '../stores/persistenceStore'
import { useTimelineDiffStore } from '../stores/timelineDiffStore'
import { useTimelineStore } from '../stores/timelineStore'
import type { TimelineClip, MediaType } from '../types'

interface TimelineDiffSource {
  id: string
  type: MediaType
  file: File
  hasAlpha: boolean
}

interface TimelineDiffWorkerInput {
  duration: number
  clipsA: TimelineClip[]
  clipsB: TimelineClip[]
  sources: TimelineDiffSource[]
  colorThreshold: number
  resolution: 'standard' | 'detailed'
}

type TimelineDiffWorkerResponse =
  | {
      type: 'progress'
      jobId: string
      completedFrames: number
      totalFrames: number
      frames: TimelineDiffFrameScore[]
    }
  | {
      type: 'finished'
      jobId: string
      status: 'complete' | 'partial' | 'unsupported' | 'error'
      message?: string
    }

interface TimelineDiffSnapshot {
  input: TimelineDiffWorkerInput
  fingerprint: string
}

interface ActiveJob {
  worker: Worker
  jobId: string
}

let activeJob: ActiveJob | null = null
let nextJobNumber = 1
const fileIdentity = new WeakMap<File, number>()
let nextFileIdentity = 1

function getFileIdentity(file: File): number {
  const existing = fileIdentity.get(file)
  if (existing !== undefined) return existing
  const identity = nextFileIdentity++
  fileIdentity.set(file, identity)
  return identity
}

function copyClip(clip: TimelineClip): TimelineClip {
  return { ...clip }
}

function buildSnapshot(): TimelineDiffSnapshot {
  const timeline = useTimelineStore.getState()
  const mediaFiles = useMediaStore.getState().files
  const projectId = usePersistenceStore.getState().currentProjectId
  const analysis = useTimelineDiffStore.getState()
  const clipsA = timeline.tracks.find((track) => track.type === 'a')?.clips.map(copyClip) ?? []
  const clipsB = timeline.tracks.find((track) => track.type === 'b')?.clips.map(copyClip) ?? []
  const usedMediaIds = new Set([...clipsA, ...clipsB].map((clip) => clip.mediaId))
  const mediaById = new Map(mediaFiles.map((media) => [media.id, media]))
  const sources: TimelineDiffSource[] = []

  for (const mediaId of usedMediaIds) {
    const media = mediaById.get(mediaId)
    if (!media) continue
    sources.push({
      id: media.id,
      type: media.type,
      file: media.file,
      hasAlpha: media.hasAlpha ?? false,
    })
  }

  const fingerprint = JSON.stringify({
    projectId,
    duration: timeline.duration,
    clipsA,
    clipsB,
    sources: sources.map((source) => [
      source.id,
      source.type,
      getFileIdentity(source.file),
      source.file.name,
      source.file.size,
      source.file.lastModified,
      source.hasAlpha,
    ]),
    colorThreshold: analysis.colorThreshold,
    resolution: analysis.resolution,
  })

  return {
    fingerprint,
    input: {
      duration: timeline.duration,
      clipsA,
      clipsB,
      sources,
      colorThreshold: analysis.colorThreshold,
      resolution: analysis.resolution,
    },
  }
}

function cancelActiveJob(): void {
  if (!activeJob) return
  activeJob.worker.postMessage({ type: 'cancel', jobId: activeJob.jobId })
}

export function cancelTimelineDiffAnalysis(): void {
  if (!activeJob) return
  useTimelineDiffStore.getState().requestCancellation(activeJob.jobId)
  cancelActiveJob()
}

export function startTimelineDiffAnalysis(): void {
  cancelActiveJob()

  const snapshot = buildSnapshot()
  const jobId = `timeline-diff-${nextJobNumber++}`
  const store = useTimelineDiffStore.getState()
  store.beginAnalysis(jobId, snapshot.fingerprint)

  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    useTimelineDiffStore
      .getState()
      .finishAnalysis(
        jobId,
        'unsupported',
        'This browser does not support the worker and OffscreenCanvas features required for analysis.',
      )
    return
  }

  let worker: Worker
  try {
    worker = new Worker(new URL('../lib/media/timelineDiff.worker.ts', import.meta.url), {
      type: 'module',
    })
  } catch (error) {
    useTimelineDiffStore
      .getState()
      .finishAnalysis(
        jobId,
        'unsupported',
        error instanceof Error ? error.message : 'The analysis worker could not be started.',
      )
    return
  }

  activeJob = { worker, jobId }
  worker.addEventListener('message', (event: MessageEvent<TimelineDiffWorkerResponse>) => {
    if (activeJob?.worker !== worker || event.data.jobId !== jobId) return

    if (event.data.type === 'progress') {
      useTimelineDiffStore
        .getState()
        .appendFrames(jobId, event.data.frames, event.data.completedFrames, event.data.totalFrames)
      return
    }

    useTimelineDiffStore.getState().finishAnalysis(jobId, event.data.status, event.data.message)
    worker.terminate()
    activeJob = null
  })

  worker.addEventListener('error', (event) => {
    if (activeJob?.worker !== worker) return
    useTimelineDiffStore
      .getState()
      .finishAnalysis(jobId, 'error', event.message || 'The analysis worker failed.')
    worker.terminate()
    activeJob = null
  })

  try {
    worker.postMessage({ type: 'analyze', jobId, input: snapshot.input })
  } catch (error) {
    useTimelineDiffStore
      .getState()
      .finishAnalysis(
        jobId,
        'error',
        error instanceof Error ? error.message : 'The video files could not be sent to the worker.',
      )
    worker.terminate()
    activeJob = null
  }
}

export function useTimelineDiffLifecycle(): void {
  useEffect(() => {
    let lastFingerprint = buildSnapshot().fingerprint

    const refreshFingerprint = () => {
      const nextFingerprint = buildSnapshot().fingerprint
      if (nextFingerprint === lastFingerprint) return

      lastFingerprint = nextFingerprint
      cancelActiveJob()
      useTimelineDiffStore
        .getState()
        .invalidate(
          'Timeline, project, media, or analysis settings changed. Run the comparison again.',
        )
    }

    const unsubscribeTimeline = useTimelineStore.subscribe((state, previous) => {
      if (state.tracks !== previous.tracks || state.duration !== previous.duration) {
        refreshFingerprint()
      }
    })
    const unsubscribeMedia = useMediaStore.subscribe((state, previous) => {
      if (state.files !== previous.files) refreshFingerprint()
    })
    const unsubscribeProject = usePersistenceStore.subscribe((state, previous) => {
      if (state.currentProjectId !== previous.currentProjectId) refreshFingerprint()
    })
    const unsubscribeSettings = useTimelineDiffStore.subscribe((state, previous) => {
      if (
        state.colorThreshold !== previous.colorThreshold ||
        state.resolution !== previous.resolution
      ) {
        refreshFingerprint()
      }
    })

    return () => {
      unsubscribeTimeline()
      unsubscribeMedia()
      unsubscribeProject()
      unsubscribeSettings()
      cancelActiveJob()
    }
  }, [])
}
