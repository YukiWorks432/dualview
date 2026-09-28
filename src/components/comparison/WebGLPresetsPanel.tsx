/**
 * WEBGL-015: WebGL Comparison Presets Panel
 * UI for saving, loading, and managing presets
 */

import {
  Bookmark,
  Save,
  Trash2,
  Download,
  Upload,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'

import {
  loadPresets,
  savePreset,
  deletePreset,
  exportPresets,
  importPresets,
  saveImportedPresets,
  PRESET_CATEGORIES,
  type WebGLPreset,
} from '../../lib/webgl/presets'
import { useProjectStore } from '../../stores/projectStore'
import { ElevatedSurface } from '../ui'

interface WebGLPresetsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function WebGLPresetsPanel({ isOpen, onClose }: WebGLPresetsPanelProps) {
  const [presets, setPresets] = useState<WebGLPreset[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['builtin', 'custom']),
  )
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')
  const [newPresetDescription, setNewPresetDescription] = useState('')
  const [newPresetCategory, setNewPresetCategory] = useState<'qa' | 'ai' | 'vfx' | 'custom'>(
    'custom',
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { webglComparisonSettings, setWebGLComparisonSettings } = useProjectStore()

  // Load presets on mount
  useEffect(() => {
    setPresets(loadPresets())
  }, [])

  // Group presets by category
  const presetsByCategory = presets.reduce(
    (acc, preset) => {
      if (!acc[preset.category]) acc[preset.category] = []
      acc[preset.category].push(preset)
      return acc
    },
    {} as Record<string, WebGLPreset[]>,
  )

  // Apply preset
  const applyPreset = useCallback(
    (preset: WebGLPreset) => {
      setWebGLComparisonSettings(preset.settings)
    },
    [setWebGLComparisonSettings],
  )

  // Save current settings as preset
  const handleSavePreset = useCallback(() => {
    if (!newPresetName.trim()) return

    savePreset({
      name: newPresetName.trim(),
      description: newPresetDescription.trim(),
      category: newPresetCategory,
      settings: {
        mode: webglComparisonSettings.mode,
        amplification: webglComparisonSettings.amplification,
        threshold: webglComparisonSettings.threshold,
        blockSize: webglComparisonSettings.blockSize,
        opacity: webglComparisonSettings.opacity,
        colorScheme: webglComparisonSettings.colorScheme,
        loupeSize: webglComparisonSettings.loupeSize,
        loupeZoom: webglComparisonSettings.loupeZoom,
        checkerSize: webglComparisonSettings.checkerSize,
        onionOpacity: webglComparisonSettings.onionOpacity,
        showMetricsOverlay: webglComparisonSettings.showMetricsOverlay,
        showScaleBar: webglComparisonSettings.showScaleBar,
      },
    })

    setPresets(loadPresets())
    setShowSaveDialog(false)
    setNewPresetName('')
    setNewPresetDescription('')
  }, [newPresetName, newPresetDescription, newPresetCategory, webglComparisonSettings])

  // Delete preset
  const handleDeletePreset = useCallback((presetId: string) => {
    deletePreset(presetId)
    setPresets(loadPresets())
  }, [])

  // Export presets
  const handleExport = useCallback(() => {
    const customPresets = presets.filter((p) => !p.isBuiltin)
    const json = exportPresets(customPresets)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dualview-presets-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [presets])

  // Import presets
  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const json = evt.target?.result as string
      const imported = importPresets(json)
      if (imported.length > 0) {
        saveImportedPresets(imported)
        setPresets(loadPresets())
      }
    }
    reader.readAsText(file)
    e.target.value = '' // Reset input
  }, [])

  // Toggle category
  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }, [])

  if (!isOpen) return null

  return (
    <ElevatedSurface
      offset={2}
      className="absolute top-12 right-4 z-50 flex max-h-[80vh] w-80 flex-col ui-radius-lg border border-transparent"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bookmark size={16} className="text-accent" />
          <span className="font-medium text-text-primary">Presets</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSaveDialog(true)}
            className="surface-control-elevation ui-radius-sm border border-accent bg-accent p-1.5 text-text-primary transition-colors hover:bg-accent-hover"
            title="Save Current Settings"
          >
            <Save size={14} />
          </button>
          <button
            onClick={handleExport}
            className="surface-control ui-radius-sm border p-1.5 text-text-secondary transition-colors hover:text-text-primary"
            title="Export Presets"
          >
            <Download size={14} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="surface-control ui-radius-sm border p-1.5 text-text-secondary transition-colors hover:text-text-primary"
            title="Import Presets"
          >
            <Upload size={14} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={onClose}
            className="surface-control ui-radius-sm ml-2 border p-1.5 text-text-secondary transition-colors hover:text-text-primary"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="p-4 border-b border-border bg-surface-alt">
          <div className="text-sm text-text-secondary mb-2">Save Current Settings</div>
          <input
            type="text"
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            placeholder="Preset name"
            className="surface-control w-full ui-radius-md border px-3 py-2 text-sm text-text-primary mb-2"
            autoFocus
          />
          <input
            type="text"
            value={newPresetDescription}
            onChange={(e) => setNewPresetDescription(e.target.value)}
            placeholder="Description (optional)"
            className="surface-control w-full ui-radius-md border px-3 py-2 text-sm text-text-primary mb-2"
          />
          <select
            value={newPresetCategory}
            onChange={(e) => setNewPresetCategory(e.target.value as 'qa' | 'ai' | 'vfx' | 'custom')}
            className="surface-control w-full ui-radius-md border px-3 py-2 text-sm text-text-primary mb-3"
          >
            <option value="custom">Custom</option>
            <option value="qa">QA & Testing</option>
            <option value="ai">AI Comparison</option>
            <option value="vfx">VFX & Post</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleSavePreset}
              disabled={!newPresetName.trim()}
              className="surface-control-elevation ui-radius-sm flex-1 border border-accent bg-accent py-1.5 text-sm text-text-primary transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save Preset
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="surface-control ui-radius-sm border px-4 py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Presets List */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(PRESET_CATEGORIES).map(([category, label]) => {
          const categoryPresets = presetsByCategory[category] || []
          if (categoryPresets.length === 0) return null

          const isExpanded = expandedCategories.has(category)

          return (
            <div key={category}>
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-4 py-2 bg-surface-alt hover:bg-surface-hover transition-colors"
              >
                <span className="text-sm text-text-secondary font-medium">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">{categoryPresets.length}</span>
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-text-muted" />
                  ) : (
                    <ChevronRight size={14} className="text-text-muted" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="bg-surface">
                  {categoryPresets.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between px-4 py-2 hover:bg-surface-alt group cursor-pointer"
                      onClick={() => applyPreset(preset)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-text-primary truncate">{preset.name}</div>
                        {preset.description && (
                          <div className="text-xs text-text-muted truncate">
                            {preset.description}
                          </div>
                        )}
                      </div>
                      {!preset.isBuiltin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeletePreset(preset.id)
                          }}
                          className="surface-control ui-radius-sm border p-1 text-text-muted opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Keyboard hint */}
      <div className="px-4 py-2 border-t border-border text-xs text-text-muted">
        Click a preset to apply • Ctrl+1-9 for quick access
      </div>
    </ElevatedSurface>
  )
}

// Toggle button for the presets panel
export function PresetsToggle({ onClick, isActive }: { onClick: () => void; isActive: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`surface-control-elevation ui-radius-md border p-2 transition-colors ${isActive ? 'border-accent bg-accent text-text-primary' : 'surface-control text-text-secondary hover:text-text-primary'}`}
      title="Comparison Presets (WEBGL-015)"
    >
      <Bookmark size={16} />
    </button>
  )
}
