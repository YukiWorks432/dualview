/**
 * TL-006: Clip Waveform Preview
 * Renders a mini waveform visualization inside timeline clips
 */
import { useRef, useEffect } from 'react'

interface ClipWaveformProps {
  peaks: number[]
  color?: string
  className?: string
}

function resolveCanvasColor(canvas: HTMLCanvasElement, fallbackColor: string) {
  if (typeof window === 'undefined') return fallbackColor

  return window.getComputedStyle(canvas).color || fallbackColor
}

export function drawWaveform(canvas: HTMLCanvasElement, peaks: number[], color: string) {
  if (!peaks.length) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Set canvas size to match element size
  const rect = canvas.getBoundingClientRect()
  const devicePixelRatio = window.devicePixelRatio || 1
  canvas.width = rect.width * devicePixelRatio
  canvas.height = rect.height * devicePixelRatio
  ctx.scale(devicePixelRatio, devicePixelRatio)

  const width = rect.width
  const height = rect.height

  // Clear canvas
  ctx.clearRect(0, 0, width, height)

  // Draw waveform
  const barWidth = width / peaks.length
  const centerY = height / 2

  // Canvas does not resolve CSS variables in fillStyle, so use the computed CSS color.
  ctx.fillStyle = resolveCanvasColor(canvas, color)

  for (let i = 0; i < peaks.length; i++) {
    const barHeight = peaks[i] * centerY * 0.9
    const x = i * barWidth
    const y = centerY - barHeight

    // Draw bar above and below center
    ctx.fillRect(x, y, Math.max(barWidth - 0.5, 0.5), barHeight * 2)
  }

  // Draw center line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(0, centerY)
  ctx.lineTo(width, centerY)
  ctx.stroke()
}

export function ClipWaveform({
  peaks,
  color = 'rgba(255, 255, 255, 0.6)',
  className = '',
}: ClipWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    drawWaveform(canvas, peaks, color)
  }, [peaks, color])

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const observer = new ResizeObserver(() => {
      drawWaveform(canvas, peaks, color)
    })

    observer.observe(canvas)
    return () => observer.disconnect()
  }, [peaks, color])

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ display: 'block', color }}
    />
  )
}
