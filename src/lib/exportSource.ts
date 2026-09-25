import type { ExportSource } from '../types'

export type ExportTrack = 'a' | 'b'

export function isExportTrackSelected(source: ExportSource, track: ExportTrack): boolean {
  return source === 'comparison' || source === `${track}-only`
}
