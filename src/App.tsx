import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'

import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { PreviewCanvas, type PreviewCanvasHandle } from './components/preview/PreviewCanvas'
import { ProjectSelector } from './components/project'
import { ScopesPanel } from './components/scopes'
import { Timeline } from './components/timeline/Timeline'
import { KeyboardShortcutsHelp } from './components/ui/KeyboardShortcutsHelp'
import { getComparisonModeByKeyboardCode } from './config/comparisonModes'
import { useKeyboardShortcutsHelp } from './hooks/useKeyboardShortcutsHelp'
import { isSupportedMediaFile } from './lib/media/fileTypes'
import { captureCanvasScreenshot, downloadBlob } from './lib/screenshotExport'
import { useHistoryStore } from './stores/historyStore'
import { useMediaStore } from './stores/mediaStore'
import { usePersistenceStore } from './stores/persistenceStore'
import { usePlaybackStore } from './stores/playbackStore'
import { useProjectStore } from './stores/projectStore'
import { useTimelineStore } from './stores/timelineStore'

const ExportDialog = lazy(() =>
  import('./components/layout/ExportDialog').then((module) => ({ default: module.ExportDialog })),
)

export default function App() {
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isTimelineVisible, setIsTimelineVisible] = useState(true)
  const [isSidebarVisible, setIsSidebarVisible] = useState(true)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isProjectSelectorOpen, setIsProjectSelectorOpen] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<PreviewCanvasHandle>(null)

  // Keyboard shortcuts help modal
  const shortcutsHelp = useKeyboardShortcutsHelp()

  // PERSIST-001: Initialize persistence store
  const {
    init: initPersistence,
    createNewProject,
    currentProjectId,
    saveCurrentProject,
  } = usePersistenceStore()

  // Initialize persistence and create a project if none exists
  useEffect(() => {
    const initialize = async () => {
      await initPersistence()
      // If no current project, create one
      if (!currentProjectId) {
        await createNewProject()
      }
    }
    initialize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const {
    zoomIn,
    zoomOut,
    setLoopIn,
    setLoopOut,
    clearLoop,
    addMarker,
    shuttleForward,
    shuttleBackward,
    shuttleStop,
    duration,
  } = useTimelineStore()
  const { togglePlay, seek, currentTime, isPlaying, stepFrame } = usePlaybackStore()
  const { addFile } = useMediaStore()
  const { addClip, tracks } = useTimelineStore()
  const {
    toggleMetrics,
    setComparisonMode,
    toggleWebGLFlipAB,
    comparisonMode,
    setWebGLComparisonMode,
    webglComparisonSettings,
    toggleScopes,
  } = useProjectStore()
  const { undo, redo } = useHistoryStore()

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // PERSIST-002: Save project (Ctrl+S)
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault()
        saveCurrentProject()
        return
      }

      // Undo/Redo (FIX-001)
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }

      const shortcutMode = getComparisonModeByKeyboardCode(e.code)
      if (shortcutMode) {
        e.preventDefault()
        setComparisonMode(shortcutMode)
        return
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (!isPlaying && !e.shiftKey) {
            // Frame step when paused (VID-001)
            stepFrame(-1)
          } else {
            seek(Math.max(0, currentTime - (e.shiftKey ? 5 : 1)))
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          if (!isPlaying && !e.shiftKey) {
            // Frame step when paused (VID-001)
            stepFrame(1)
          } else {
            seek(Math.min(duration, currentTime + (e.shiftKey ? 5 : 1)))
          }
          break
        case 'KeyI':
          // Set loop in point (VID-003)
          e.preventDefault()
          setLoopIn()
          break
        case 'KeyO':
          // Set loop out point (VID-003)
          e.preventDefault()
          setLoopOut()
          break
        case 'Escape':
          // Clear loop region (VID-003)
          clearLoop()
          break
        case 'Home':
          e.preventDefault()
          seek(0)
          break
        case 'End':
          e.preventDefault()
          seek(duration)
          break
        case 'Equal':
        case 'NumpadAdd':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            zoomIn()
          }
          break
        case 'Minus':
        case 'NumpadSubtract':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            zoomOut()
          }
          break
        case 'KeyE':
          e.preventDefault()
          setIsExportOpen(true)
          break
        case 'KeyT':
          e.preventDefault()
          setIsTimelineVisible((v) => !v)
          break
        case 'KeyB':
          e.preventDefault()
          setIsSidebarVisible((v) => !v)
          break
        case 'KeyM':
          // Toggle quality metrics (VID-004) with Shift, add marker without
          e.preventDefault()
          if (e.shiftKey) {
            toggleMetrics()
          } else {
            addMarker()
          }
          break
        case 'KeyS':
          // Quick screenshot (Shift+S)
          if (e.shiftKey) {
            e.preventDefault()
            const frame = previewRef.current?.captureFrame() ?? null
            if (!frame) {
              console.warn(
                'Quick screenshot skipped because the current comparison frame is not ready',
              )
              break
            }
            captureCanvasScreenshot(frame, 'png').then((blob) => {
              if (blob) {
                downloadBlob(blob, `dualview-screenshot-${Date.now()}.png`)
              }
            })
          }
          break
        // J/K/L Shuttle controls (TL-005)
        case 'KeyJ':
          e.preventDefault()
          shuttleBackward()
          break
        case 'KeyK':
          e.preventDefault()
          shuttleStop()
          break
        case 'KeyL':
          e.preventDefault()
          shuttleForward()
          break
        // WEBGL-008: Flip A/B in WebGL comparison mode
        case 'KeyF':
          if (comparisonMode === 'webgl-compare') {
            e.preventDefault()
            toggleWebGLFlipAB()
          }
          break
        // SCOPE-005: Focus Peaking toggle (P key)
        case 'KeyP':
          e.preventDefault()
          // If already in focus-peak mode, switch back to perceptual diff
          if (
            comparisonMode === 'webgl-compare' &&
            webglComparisonSettings.mode === 'exposure-focus-peak'
          ) {
            setWebGLComparisonMode('diff-perceptual')
          } else {
            // Switch to webgl-compare mode with focus-peak
            setComparisonMode('webgl-compare')
            setWebGLComparisonMode('exposure-focus-peak')
          }
          break
        // SCOPE-006: Zebra Stripes toggle (Z key)
        case 'KeyZ':
          e.preventDefault()
          // If already in zebra mode, switch back to perceptual diff
          if (
            comparisonMode === 'webgl-compare' &&
            webglComparisonSettings.mode === 'exposure-zebra'
          ) {
            setWebGLComparisonMode('diff-perceptual')
          } else {
            // Switch to webgl-compare mode with zebra
            setComparisonMode('webgl-compare')
            setWebGLComparisonMode('exposure-zebra')
          }
          break
        // SCOPE-001/002/003: Toggle video scopes panel (G key)
        case 'KeyG':
          e.preventDefault()
          toggleScopes()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    togglePlay,
    seek,
    currentTime,
    duration,
    zoomIn,
    zoomOut,
    toggleMetrics,
    addMarker,
    shuttleForward,
    shuttleBackward,
    shuttleStop,
    undo,
    redo,
    stepFrame,
    isPlaying,
    setComparisonMode,
    toggleWebGLFlipAB,
    comparisonMode,
    setWebGLComparisonMode,
    webglComparisonSettings.mode,
    toggleScopes,
    saveCurrentProject,
  ])

  // Global drag and drop
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      const files = e.dataTransfer.files

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (isSupportedMediaFile(file)) {
          const mediaFile = await addFile(file)

          // Auto-add to timeline (respecting accepted types)
          const trackA = tracks.find((t) => t.type === 'a')
          const trackB = tracks.find((t) => t.type === 'b')

          if (
            i === 0 &&
            trackA &&
            trackA.clips.length === 0 &&
            trackA.acceptedTypes.includes(mediaFile.type)
          ) {
            addClip(trackA.id, mediaFile.id, 0, mediaFile.duration || 10)
          } else if (
            i === 1 &&
            trackB &&
            trackB.clips.length === 0 &&
            trackB.acceptedTypes.includes(mediaFile.type)
          ) {
            addClip(trackB.id, mediaFile.id, 0, mediaFile.duration || 10)
          }
        }
      }
    },
    [addFile, addClip, tracks],
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  return (
    <div
      className="h-screen flex flex-col bg-background overflow-hidden"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <Header
        onExport={() => setIsExportOpen(true)}
        onShowShortcuts={shortcutsHelp.open}
        onToggleSidebar={() => setIsMobileSidebarOpen(true)}
        onOpenProjects={() => setIsProjectSelectorOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Mobile sidebar drawer (only renders when open) */}
        {isMobileSidebarOpen && (
          <Sidebar
            isMobileOpen={true}
            onMobileClose={() => setIsMobileSidebarOpen(false)}
            onOpenProjects={() => setIsProjectSelectorOpen(true)}
          />
        )}

        {/* Desktop sidebar */}
        {isSidebarVisible ? (
          <Sidebar
            onCollapse={() => setIsSidebarVisible(false)}
            onOpenProjects={() => setIsProjectSelectorOpen(true)}
          />
        ) : (
          /* Collapsed sidebar - click to expand (desktop only) */
          <div
            onClick={() => setIsSidebarVisible(true)}
            className="w-8 bg-surface hover:bg-surface-hover border-r border-border cursor-pointer flex items-center justify-center group transition-colors hide-mobile"
            title="Open Sidebar (B)"
          >
            <span className="text-text-muted group-hover:text-text-primary text-lg">→</span>
          </div>
        )}

        <main className="flex-1 flex flex-col overflow-hidden relative">
          <PreviewCanvas
            ref={previewRef}
            canvasRef={canvasRef}
            isTimelineVisible={isTimelineVisible}
          />
          {isTimelineVisible && <Timeline />}

          {/* Timeline toggle button */}
          <button
            onClick={() => setIsTimelineVisible((v) => !v)}
            className="absolute bottom-2 right-2 z-50 bg-surface hover:bg-surface-hover border border-border px-2 py-1 text-xs text-text-secondary hide-mobile"
            title="Toggle Timeline (T)"
          >
            {isTimelineVisible ? 'Hide Timeline' : 'Show Timeline'}
          </button>
        </main>
      </div>

      {/* SCOPE-001, SCOPE-002, SCOPE-003: Video Scopes Panel */}
      <ScopesPanel />

      {isExportOpen && (
        <Suspense fallback={null}>
          <ExportDialog
            isOpen
            onClose={() => setIsExportOpen(false)}
            canvasRef={canvasRef}
            captureFrame={(options) => previewRef.current?.captureFrame(options) ?? null}
          />
        </Suspense>
      )}
      <KeyboardShortcutsHelp isOpen={shortcutsHelp.isOpen} onClose={shortcutsHelp.close} />

      {/* PERSIST-003: Project selector modal */}
      <ProjectSelector
        isOpen={isProjectSelectorOpen}
        onClose={() => setIsProjectSelectorOpen(false)}
      />
    </div>
  )
}
