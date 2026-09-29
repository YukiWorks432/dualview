/**
 * TL-006: Clip Waveform Preview
 * Renders a mini waveform visualization inside timeline clips
 */
import { useEffect, useRef } from 'react'

import { drawWaveform } from '../../lib/timeline/waveform'

interface ClipWaveformProps {
  peaks: number[]
  color?: string
  className?: string
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
