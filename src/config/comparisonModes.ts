import {
  AudioLines,
  Blend,
  Circle,
  Columns2,
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

export interface ComparisonShortcut {
  code: string
  key: string
  description: string
  shift?: boolean
}

export interface ComparisonModeDefinition {
  mode: ComparisonMode
  icon: LucideIcon
  label: string
  description: string
  group: 'primary' | 'multi-view' | 'analysis'
  localShortcuts?: ComparisonShortcut[]
  shortcut?: {
    key: string
    code: string
  }
}

export const comparisonModeDefinitions: ComparisonModeDefinition[] = [
  {
    mode: 'slider',
    localShortcuts: [{ code: 'KeyH', key: 'H', description: 'Toggle slider visibility' }],
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
    localShortcuts: [{ code: 'KeyG', key: 'G', description: 'Toggle gamut warning' }],
    icon: Microscope,
    label: 'Difference',
    description: 'Advanced difference analysis',
    group: 'primary',
    shortcut: { key: '3', code: 'Digit3' },
  },
  {
    mode: 'audio',
    localShortcuts: [
      { code: 'KeyA', key: 'A', description: 'Solo Track A' },
      { code: 'KeyB', key: 'B', description: 'Solo Track B' },
      { code: 'KeyS', key: 'S', description: 'Play both A+B' },
    ],
    icon: AudioLines,
    label: 'Audio QA',
    description: 'Compare audio embedded in the current videos',
    group: 'primary',
    shortcut: { key: '4', code: 'Digit4' },
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
    localShortcuts: [1, 2, 3, 4].map((index) => ({
      code: `Digit${index}`,
      key: String(index),
      shift: true,
      description: `Cycle source in quadrant ${index}`,
    })),
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
    localShortcuts: [
      { code: 'KeyF', key: 'F', description: 'Toggle A/B and stop auto flicker' },
      { code: 'Tab', key: 'Tab', description: 'Toggle A/B and stop auto flicker' },
    ],
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

export const secondaryComparisonModes: ComparisonModeDefinition[] = comparisonModeGroups.flatMap(
  (group) => group.modes,
)

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
  return comparisonModeById.get(mode) ?? comparisonModeById.get('slider')!
}
