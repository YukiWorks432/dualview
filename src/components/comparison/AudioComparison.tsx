import {
  Activity,
  Waves,
  Volume2,
  Play,
  Pause,
  SkipBack,
  Disc,
  Radio,
  Settings2,
  Grid3X3,
} from 'lucide-react'
/**
 * Professional Audio Comparison Component
 *
 * Comprehensive audio analysis with multiple visualization modes:
 * - Spectrogram comparison (WebGL accelerated)
 * - Spectrum analyzer with overlay
 * - Goniometer/Vectorscope (stereo field)
 * - Loudness meters (LUFS, RMS, Peak)
 * - Phase correlation meter
 *
 * Inspired by professional tools:
 * - iZotope Insight 2
 * - ADPTR Metric AB
 * - Waves PAZ Analyzer
 * - Youlean Loudness Meter
 */
import { useRef, useEffect, useState, useCallback } from 'react'

import {
  analyzeAudio,
  formatLUFS,
  formatDb,
  LOUDNESS_TARGET_LABELS,
  LOUDNESS_TARGETS,
  type AudioAnalysisResult,
  type LoudnessMetrics,
} from '../../lib/audio'
import {
  AudioSourceRegistry,
  createAudioPlaybackSource,
  extractPrimaryAudioBuffer,
  PlaybackRequestGate,
} from '../../lib/media/audio'
import { calculateMediaTime, findActiveClip } from '../../lib/media/timeline'
import { cn, formatTime } from '../../lib/utils'
import { useMediaStore } from '../../stores/mediaStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useTimelineStore } from '../../stores/timelineStore'

type AudioViewMode = 'spectrogram' | 'spectrum' | 'goniometer' | 'loudness' | 'waveform' | 'all'
type ActiveAudio = 'both' | 'a' | 'b'

interface AudioAnalysisState {
  mediaId: string | null
  buffer: AudioBuffer | null
  analysis: AudioAnalysisResult | null
  peaks: number[]
}

function createEmptyAudioAnalysisState(): AudioAnalysisState {
  return { mediaId: null, buffer: null, analysis: null, peaks: [] }
}

// Loudness meter component
function LoudnessMeter({
  label,
  metrics,
  color,
  targetPlatform,
}: {
  label: string
  metrics: LoudnessMetrics | null
  color: string
  targetPlatform?: keyof typeof LOUDNESS_TARGETS
}) {
  if (!metrics) {
    return (
      <div className="bg-surface-alt p-3 flex-1 min-w-[200px]">
        <div className="text-xs text-text-muted mb-2">{label}</div>
        <div className="text-2xl font-mono text-text-muted">--</div>
      </div>
    )
  }

  const target = targetPlatform ? LOUDNESS_TARGETS[targetPlatform] : -14
  const diff = metrics.integrated - target
  const isLoud = diff > 1
  const isQuiet = diff < -1

  return (
    <div className="bg-surface-alt p-3 flex-1 min-w-[200px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color }}>
          {label}
        </span>
        {targetPlatform && (
          <span
            className={cn(
              'text-[10px] px-1.5 py-0.5',
              isLoud
                ? 'bg-red-500/20 text-red-400'
                : isQuiet
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-green-500/20 text-green-400',
            )}
          >
            {diff > 0 ? '+' : ''}
            {diff.toFixed(1)} LU
          </span>
        )}
      </div>

      {/* Integrated LUFS */}
      <div className="mb-3">
        <div className="text-[10px] text-text-muted mb-1">INTEGRATED</div>
        <div className="text-2xl font-mono" style={{ color }}>
          {formatLUFS(metrics.integrated)}
        </div>
      </div>

      {/* Meter bars */}
      <div className="space-y-1.5">
        <MeterBar label="Tail 400 ms" value={metrics.momentary} min={-60} max={0} color={color} />
        <MeterBar label="Tail 3 s" value={metrics.shortTerm} min={-60} max={0} color={color} />
        <MeterBar
          label="Sample Peak"
          value={metrics.samplePeak}
          min={-60}
          max={0}
          color={color}
          showClip
        />
        <MeterBar label="RMS" value={metrics.rms} min={-60} max={0} color={color} />
      </div>

      {/* Additional metrics */}
      <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-text-muted">LRA: </span>
          <span className="font-mono">{metrics.loudnessRange.toFixed(1)} LU</span>
        </div>
        <div>
          <span className="text-text-muted">Crest: </span>
          <span className="font-mono">{metrics.crestFactor.toFixed(1)} dB</span>
        </div>
      </div>
    </div>
  )
}

