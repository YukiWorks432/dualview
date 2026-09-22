import {
  AudioLines,
  Blend,
  Box,
  Braces,
  Circle,
  Columns2,
  FileSpreadsheet,
  FileText,
  Flame,
  Grid,
  Grid2X2,
  Layers,
  Microscope,
  Shrink,
  SplitSquareHorizontal,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import type { ComparisonMode } from '../types'

export interface ComparisonModeDefinition {
  mode: ComparisonMode
  icon: LucideIcon
  label: string
  description: string
  group: 'primary' | 'multi-view' | 'analysis'
  shortcut?: {
    key: string
    code: string
  }
}

export const comparisonModeDefinitions: ComparisonModeDefinition[] = [
  {
    mode: 'slider',
    icon: SplitSquareHorizontal,
    label: 'Slider',
    description: 'Drag to compare',
    group: 'primary',
    shortcut: { key: '1', code: 'Digit1' },
  },
  {
    mode: 'side-by-side',
    icon: Columns2,
    label: 'Side by Side',
    description: 'View both at once',
    group: 'primary',
    shortcut: { key: '2', code: 'Digit2' },
  },
  {
    mode: 'webgl-compare',
    icon: Microscope,
    label: 'Difference',
    description: 'Advanced difference analysis',
    group: 'primary',
    shortcut: { key: '3', code: 'Digit3' },
  },
  {
    mode: 'audio',
    icon: AudioLines,
    label: 'Audio',
    description: 'Compare waveforms',
    group: 'primary',
    shortcut: { key: '4', code: 'Digit4' },
  },
  {
    mode: 'prompt-diff',
    icon: FileText,
    label: 'Prompt',
    description: 'Compare text and prompts',
    group: 'primary',
    shortcut: { key: '5', code: 'Digit5' },
  },
  {
    mode: 'json-diff',
    icon: Braces,
    label: 'JSON',
    description: 'Compare structured JSON data',
    group: 'primary',
    shortcut: { key: '6', code: 'Digit6' },
  },
  {
    mode: 'model-3d',
    icon: Box,
    label: '3D',
    description: 'Compare GLB and GLTF models',
    group: 'primary',
    shortcut: { key: '7', code: 'Digit7' },
  },
  {
    mode: 'document',
    icon: FileSpreadsheet,
    label: 'Document',
    description: 'Compare CSV, Excel, DOCX, and PDF',
    group: 'primary',
    shortcut: { key: '8', code: 'Digit8' },
  },
  {
    mode: 'split',
    icon: Layers,
    label: 'Split Screen',
    description: '2x2 grid layout',
    group: 'multi-view',
  },
  {
    mode: 'quad',
    icon: Grid2X2,
    label: 'Quad View',
    description: 'Four-way comparison',
    group: 'multi-view',
  },
  {
    mode: 'blend',
    icon: Blend,
    label: 'Blend Modes',
    description: 'Overlay comparisons',
    group: 'analysis',
  },
  {
    mode: 'flicker',
    icon: Zap,
    label: 'Flicker',
    description: 'Rapid A/B switching',
    group: 'analysis',
  },
  {
    mode: 'heatmap',
    icon: Flame,
    label: 'Heatmap',
    description: 'Visualize pixel differences',
    group: 'analysis',
  },
  {
    mode: 'radial-loupe',
    icon: Circle,
    label: 'Radial Loupe',
    description: 'Magnified circular comparison',
    group: 'analysis',
  },
  {
    mode: 'grid-tile',
    icon: Grid,
    label: 'Grid Tile',
    description: 'Checkerboard A/B comparison',
    group: 'analysis',
  },
  {
    mode: 'morphological',
    icon: Shrink,
    label: 'Morphological',
    description: 'Apply morphological operations',
    group: 'analysis',
  },
]

export const primaryComparisonModes = comparisonModeDefinitions.filter(
  (definition) => definition.group === 'primary',
)

export const comparisonModeGroups: Array<{
  id: 'multi-view' | 'analysis'
  name: string
  description: string
  modes: ComparisonModeDefinition[]
}> = [
  {
    id: 'multi-view',
    name: 'Multi-View',
    description: 'View multiple angles',
    modes: comparisonModeDefinitions.filter((definition) => definition.group === 'multi-view'),
  },
  {
    id: 'analysis',
    name: 'Analysis Tools',
    description: 'Deep inspection',
    modes: comparisonModeDefinitions.filter((definition) => definition.group === 'analysis'),
  },
]

export const secondaryComparisonModes: ComparisonModeDefinition[] = comparisonModeGroups.flatMap((group) => group.modes)

const comparisonModeByCode = new Map(
  comparisonModeDefinitions.flatMap((definition) =>
    definition.shortcut ? [[definition.shortcut.code, definition.mode] as const] : [],
  ),
)

const comparisonModeById = new Map(
  comparisonModeDefinitions.map((definition) => [definition.mode, definition] as const),
)

export function getComparisonModeByKeyboardCode(code: string): ComparisonMode | undefined {
  return comparisonModeByCode.get(code)
}

export function getComparisonModeDefinition(mode: ComparisonMode): ComparisonModeDefinition {
  const definition = comparisonModeById.get(mode)
  if (!definition) throw new Error(`Unknown comparison mode: ${mode}`)
  return definition
}
