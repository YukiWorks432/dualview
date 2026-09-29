import { useCallback, useState } from 'react'

export interface ColorInfo {
  x: number
  y: number
  r: number
  g: number
  b: number
  hex: string
  hsl: { h: number; s: number; l: number }
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

export function useColorPicker() {
  const [colorA, setColorA] = useState<ColorInfo | null>(null)
  const [colorB, setColorB] = useState<ColorInfo | null>(null)

  const sampleColor = useCallback(
    (
      e: React.MouseEvent,
      source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | null,
      side: 'a' | 'b',
    ) => {
      if (!source) return

      const rect = (e.target as HTMLElement).getBoundingClientRect()
      const x = Math.round(e.clientX - rect.left)
      const y = Math.round(e.clientY - rect.top)

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      let sourceWidth: number
      let sourceHeight: number
      if (source instanceof HTMLVideoElement) {
        sourceWidth = source.videoWidth
        sourceHeight = source.videoHeight
      } else if (source instanceof HTMLImageElement) {
        sourceWidth = source.naturalWidth
        sourceHeight = source.naturalHeight
      } else {
        sourceWidth = source.width
        sourceHeight = source.height
      }

      canvas.width = sourceWidth
      canvas.height = sourceHeight
      ctx.drawImage(source, 0, 0)

      const scaleX = sourceWidth / rect.width
      const scaleY = sourceHeight / rect.height
      const sourceX = Math.round(x * scaleX)
      const sourceY = Math.round(y * scaleY)

      const pixel = ctx.getImageData(sourceX, sourceY, 1, 1).data
      const r = pixel[0]
      const g = pixel[1]
      const b = pixel[2]

      const hex =
        `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
      const hsl = rgbToHsl(r, g, b)
      const colorInfo: ColorInfo = { x: sourceX, y: sourceY, r, g, b, hex, hsl }

      if (side === 'a') {
        setColorA(colorInfo)
      } else {
        setColorB(colorInfo)
      }
    },
    [],
  )

  return { colorA, colorB, sampleColor, setColorA, setColorB }
}
