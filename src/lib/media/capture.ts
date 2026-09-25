import {
  getVisualFrameDimensions,
  isVisualFrameReady,
  type VisualFrameElement,
} from './frameSource'

export interface CaptureRect {
  left: number
  top: number
  width: number
  height: number
}

export interface SourceCrop {
  sx: number
  sy: number
  sw: number
  sh: number
}

function right(rect: CaptureRect): number {
  return rect.left + rect.width
}

function bottom(rect: CaptureRect): number {
  return rect.top + rect.height
}

export function intersectCaptureRects(a: CaptureRect, b: CaptureRect): CaptureRect | null {
  const left = Math.max(a.left, b.left)
  const top = Math.max(a.top, b.top)
  const nextRight = Math.min(right(a), right(b))
  const nextBottom = Math.min(bottom(a), bottom(b))

  if (nextRight <= left || nextBottom <= top) return null

  return {
    left,
    top,
    width: nextRight - left,
    height: nextBottom - top,
  }
}

export function calculateObjectContainRect(
  box: CaptureRect,
  sourceWidth: number,
  sourceHeight: number,
): CaptureRect {
  if (sourceWidth <= 0 || sourceHeight <= 0 || box.width <= 0 || box.height <= 0) {
    return { ...box, width: 0, height: 0 }
  }

  const scale = Math.min(box.width / sourceWidth, box.height / sourceHeight)
  const width = sourceWidth * scale
  const height = sourceHeight * scale

  return {
    left: box.left + (box.width - width) / 2,
    top: box.top + (box.height - height) / 2,
    width,
    height,
  }
}

export function calculateSourceCrop(
  contentRect: CaptureRect,
  visibleRect: CaptureRect,
  sourceWidth: number,
  sourceHeight: number,
): SourceCrop {
  const scaleX = sourceWidth / contentRect.width
  const scaleY = sourceHeight / contentRect.height

  return {
    sx: (visibleRect.left - contentRect.left) * scaleX,
    sy: (visibleRect.top - contentRect.top) * scaleY,
    sw: visibleRect.width * scaleX,
    sh: visibleRect.height * scaleY,
  }
}

function toCaptureRect(rect: DOMRect): CaptureRect {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

function isOverflowClipping(value: string): boolean {
  return value !== 'visible'
}

function getElementOpacity(element: Element, container: HTMLElement): number | null {
  let opacity = 1
  let current: Element | null = element

  while (current) {
    const style = getComputedStyle(current)
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.visibility === 'collapse'
    ) {
      return null
    }

    const currentOpacity = Number(style.opacity)
    if (Number.isFinite(currentOpacity)) {
      opacity *= currentOpacity
    }
    if (opacity <= 0) return null
    if (current === container) break
    current = current.parentElement
  }

  return opacity
}

function clipToAncestors(
  element: Element,
  contentRect: CaptureRect,
  container: HTMLElement,
): CaptureRect | null {
  let visibleRect: CaptureRect | null = intersectCaptureRects(
    contentRect,
    toCaptureRect(container.getBoundingClientRect()),
  )
  let ancestor = element.parentElement

  while (visibleRect && ancestor && ancestor !== container) {
    const style = getComputedStyle(ancestor)
    const ancestorRect = toCaptureRect(ancestor.getBoundingClientRect())

    let left = visibleRect.left
    let top = visibleRect.top
    let nextRight = right(visibleRect)
    let nextBottom = bottom(visibleRect)

    if (isOverflowClipping(style.overflowX)) {
      left = Math.max(left, ancestorRect.left)
      nextRight = Math.min(nextRight, right(ancestorRect))
    }
    if (isOverflowClipping(style.overflowY)) {
      top = Math.max(top, ancestorRect.top)
      nextBottom = Math.min(nextBottom, bottom(ancestorRect))
    }

    visibleRect =
      nextRight > left && nextBottom > top
        ? { left, top, width: nextRight - left, height: nextBottom - top }
        : null

    ancestor = ancestor.parentElement
  }

  return visibleRect
}

export function captureVisualContainer(
  container: HTMLElement,
  outputCanvas: HTMLCanvasElement,
): HTMLCanvasElement {
  const context = outputCanvas.getContext('2d')
  if (!context) return outputCanvas

  const containerRect = toCaptureRect(container.getBoundingClientRect())
  if (containerRect.width <= 0 || containerRect.height <= 0) return outputCanvas

  const scaleX = outputCanvas.width / containerRect.width
  const scaleY = outputCanvas.height / containerRect.height

  context.clearRect(0, 0, outputCanvas.width, outputCanvas.height)
  context.fillStyle = '#0d0d0d'
  context.fillRect(0, 0, outputCanvas.width, outputCanvas.height)

  const surfaces = Array.from(container.querySelectorAll<VisualFrameElement>('video, img, canvas'))

  for (const surface of surfaces) {
    if (!isVisualFrameReady(surface)) continue

    const opacity = getElementOpacity(surface, container)
    if (opacity === null) continue

    const elementRect = toCaptureRect(surface.getBoundingClientRect())
    if (elementRect.width <= 0 || elementRect.height <= 0) continue

    const { width: sourceWidth, height: sourceHeight } = getVisualFrameDimensions(surface)
    if (sourceWidth <= 0 || sourceHeight <= 0) continue

    const objectFit = getComputedStyle(surface).objectFit
    const contentRect =
      objectFit === 'contain'
        ? calculateObjectContainRect(elementRect, sourceWidth, sourceHeight)
        : elementRect
    if (contentRect.width <= 0 || contentRect.height <= 0) continue

    const visibleRect = clipToAncestors(surface, contentRect, container)
    if (!visibleRect) continue

    const crop = calculateSourceCrop(contentRect, visibleRect, sourceWidth, sourceHeight)
    const dx = (visibleRect.left - containerRect.left) * scaleX
    const dy = (visibleRect.top - containerRect.top) * scaleY
    const dw = visibleRect.width * scaleX
    const dh = visibleRect.height * scaleY

    try {
      context.save()
      context.globalAlpha = opacity
      context.drawImage(surface, crop.sx, crop.sy, crop.sw, crop.sh, dx, dy, dw, dh)
      context.restore()
    } catch (error) {
      context.restore()
      console.warn('Failed to capture visual surface:', error)
    }
  }

  return outputCanvas
}
