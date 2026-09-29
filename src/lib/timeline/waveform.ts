function resolveCanvasColor(canvas: HTMLCanvasElement, fallbackColor: string) {
  if (typeof window === 'undefined') return fallbackColor

  return window.getComputedStyle(canvas).color || fallbackColor
}

export function drawWaveform(canvas: HTMLCanvasElement, peaks: number[], color: string) {
  if (!peaks.length) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const rect = canvas.getBoundingClientRect()
  const devicePixelRatio = window.devicePixelRatio || 1
  canvas.width = rect.width * devicePixelRatio
  canvas.height = rect.height * devicePixelRatio
  ctx.scale(devicePixelRatio, devicePixelRatio)

  const width = rect.width
  const height = rect.height
  ctx.clearRect(0, 0, width, height)

  const barWidth = width / peaks.length
  const centerY = height / 2
  ctx.fillStyle = resolveCanvasColor(canvas, color)

  for (let i = 0; i < peaks.length; i++) {
    const barHeight = peaks[i] * centerY * 0.9
    const x = i * barWidth
    const y = centerY - barHeight
    ctx.fillRect(x, y, Math.max(barWidth - 0.5, 0.5), barHeight * 2)
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(0, centerY)
  ctx.lineTo(width, centerY)
  ctx.stroke()
}
