import { comparisonModeDefinitions } from '../config/comparisonModes'
import { prepareMediaFile } from '../stores/mediaStore'
import { useProjectStore } from '../stores/projectStore'
import { useTimelineStore } from '../stores/timelineStore'
import type { MediaFile, TimelineTrack } from '../types'
import type { ProjectRecord } from './indexedDB'
import type { ClipKeyframes } from './keyframes'

export interface PreparedProject {
  record: ProjectRecord
  files: MediaFile[]
  timeline: Partial<ReturnType<typeof useTimelineStore.getState>>
  settings: Partial<ReturnType<typeof useProjectStore.getState>>
  keyframes: Map<string, ClipKeyframes>
}

export function disposeProjectMedia(files: MediaFile[]): void {
  for (const file of files) {
    if (file.url.startsWith('blob:')) URL.revokeObjectURL(file.url)
  }
}

// No live store is changed until all parsing and media decoding has succeeded.
export async function prepareProject(
  record: ProjectRecord,
  mediaBlobs: ReadonlyMap<string, Blob>,
  isCurrent: () => boolean,
): Promise<PreparedProject | null> {
  const files: MediaFile[] = []
  try {
    const timeline = JSON.parse(record.timelineState)
    const settings = JSON.parse(record.projectSettings)
    for (const entry of record.mediaManifest) {
      if (!isCurrent()) {
        disposeProjectMedia(files)
        return null
      }
      if (entry.type !== 'video' && entry.type !== 'image') continue
      const blob = mediaBlobs.get(entry.id)
      if (!blob) continue
      const media = await prepareMediaFile(new File([blob], entry.name, { type: blob.type }))
      files.push({ ...media, id: entry.id })
    }
    if (!isCurrent()) {
      disposeProjectMedia(files)
      return null
    }

    const mediaIds = new Set(files.map((file) => file.id))
    const tracks: TimelineTrack[] = (timeline.tracks as TimelineTrack[]).map((track) => ({
      ...track,
      acceptedTypes: ['video', 'image'],
      clips: track.clips.filter((clip) => mediaIds.has(clip.mediaId)),
    }))
    const clipIds = new Set(tracks.flatMap((track) => track.clips.map((clip) => clip.id)))
    let keyframes = new Map<string, ClipKeyframes>()
    if (record.keyframeData) {
      // Keep compatibility with legacy records whose optional keyframe data is invalid.
      try {
        keyframes = new Map(
          (JSON.parse(record.keyframeData) as [string, ClipKeyframes][]).filter(([clipId]) =>
            clipIds.has(clipId),
          ),
        )
      } catch {
        keyframes = new Map()
      }
    }
    const defaults = useProjectStore.getInitialState()
    return {
      record,
      files,
      timeline: {
        tracks,
        currentTime: timeline.currentTime ?? 0,
        duration: timeline.duration || 30,
        zoom: timeline.zoom || 1,
        playbackSpeed: timeline.playbackSpeed || 1,
        loopRegion: timeline.loopRegion || null,
        frameRate: timeline.frameRate || 30,
        markers: timeline.markers || [],
        snapEnabled: timeline.snapEnabled ?? true,
        snapThreshold: timeline.snapThreshold || 0.1,
        rippleEnabled: timeline.rippleEnabled ?? false,
        isPlaying: false,
        shuttleSpeed: 0,
        selectedClipId: null,
        selectedClipIds: [],
        clipboardClipId: null,
      },
      settings: {
        comparisonMode: comparisonModeDefinitions.some(
          (definition) => definition.mode === settings.comparisonMode,
        )
          ? settings.comparisonMode
          : 'slider',
        blendMode: settings.blendMode || 'difference',
        splitLayout: settings.splitLayout || '2x1',
        sliderPosition: settings.sliderPosition ?? 50,
        sliderOrientation: settings.sliderOrientation || 'vertical',
        hideSlider: settings.hideSlider ?? false,
        aspectRatioSettings: settings.aspectRatioSettings || { preset: '16:9' },
        webglComparisonSettings:
          settings.webglComparisonSettings ?? defaults.webglComparisonSettings,
        scopesSettings: settings.scopesSettings ?? defaults.scopesSettings,
        quadViewSettings: settings.quadViewSettings ?? defaults.quadViewSettings,
        radialLoupeSettings: settings.radialLoupeSettings ?? defaults.radialLoupeSettings,
        gridTileSettings: settings.gridTileSettings ?? defaults.gridTileSettings,
        pixelGridSettings: settings.pixelGridSettings ?? defaults.pixelGridSettings,
        morphologicalSettings: settings.morphologicalSettings ?? defaults.morphologicalSettings,
        exportSettings: settings.exportSettings ?? defaults.exportSettings,
      },
      keyframes,
    }
  } catch (error) {
    disposeProjectMedia(files)
    throw error
  }
}
