/**
 * WEBGL-014: Custom Shader Editor
 * Write and preview custom GLSL shaders for comparison
 */

import {
  Code,
  Play,
  Save,
  Upload,
  Download,
  AlertCircle,
  CheckCircle,
  X,
  RefreshCw,
  Copy,
  Trash2,
} from 'lucide-react'
import { useState, useCallback, useEffect, useRef } from 'react'

import { COMPARISON_COMMON } from '../../lib/webgl/comparison-shaders/common'
import { ElevatedSurface } from '../ui'

interface CustomShader {
  id: string
  name: string
  code: string
  createdAt: number
  updatedAt: number
}

interface CustomShaderEditorProps {
  isOpen: boolean
  onClose: () => void
  onApplyShader: (fragmentShader: string) => void
}

const STORAGE_KEY = 'dualview-custom-shaders'

// Default starter shader
const DEFAULT_SHADER = `// Custom comparison shader
// Available uniforms:
//   u_textureA, u_textureB - source textures
//   u_resolution - canvas size
//   u_amplification - 1-100
//   u_threshold - 0-1
//   u_opacity - 0-1
//   u_time - seconds since start
//   u_mouse - normalized mouse position
//   v_texCoord - texture coordinates

void main() {
  // Sample both textures
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  // Calculate simple difference
  vec3 diff = abs(colorA.rgb - colorB.rgb);
  float diffMag = length(diff) * u_amplification;

  // Apply threshold
  if (diffMag < u_threshold) {
    diffMag = 0.0;
  }

  // Map to heatmap color
  vec3 color = heatmap(diffMag);

  gl_FragColor = vec4(color, 1.0);
}`