// Meter bar component
function MeterBar({
  label,
  value,
  min,
  max,
  color,
  showClip,
}: {
  label: string
  value: number
  min: number
  max: number
  color: string
  showClip?: boolean
}) {
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  const isClipping = showClip && value > -0.1

  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="text-text-muted">{label}</span>
        <span className={cn('font-mono', isClipping && 'text-red-400')}>{formatDb(value)}</span>
      </div>
      <div className="h-2 bg-surface relative overflow-hidden">
        <div
          className="h-full transition-all duration-75"
          style={{
            width: `${percentage}%`,
            backgroundColor: isClipping ? '#f44336' : color,
          }}
        />
        {/* Grid marks */}
        <div className="absolute inset-0 flex">
          {[-48, -36, -24, -12, -6, 0].map((db) => (
            <div
              key={db}
              className="absolute top-0 bottom-0 w-px bg-background/50"
              style={{ left: `${((db - min) / (max - min)) * 100}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Phase correlation display
function PhaseCorrelation({
  correlationA,
  correlationB,
  mode,
}: {
  correlationA: number
  correlationB: number
  mode: ActiveAudio
}) {
  const correlation =
    mode === 'a' ? correlationA : mode === 'b' ? correlationB : (correlationA + correlationB) / 2

  return (
    <div className="bg-surface-alt p-3">
      <div className="text-xs text-text-muted mb-2">PHASE CORRELATION</div>
      <div className="relative h-6 bg-surface">
        {/* Scale */}
        <div className="absolute inset-0 flex items-center justify-between px-1 text-[8px] text-text-muted">
          <span>-1</span>
          <span>0</span>
          <span>+1</span>
        </div>
        {/* Indicator */}
        <div
          className="absolute top-0 bottom-0 w-2 transition-all duration-75"
          style={{
            left: `${((correlation + 1) / 2) * 100}%`,
            transform: 'translateX(-50%)',
            backgroundColor:
              correlation < 0 ? '#f44336' : correlation < 0.5 ? '#ff9800' : '#4caf50',
          }}
        />
      </div>
      <div className="mt-2 text-center">
        <span
          className={cn(
            'text-lg font-mono',
            correlation < 0
              ? 'text-red-400'
              : correlation < 0.5
                ? 'text-yellow-400'
                : 'text-green-400',
          )}
        >
          {correlation.toFixed(2)}
        </span>
        <span className="text-xs text-text-muted ml-2">
          {correlation < 0 ? 'Out of phase' : correlation < 0.5 ? 'Wide stereo' : 'Mono compatible'}
        </span>
      </div>
    </div>
  )
}

// Stereo width display
function StereoWidth({
  widthA,
  widthB,
  mode,
}: {
  widthA: number
  widthB: number
  mode: ActiveAudio
}) {
  const width = mode === 'a' ? widthA : mode === 'b' ? widthB : (widthA + widthB) / 2

  return (
    <div className="bg-surface-alt p-3">
      <div className="text-xs text-text-muted mb-2">STEREO WIDTH</div>
      <div className="relative h-4 bg-surface overflow-hidden">
        <div
          className="absolute top-0 bottom-0 left-1/2 transition-all duration-75 bg-accent/60"
          style={{
            width: `${width * 100}%`,
            transform: 'translateX(-50%)',
          }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-text-muted">
        <span>Mono</span>
        <span className="font-mono">{Math.round(width * 100)}%</span>
        <span>Wide</span>
      </div>
    </div>
  )
}

// Simple canvas-based waveform renderer (no WebGL)
function WaveformCanvas({
  peaks,
  color,
  currentTime,
  duration,
  onSeek,
  label,
  mediaName,
}: {
  peaks: number[]
  color: string
  currentTime: number
  duration: number
  onSeek: (time: number) => void
  label: string
  mediaName?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  // ResizeObserver for proper sizing
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setSize({ width, height })
        }
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.width === 0 || size.height === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = size.width
    canvas.height = size.height

    const { width, height } = size
    const halfHeight = height / 2

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#0d0d0d'
    ctx.fillRect(0, 0, width, height)

    if (peaks.length === 0) {
      // Draw placeholder
      ctx.fillStyle = '#333'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('No waveform data', width / 2, height / 2)
      return
    }

    const barWidth = width / peaks.length
    const playheadPos = duration > 0 ? (currentTime / duration) * width : 0

    for (let i = 0; i < peaks.length; i++) {
      const x = i * barWidth
      const barHeight = peaks[i] * halfHeight * 0.9
      const isPast = x < playheadPos

      ctx.fillStyle = isPast ? color : `${color}40`
      ctx.fillRect(x, halfHeight - barHeight, Math.max(1, barWidth - 1), barHeight * 2)
    }

    // Playhead
    if (duration > 0) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(playheadPos - 1, 0, 2, height)
    }
  }, [peaks, currentTime, duration, color, size])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (duration <= 0) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    onSeek((x / rect.width) * duration)
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
        <span
          className="w-6 h-6 flex items-center justify-center text-xs font-bold"
          style={{ backgroundColor: color, color: label === 'B' ? '#000' : '#fff' }}
        >
          {label}
        </span>
        {mediaName && (
          <span className="text-xs text-text-primary bg-black/70 px-2 py-0.5">{mediaName}</span>
        )}
      </div>
      <canvas ref={canvasRef} className="w-full h-full cursor-pointer" onClick={handleClick} />
    </div>
  )
}

// Simple canvas-based spectrogram (no WebGL for now - simplified)
function SpectrogramCanvas({
  analysisA,
  analysisB,
  currentTime,
  duration,
}: {
  analysisA: AudioAnalysisState
  analysisB: AudioAnalysisState
  currentTime: number
  duration: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  // ResizeObserver for proper sizing
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setSize({ width, height })
        }
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.width === 0 || size.height === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = size.width
    canvas.height = size.height

    const { width, height } = size

    // Dark background
    ctx.fillStyle = '#0d0d0d'
    ctx.fillRect(0, 0, width, height)

    // Draw simple frequency visualization from waveform peaks
    const peaksA = analysisA.peaks
    const peaksB = analysisB.peaks

    if (peaksA.length === 0 && peaksB.length === 0) {
      ctx.fillStyle = '#333'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('No analysis data', width / 2, height / 2)
      return
    }

    if (peaksA.length > 0) {
      ctx.strokeStyle = '#ff5722'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < peaksA.length; i++) {
        const x = (i / peaksA.length) * width
        const y = height - peaksA[i] * height * 0.45
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    if (peaksB.length > 0) {
      ctx.strokeStyle = '#cddc39'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < peaksB.length; i++) {
        const x = (i / peaksB.length) * width
        const y = height - peaksB[i] * height * 0.45 - height * 0.05
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // Playhead
    if (duration > 0) {
      const playheadX = (currentTime / duration) * width
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX, height)
      ctx.stroke()
    }

    // Labels
    ctx.fillStyle = '#888'
    ctx.font = '10px monospace'
    ctx.textAlign = 'left'
    ctx.fillText('Track A', 10, 20)
    ctx.fillStyle = '#ff5722'
    ctx.fillRect(70, 12, 20, 3)
    ctx.fillStyle = '#888'
    ctx.fillText('Track B', 100, 20)
    ctx.fillStyle = '#cddc39'
    ctx.fillRect(160, 12, 20, 3)
  }, [analysisA.peaks, analysisB.peaks, currentTime, duration, size])

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}

// Simple goniometer display
function GoniometerCanvas({
  analysisA,
  analysisB,
  activeAudio,
}: {
  analysisA: AudioAnalysisState
  analysisB: AudioAnalysisState
  activeAudio: ActiveAudio
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  // ResizeObserver for proper sizing
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setSize({ width, height })
        }
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.width === 0 || size.height === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = size.width
    canvas.height = size.height

    const { width, height } = size
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) * 0.4

    // Background
    ctx.fillStyle = '#0d0d0d'
    ctx.fillRect(0, 0, width, height)

    // Grid circles
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    for (let r = 0.33; r <= 1; r += 0.33) {
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius * r, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Crosshairs
    ctx.beginPath()
    ctx.moveTo(centerX - radius, centerY)
    ctx.lineTo(centerX + radius, centerY)
    ctx.moveTo(centerX, centerY - radius)
    ctx.lineTo(centerX, centerY + radius)
    ctx.stroke()

    // Diagonal lines (L and R axes in Lissajous)
    ctx.strokeStyle = '#444'
    ctx.beginPath()
    ctx.moveTo(centerX - radius * 0.7, centerY - radius * 0.7)
    ctx.lineTo(centerX + radius * 0.7, centerY + radius * 0.7)
    ctx.moveTo(centerX - radius * 0.7, centerY + radius * 0.7)
    ctx.lineTo(centerX + radius * 0.7, centerY - radius * 0.7)
    ctx.stroke()

    // Labels
    ctx.fillStyle = '#666'
    ctx.font = '10px monospace'
    ctx.fillText('L', centerX - radius - 15, centerY + 4)
    ctx.fillText('R', centerX + radius + 5, centerY + 4)
    ctx.fillText('+M', centerX - 8, centerY - radius - 5)
    ctx.fillText('-M', centerX - 8, centerY + radius + 15)

    // Draw stereo field based on analysis
    const analysis = activeAudio === 'b' ? analysisB.analysis : analysisA.analysis
    if (analysis) {
      const width_val = analysis.stereo.width
      const correlation = analysis.stereo.correlation

      // Draw an ellipse representing the stereo field
      ctx.strokeStyle = activeAudio === 'b' ? '#cddc39' : '#ff5722'
      ctx.lineWidth = 2
      ctx.beginPath()
      const ellipseWidth = radius * width_val * 1.5
      const ellipseHeight = radius * (correlation * 0.5 + 0.5)
      ctx.ellipse(centerX, centerY, ellipseWidth, ellipseHeight, Math.PI / 4, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      // No analysis data
      ctx.fillStyle = '#333'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('No stereo data', centerX, centerY)
    }
  }, [analysisA.analysis, analysisB.analysis, activeAudio, size])

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}

export function AudioComparison() {
  const playbackContextRef = useRef<AudioContext | null>(null)
  const sourceRegistryRef = useRef(new AudioSourceRegistry())
  const playbackRequestGateRef = useRef(new PlaybackRequestGate())
  const playingClipIdsRef = useRef<{ a: string | null; b: string | null }>({ a: null, b: null })

  // State
  const [viewMode, setViewMode] = useState<AudioViewMode>('all')
  const [activeAudio, setActiveAudio] = useState<ActiveAudio>('both')
  const [volumeA] = useState(1)
  const [volumeB] = useState(1)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisA, setAnalysisA] = useState<AudioAnalysisState>(createEmptyAudioAnalysisState)
  const [analysisB, setAnalysisB] = useState<AudioAnalysisState>(createEmptyAudioAnalysisState)
  const [targetPlatform, setTargetPlatform] = useState<keyof typeof LOUDNESS_TARGETS>('spotify')
  const [showSettings, setShowSettings] = useState(false)

  // Store state
  const { currentTime, isPlaying, playbackSpeed, seek, togglePlay } = usePlaybackStore()
  const { tracks } = useTimelineStore()
  const { getFile } = useMediaStore()

  const trackA = tracks.find((track) => track.type === 'a')
  const trackB = tracks.find((track) => track.type === 'b')
  const activeClipA = findActiveClip(trackA?.clips ?? [], currentTime)
  const activeClipB = findActiveClip(trackB?.clips ?? [], currentTime)
  const analysisClipA = activeClipA ?? trackA?.clips[0] ?? null
  const analysisClipB = activeClipB ?? trackB?.clips[0] ?? null
  const mediaA = analysisClipA ? getFile(analysisClipA.mediaId) : null
  const mediaB = analysisClipB ? getFile(analysisClipB.mediaId) : null

  const hasAudio = analysisA.buffer !== null || analysisB.buffer !== null

  const maxDuration = Math.max(
    analysisA.analysis?.duration || 0,
    analysisB.analysis?.duration || 0,
    1,
  )

  // Extract the primary embedded audio track through Mediabunny so this also works for
  // containers/codecs that the browser cannot play natively (for example ProRes MOV).
  const loadAudio = useCallback(
    async (mediaId: string, file: File, signal: AbortSignal): Promise<AudioAnalysisState> => {
      try {
        const buffer = await extractPrimaryAudioBuffer(file, signal)
        if (!buffer || signal.aborted) return createEmptyAudioAnalysisState()

        const analysis = await analyzeAudio(buffer)
        if (signal.aborted) return createEmptyAudioAnalysisState()

        return {
          mediaId,
          buffer,
          analysis,
          peaks: Array.from(analysis.waveformPeaks),
        }
      } catch (error) {
        if (!signal.aborted) {
          console.error('Failed to load embedded video audio:', error)
        }
        return createEmptyAudioAnalysisState()
      }
    },
    [],
  )

  const mediaAId = mediaA?.type === 'video' ? mediaA.id : undefined
  const mediaBId = mediaB?.type === 'video' ? mediaB.id : undefined
  const mediaAFile = mediaA?.type === 'video' ? mediaA.file : undefined
  const mediaBFile = mediaB?.type === 'video' ? mediaB.file : undefined

  const stopAudioSources = useCallback(() => {
    sourceRegistryRef.current.stopAll()
  }, [])

  const invalidateAudioPlayback = useCallback(() => {
    playbackRequestGateRef.current.invalidate()
    playingClipIdsRef.current = { a: null, b: null }
    stopAudioSources()
  }, [stopAudioSources])

  useEffect(() => {
    let cancelled = false
    const abortController = new AbortController()

    // Stop obsolete playback immediately. State resets happen after yielding once so
    // the effect does not synchronously cascade another render.
    invalidateAudioPlayback()

    const loadFiles = async () => {
      await Promise.resolve()
      if (cancelled) return

      setAnalysisA(createEmptyAudioAnalysisState())
      setAnalysisB(createEmptyAudioAnalysisState())

      if (!mediaAFile && !mediaBFile) {
        setIsAnalyzing(false)
        return
      }

      setIsAnalyzing(true)

      const nextA =
        mediaAId && mediaAFile
          ? await loadAudio(mediaAId, mediaAFile, abortController.signal)
          : createEmptyAudioAnalysisState()
      if (cancelled || abortController.signal.aborted) return
      setAnalysisA(nextA)

      const nextB =
        mediaBId && mediaBFile
          ? await loadAudio(mediaBId, mediaBFile, abortController.signal)
          : createEmptyAudioAnalysisState()
      if (cancelled || abortController.signal.aborted) return
      setAnalysisB(nextB)
      setIsAnalyzing(false)
    }

    void loadFiles()

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [invalidateAudioPlayback, loadAudio, mediaAFile, mediaAId, mediaBFile, mediaBId])

  const startAudioPlayback = useCallback(
    async (time: number) => {
      const requestGeneration = playbackRequestGateRef.current.begin()
      stopAudioSources()

      if (!analysisA.buffer && !analysisB.buffer) return

      const context = playbackContextRef.current ?? new AudioContext()
      playbackContextRef.current = context
      if (context.state === 'suspended') {
        try {
          await context.resume()
        } catch {
          return
        }
      }

      // resume() may wait for a user gesture. Do not let an obsolete request start
      // after pause, source replacement, unmount, or a newer start request.
      if (
        !playbackRequestGateRef.current.isCurrent(requestGeneration) ||
        !usePlaybackStore.getState().isPlaying
      ) {
        return
      }

      const clipA = findActiveClip(trackA?.clips ?? [], time)
      const clipB = findActiveClip(trackB?.clips ?? [], time)
      playingClipIdsRef.current = { a: clipA?.id ?? null, b: clipB?.id ?? null }

      const createSourceForClip = (
        state: AudioAnalysisState,
        clip: typeof clipA,
        volume: number,
      ) => {
        if (!state.buffer || !clip || state.mediaId !== clip.mediaId || clip.reverse) return null

        const mediaTime = calculateMediaTime(time, clip)
        if (mediaTime === null) return null

        const clipSpeed = clip.speed || 1
        const timelineRemaining = Math.max(0, clip.endTime - time)
        const sourceRemaining = Math.max(0, clip.outPoint - mediaTime)
        const sourceDuration = Math.min(sourceRemaining, timelineRemaining * clipSpeed)

        return createAudioPlaybackSource(
          context,
          state.buffer,
          playbackSpeed * clipSpeed,
          volume,
          mediaTime,
          sourceDuration,
        )
      }

      const sourceA = activeAudio !== 'b' ? createSourceForClip(analysisA, clipA, volumeA) : null
      const sourceB = activeAudio !== 'a' ? createSourceForClip(analysisB, clipB, volumeB) : null
      sourceRegistryRef.current.track(sourceA, sourceB)
    },
    [
      activeAudio,
      analysisA,
      analysisB,
      playbackSpeed,
      stopAudioSources,
      trackA,
      trackB,
      volumeA,
      volumeB,
    ],
  )

  useEffect(() => {
    if (isPlaying) {
      void startAudioPlayback(usePlaybackStore.getState().currentTime)
    } else {
      invalidateAudioPlayback()
    }
  }, [invalidateAudioPlayback, isPlaying, startAudioPlayback])

  useEffect(() => {
    const handleSeek = (event: CustomEvent<{ time: number }>) => {
      if (usePlaybackStore.getState().isPlaying) {
        void startAudioPlayback(event.detail.time)
      } else {
        invalidateAudioPlayback()
      }
    }

    window.addEventListener('playback-seek', handleSeek as EventListener)
    return () => window.removeEventListener('playback-seek', handleSeek as EventListener)
  }, [invalidateAudioPlayback, startAudioPlayback])

  useEffect(() => {
    const handlePlaybackUpdate = (event: CustomEvent<{ time: number; isPlaying: boolean }>) => {
      if (!event.detail.isPlaying) return

      const nextA = findActiveClip(trackA?.clips ?? [], event.detail.time)?.id ?? null
      const nextB = findActiveClip(trackB?.clips ?? [], event.detail.time)?.id ?? null
      const playing = playingClipIdsRef.current

      if (nextA !== playing.a || nextB !== playing.b) {
        void startAudioPlayback(event.detail.time)
      }
    }

    window.addEventListener('playback-update', handlePlaybackUpdate as EventListener)
    return () =>
      window.removeEventListener('playback-update', handlePlaybackUpdate as EventListener)
  }, [startAudioPlayback, trackA, trackB])

  useEffect(
    () => () => {
      invalidateAudioPlayback()
      void playbackContextRef.current?.close()
      playbackContextRef.current = null
    },
    [invalidateAudioPlayback],
  )

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return

      switch (e.key.toLowerCase()) {
        case 'a':
          setActiveAudio('a')
          break
        case 'b':
          setActiveAudio('b')
          break
        case 's':
          setActiveAudio('both')
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden">
      {/* Top toolbar */}
      <div className="h-12 bg-surface border-b border-border flex items-center justify-between px-4 shrink-0">
        {/* View mode selector */}
        <div className="flex items-center gap-1">
          {[
            { mode: 'all', icon: Grid3X3, label: 'All' },
            { mode: 'waveform', icon: Waves, label: 'Waveform' },
            { mode: 'loudness', icon: Volume2, label: 'Loudness' },
            { mode: 'goniometer', icon: Radio, label: 'Stereo' },
            { mode: 'spectrogram', icon: Activity, label: 'Analysis' },
          ].map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode as AudioViewMode)}
              className={cn(
                'px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors',
                viewMode === mode
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-hover',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Transport controls */}
        <div className="flex items-center gap-2">
          <button onClick={() => seek(0)} className="p-1.5 text-text-muted hover:text-text-primary">
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={togglePlay}
            className={cn(
              'w-8 h-8 flex items-center justify-center',
              isPlaying
                ? 'bg-accent text-white'
                : 'bg-surface-hover text-text-primary hover:bg-accent hover:text-white',
            )}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <span className="text-xs font-mono text-text-muted ml-2">
            {formatTime(currentTime)} / {formatTime(maxDuration)}
          </span>
        </div>

        {/* Output selector & settings */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-background border border-border">
            {(['a', 'both', 'b'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setActiveAudio(mode)}
                className={cn(
                  'px-3 py-1 text-xs font-medium transition-all',
                  activeAudio === mode
                    ? mode === 'a'
                      ? 'bg-accent text-white'
                      : mode === 'b'
                        ? 'bg-secondary text-black'
                        : 'bg-text-primary text-background'
                    : 'text-text-muted hover:text-text-primary',
                )}
              >
                {mode === 'both' ? 'A+B' : mode.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              'p-1.5 transition-colors',
              showSettings ? 'text-accent' : 'text-text-muted hover:text-text-primary',
            )}
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="bg-surface border-b border-border px-4 py-3 flex items-center gap-6 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Loudness reference:</span>
            <select
              value={targetPlatform}
              onChange={(e) => setTargetPlatform(e.target.value as keyof typeof LOUDNESS_TARGETS)}
              className="bg-surface-hover border border-border px-2 py-1 text-xs"
            >
              {(Object.keys(LOUDNESS_TARGETS) as Array<keyof typeof LOUDNESS_TARGETS>).map(
                (key) => (
                  <option key={key} value={key}>
                    {LOUDNESS_TARGET_LABELS[key]} ({LOUDNESS_TARGETS[key]} LUFS)
                  </option>
                ),
              )}
            </select>
          </div>
          <span className="text-text-muted">
            Integrated loudness and stereo metrics describe the decoded source file. Tail meters
            show the final 400 ms / 3 s of that source.
          </span>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        {isAnalyzing ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-text-muted">Analyzing audio...</span>
            </div>
          </div>
        ) : !hasAudio ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Disc className="w-16 h-16 text-text-muted/30" />
              <div className="text-center">
                <p className="text-sm font-medium text-text-secondary">No Embedded Audio</p>
                <p className="text-xs text-text-muted mt-1">
                  Neither current video has a decodable audio track
                </p>
              </div>
            </div>
          </div>
        ) : viewMode === 'all' ? (
          /* All views grid layout */
          <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-px bg-border">
            {/* Waveforms */}
            <div className="bg-background relative flex flex-col">
              <div className="absolute top-2 left-2 z-10 text-[10px] text-text-muted bg-black/50 px-1.5 py-0.5">
                WAVEFORM
              </div>
              <div className={cn('flex-1', activeAudio === 'b' && 'opacity-50')}>
                <WaveformCanvas
                  peaks={analysisA.peaks}
                  color="#ff5722"
                  currentTime={currentTime}
                  duration={maxDuration}
                  onSeek={seek}
                  label="A"
                  mediaName={mediaA?.name}
                />
              </div>
              <div className="h-px bg-border" />
              <div className={cn('flex-1', activeAudio === 'a' && 'opacity-50')}>
                <WaveformCanvas
                  peaks={analysisB.peaks}
                  color="#cddc39"
                  currentTime={currentTime}
                  duration={maxDuration}
                  onSeek={seek}
                  label="B"
                  mediaName={mediaB?.name}
                />
              </div>
            </div>

            {/* Analysis / Spectrogram placeholder */}
            <div className="bg-background relative">
              <div className="absolute top-2 left-2 z-10 text-[10px] text-text-muted bg-black/50 px-1.5 py-0.5">
                ANALYSIS
              </div>
              <SpectrogramCanvas
                analysisA={analysisA}
                analysisB={analysisB}
                currentTime={currentTime}
                duration={maxDuration}
              />
            </div>

            {/* Goniometer */}
            <div className="bg-background relative">
              <div className="absolute top-2 left-2 z-10 text-[10px] text-text-muted bg-black/50 px-1.5 py-0.5">
                STEREO FIELD
              </div>
              <GoniometerCanvas
                analysisA={analysisA}
                analysisB={analysisB}
                activeAudio={activeAudio}
              />
            </div>

            {/* Loudness meters */}
            <div className="bg-background p-2 overflow-auto">
              <div className="absolute top-2 left-2 z-10 text-[10px] text-text-muted bg-black/50 px-1.5 py-0.5">
                LOUDNESS
              </div>
              <div className="flex gap-2 h-full pt-6">
                <LoudnessMeter
                  label="Track A"
                  metrics={analysisA.analysis?.loudness || null}
                  color="#ff5722"
                  targetPlatform={targetPlatform}
                />
                <LoudnessMeter
                  label="Track B"
                  metrics={analysisB.analysis?.loudness || null}
                  color="#cddc39"
                  targetPlatform={targetPlatform}
                />
              </div>
            </div>
          </div>
        ) : viewMode === 'waveform' ? (
          <div className="w-full h-full flex flex-col">
            <div className={cn('flex-1 relative', activeAudio === 'b' && 'opacity-50')}>
              <WaveformCanvas
                peaks={analysisA.peaks}
                color="#ff5722"
                currentTime={currentTime}
                duration={maxDuration}
                onSeek={seek}
                label="A"
                mediaName={mediaA?.name}
              />
            </div>
            <div className="h-px bg-border" />
            <div className={cn('flex-1 relative', activeAudio === 'a' && 'opacity-50')}>
              <WaveformCanvas
                peaks={analysisB.peaks}
                color="#cddc39"
                currentTime={currentTime}
                duration={maxDuration}
                onSeek={seek}
                label="B"
                mediaName={mediaB?.name}
              />
            </div>
          </div>
        ) : viewMode === 'loudness' ? (
          <div className="w-full h-full flex p-4 gap-4">
            <LoudnessMeter
              label="Track A"
              metrics={analysisA.analysis?.loudness || null}
              color="#ff5722"
              targetPlatform={targetPlatform}
            />
            <LoudnessMeter
              label="Track B"
              metrics={analysisB.analysis?.loudness || null}
              color="#cddc39"
              targetPlatform={targetPlatform}
            />
          </div>
        ) : viewMode === 'goniometer' ? (
          <div className="w-full h-full flex">
            <div className="flex-1 relative">
              <GoniometerCanvas
                analysisA={analysisA}
                analysisB={analysisB}
                activeAudio={activeAudio}
              />
            </div>
            <div className="w-64 bg-surface border-l border-border p-3 space-y-3 overflow-auto">
              <PhaseCorrelation
                correlationA={analysisA.analysis?.stereo.correlation || 0}
                correlationB={analysisB.analysis?.stereo.correlation || 0}
                mode={activeAudio}
              />
              <StereoWidth
                widthA={analysisA.analysis?.stereo.width || 0}
                widthB={analysisB.analysis?.stereo.width || 0}
                mode={activeAudio}
              />
              <div className="bg-surface-alt p-3">
                <div className="text-xs text-text-muted mb-2">MID/SIDE</div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Mid Level:</span>
                    <span className="font-mono text-accent">
                      {formatDb(analysisA.analysis?.stereo.midLevel || -Infinity)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Side Level:</span>
                    <span className="font-mono text-accent">
                      {formatDb(analysisA.analysis?.stereo.sideLevel || -Infinity)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : viewMode === 'spectrogram' ? (
          <div className="w-full h-full relative">
            <SpectrogramCanvas
              analysisA={analysisA}
              analysisB={analysisB}
              currentTime={currentTime}
              duration={maxDuration}
            />
          </div>
        ) : null}
      </div>

      {/* Keyboard hints */}
      <div className="h-7 bg-surface border-t border-border flex items-center justify-center gap-4 text-[10px] text-text-muted shrink-0">
        <span>
          <kbd className="px-1 bg-background font-mono">A</kbd> Solo A
        </span>
        <span>
          <kbd className="px-1 bg-background font-mono">B</kbd> Solo B
        </span>
        <span>
          <kbd className="px-1 bg-background font-mono">S</kbd> Both
        </span>
        <span className="text-border">|</span>
        <span>
          <kbd className="px-1 bg-background font-mono">Space</kbd> Play/Pause
        </span>
      </div>
    </div>
  )
}