export function CustomShaderEditor({ isOpen, onClose, onApplyShader }: CustomShaderEditorProps) {
  const [code, setCode] = useState(DEFAULT_SHADER)
  const [savedShaders, setSavedShaders] = useState<CustomShader[]>([])
  const [currentShaderName, setCurrentShaderName] = useState('Untitled')
  const [currentShaderId, setCurrentShaderId] = useState<string | null>(null)
  const [compileStatus, setCompileStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [compileError, setCompileError] = useState<string | null>(null)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  // Load saved shaders
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setSavedShaders(JSON.parse(stored))
      }
    } catch (e) {
      console.error('Failed to load custom shaders:', e)
    }
  }, [])

  // Save shaders to localStorage
  const persistShaders = useCallback((shaders: CustomShader[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shaders))
      setSavedShaders(shaders)
    } catch (e) {
      console.error('Failed to save custom shaders:', e)
    }
  }, [])

  // Compile and test shader
  const compileShader = useCallback(() => {
    // Create temporary WebGL context for testing
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl')
    if (!gl) {
      setCompileStatus('error')
      setCompileError('WebGL not supported')
      return false
    }

    // Create fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
    if (!fragmentShader) {
      setCompileStatus('error')
      setCompileError('Failed to create shader')
      return false
    }

    // Combine with common header
    const fullSource = COMPARISON_COMMON + code
    gl.shaderSource(fragmentShader, fullSource)
    gl.compileShader(fragmentShader)

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(fragmentShader) || 'Unknown error'
      setCompileStatus('error')
      setCompileError(error)
      gl.deleteShader(fragmentShader)
      return false
    }

    gl.deleteShader(fragmentShader)
    setCompileStatus('success')
    setCompileError(null)
    return true
  }, [code])

  // Apply shader to comparison view
  const applyShader = useCallback(() => {
    if (compileShader()) {
      const fullSource = COMPARISON_COMMON + code
      onApplyShader(fullSource)
    }
  }, [code, compileShader, onApplyShader])

  // Save current shader
  const saveShader = useCallback(() => {
    if (!currentShaderName.trim()) return

    const now = Date.now()
    const shader: CustomShader = {
      id: currentShaderId || `custom-${now}`,
      name: currentShaderName.trim(),
      code,
      createdAt: currentShaderId
        ? savedShaders.find((s) => s.id === currentShaderId)?.createdAt || now
        : now,
      updatedAt: now,
    }

    const existing = savedShaders.findIndex((s) => s.id === shader.id)
    const newShaders =
      existing >= 0
        ? savedShaders.map((s, i) => (i === existing ? shader : s))
        : [...savedShaders, shader]

    persistShaders(newShaders)
    setCurrentShaderId(shader.id)
    setShowSaveDialog(false)
  }, [code, currentShaderName, currentShaderId, savedShaders, persistShaders])

  // Load a saved shader
  const loadShader = useCallback((shader: CustomShader) => {
    setCode(shader.code)
    setCurrentShaderName(shader.name)
    setCurrentShaderId(shader.id)
    setCompileStatus('idle')
    setCompileError(null)
  }, [])

  // Delete a saved shader
  const deleteShader = useCallback(
    (id: string) => {
      const newShaders = savedShaders.filter((s) => s.id !== id)
      persistShaders(newShaders)
      if (currentShaderId === id) {
        setCurrentShaderId(null)
        setCurrentShaderName('Untitled')
      }
    },
    [savedShaders, currentShaderId, persistShaders],
  )

  // New shader
  const newShader = useCallback(() => {
    setCode(DEFAULT_SHADER)
    setCurrentShaderName('Untitled')
    setCurrentShaderId(null)
    setCompileStatus('idle')
    setCompileError(null)
  }, [])

  // Export shader as JSON
  const exportShader = useCallback(() => {
    const data = {
      name: currentShaderName,
      code,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentShaderName.replace(/\s+/g, '-').toLowerCase()}-shader.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [currentShaderName, code])

  // Import shader from JSON
  const importShader = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string)
        if (data.code) {
          setCode(data.code)
          setCurrentShaderName(data.name || 'Imported Shader')
          setCurrentShaderId(null)
          setCompileStatus('idle')
        }
      } catch (err) {
        console.error('Failed to import shader:', err)
      }
    }
    reader.readAsText(file)
    e.target.value = '' // Reset input
  }, [])

  // Copy to clipboard
  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [code])

  // Sync scroll between textarea and line numbers
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

  // Calculate line numbers
  const lineCount = code.split('\n').length

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <ElevatedSurface
        offset={3}
        className="ui-radius-lg w-full max-w-5xl max-h-[90vh] flex flex-col border border-transparent"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Code size={20} className="text-accent" />
            <h2 className="text-lg font-semibold text-text-primary">
              Custom Shader Editor (WEBGL-014)
            </h2>
            <span className="text-sm text-text-muted">•</span>
            <span className="text-sm text-text-secondary">{currentShaderName}</span>
          </div>
          <button
            onClick={onClose}
            className="surface-control ui-radius-sm border p-2 text-text-secondary hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Saved Shaders Panel */}
          <div className="w-48 border-r border-border flex flex-col">
            <div className="p-3 border-b border-border">
              <button
                onClick={newShader}
                className="surface-control w-full ui-radius-md flex items-center justify-center gap-2 border px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
              >
                <RefreshCw size={14} />
                New Shader
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <div className="text-xs text-text-muted uppercase tracking-wide px-2 mb-2">
                Saved Shaders
              </div>
              {savedShaders.length === 0 ? (
                <p className="text-xs text-text-muted px-2">No saved shaders</p>
              ) : (
                <div className="space-y-1">
                  {savedShaders.map((shader) => (
                    <div
                      key={shader.id}
                      className={`flex items-center justify-between px-2 py-1.5 ui-radius-md text-sm cursor-pointer ${
                        currentShaderId === shader.id
                          ? 'bg-accent/20 text-text-primary'
                          : 'text-text-secondary hover:bg-surface-hover'
                      }`}
                      onClick={() => loadShader(shader)}
                    >
                      <span className="truncate flex-1">{shader.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteShader(shader.id)
                        }}
                        className="surface-control ui-radius-sm border p-1 text-text-muted hover:text-red-400"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="px-4 py-2 border-b border-border flex items-center gap-2">
              <button
                onClick={compileShader}
                className="surface-control ui-radius-md flex items-center gap-1 border px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
              >
                <Play size={14} />
                Compile
              </button>
              <button
                onClick={applyShader}
                className="surface-control-elevation ui-radius-md flex items-center gap-1 border border-accent bg-accent px-3 py-1.5 text-sm text-text-primary hover:bg-accent-hover"
              >
                <Play size={14} />
                Apply
              </button>

              <div className="w-px h-6 bg-border mx-2" />

              <button
                onClick={() => setShowSaveDialog(true)}
                className="surface-control ui-radius-md flex items-center gap-1 border px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
              >
                <Save size={14} />
                Save
              </button>
              <button
                onClick={exportShader}
                className="surface-control ui-radius-md flex items-center gap-1 border px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
              >
                <Download size={14} />
                Export
              </button>
              <label className="surface-control ui-radius-md flex cursor-pointer items-center gap-1 border px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary">
                <Upload size={14} />
                Import
                <input type="file" accept=".json" onChange={importShader} className="hidden" />
              </label>
              <button
                onClick={copyToClipboard}
                className="surface-control ui-radius-md flex items-center gap-1 border px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
              >
                <Copy size={14} />
              </button>

              <div className="flex-1" />

              {/* Compile status */}
              {compileStatus === 'success' && (
                <div className="flex items-center gap-1 text-green-400 text-sm">
                  <CheckCircle size={14} />
                  Compiled successfully
                </div>
              )}
              {compileStatus === 'error' && (
                <div className="flex items-center gap-1 text-red-400 text-sm">
                  <AlertCircle size={14} />
                  Compilation failed
                </div>
              )}
            </div>

            {/* Code Editor */}
            <div className="flex-1 flex overflow-hidden">
              {/* Line numbers */}
              <div
                ref={lineNumbersRef}
                className="w-12 bg-background text-text-muted text-sm font-mono text-right pr-2 py-2 overflow-hidden select-none"
                style={{ lineHeight: '1.5' }}
              >
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value)
                  setCompileStatus('idle')
                }}
                onScroll={handleScroll}
                className="flex-1 bg-background text-text-primary font-mono text-sm p-2 resize-none focus:outline-none"
                style={{ lineHeight: '1.5' }}
                spellCheck={false}
              />
            </div>

            {/* Error Panel */}
            {compileError && (
              <div className="px-4 py-3 border-t border-error/40 bg-error/10 text-error text-sm font-mono overflow-x-auto">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <pre className="whitespace-pre-wrap">{compileError}</pre>
                </div>
              </div>
            )}

            {/* Help Panel */}
            <div className="px-4 py-2 border-t border-border text-xs text-text-muted">
              <span className="font-medium">Available functions:</span> heatmap(v), rainbow(v),
              getLuminance(rgb), rgbToLab(rgb), labToRgb(lab), deltaE(lab1, lab2), sobelEdge(uv)
            </div>
          </div>
        </div>

        {/* Save Dialog */}
        {showSaveDialog && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-surface-alt rounded-lg p-4 w-80">
              <div className="text-sm text-text-secondary mb-2">Save Shader</div>
              <input
                type="text"
                value={currentShaderName}
                onChange={(e) => setCurrentShaderName(e.target.value)}
                placeholder="Shader name"
                className="w-full bg-surface border border-border ui-radius-md px-3 py-2 text-sm text-text-primary mb-3"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={saveShader}
                  disabled={!currentShaderName.trim()}
                  className="surface-control-elevation ui-radius-md flex-1 border border-accent bg-accent px-4 py-2 text-sm text-text-primary hover:bg-accent-hover disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="surface-control ui-radius-md border px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </ElevatedSurface>
    </div>
  )
}

// Toggle button for shader editor
export function ShaderEditorToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="surface-control ui-radius-md border p-2 text-text-secondary hover:text-text-primary transition-colors"
      title="Custom Shader Editor (WEBGL-014)"
    >
      <Code size={16} />
    </button>
  )
}
