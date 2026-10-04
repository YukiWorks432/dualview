/**
 * Screenshot and PDF Export utilities
 */

export interface ScreenshotOptions {
  format: 'png' | 'jpg'
  quality: number // 0-1 for jpg
  includeAnnotations: boolean
  includeUI: boolean
}

export interface PDFExportOptions {
  title: string
  includeMetadata: boolean
  includeAnnotations: boolean
  includeSettings: boolean
}

/**
 * Capture the current comparison view as an image
 */
export async function captureScreenshot(
  element: HTMLElement,
  options: ScreenshotOptions,
): Promise<Blob> {
  // Use html2canvas-style approach with native canvas
  const rect = element.getBoundingClientRect()
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Failed to create canvas context')
  }

  // Set canvas size with device pixel ratio for sharpness
  const dpr = window.devicePixelRatio || 1
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)

  // Try to use the experimental drawWindow or fallback
  // For now, we'll capture video/image elements directly
  const videos = element.querySelectorAll('video')
  const images = element.querySelectorAll('img')
  const canvases = element.querySelectorAll('canvas')

  // Fill background
  ctx.fillStyle = '#0d0d0d'
  ctx.fillRect(0, 0, rect.width, rect.height)

  // Draw each media element
  const drawMedia = (media: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) => {
    const mediaRect = media.getBoundingClientRect()
    const x = mediaRect.left - rect.left
    const y = mediaRect.top - rect.top

    try {
      ctx.drawImage(media, x, y, mediaRect.width, mediaRect.height)
    } catch (e) {
      console.warn('Failed to draw media element:', e)
    }
  }

  videos.forEach((v) => drawMedia(v))
  images.forEach((i) => drawMedia(i))
  canvases.forEach((c) => drawMedia(c))

  // Convert to blob
  return new Promise((resolve, reject) => {
    const mimeType = options.format === 'png' ? 'image/png' : 'image/jpeg'
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to create blob'))
        }
      },
      mimeType,
      options.format === 'jpg' ? options.quality : undefined,
    )
  })
}

/**
 * Simple screenshot using canvas capture
 */
export async function captureCanvasScreenshot(
  canvas: HTMLCanvasElement | null,
  format: 'png' | 'jpg' = 'png',
): Promise<Blob | null> {
  if (!canvas) return null

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), format === 'png' ? 'image/png' : 'image/jpeg', 0.95)
  })
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * WEBGL-010: WebGL Analysis Metrics type for PDF report
 */
export interface WebGLPDFMetrics {
  ssim: number
  deltaE: number
  diffPixelPercent: number
  peakDifference: number
  meanDifference: number
  passPixelCount: number
  failPixelCount: number
  totalPixelCount: number
}

/**
 * Generate a PDF report
 * WEBGL-010: Enhanced with WebGL analysis metrics
 */
export async function generatePDFReport(
  options: PDFExportOptions & {
    screenshotBlob: Blob
    mediaA?: { name: string; type: string; size: string; dimensions?: string }
    mediaB?: { name: string; type: string; size: string; dimensions?: string }
    comparisonMode: string
    annotations?: string[]
    metrics?: { ssim?: number; psnr?: number }
    webglMetrics?: WebGLPDFMetrics // WEBGL-010
    webglMode?: string // WEBGL-010
    threshold?: number // WEBGL-010
  },
): Promise<Blob> {
  // Create a simple HTML-based PDF
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15

  const contentWidth = pageWidth - margin * 2
  const contentBottom = pageHeight - margin
  let yPos = margin + 7

  const ensureSpace = (height: number) => {
    if (yPos + height > contentBottom) {
      doc.addPage()
      yPos = margin + 7
    }
  }
  const writeText = (text: string, size = 10, bold = false) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    const lineHeight = (size * 1.4) / doc.internal.scaleFactor
    const lines: string[] = doc.splitTextToSize(text, contentWidth)
    for (const line of lines) {
      ensureSpace(lineHeight)
      doc.text(line, margin, yPos)
      yPos += lineHeight
    }
  }
  const heading = (text: string) => {
    yPos += 5
    // 見出しだけが前のページ末尾に残らないよう、本文1行分も確保する。
    ensureSpace(12)
    writeText(text, 12, true)
  }

  writeText(options.title || 'DualView Comparison Report', 20, true)
  writeText(`Generated: ${new Date().toLocaleString()}`)
  yPos += 7

  try {
    const imgData = await blobToBase64(options.screenshotBlob)
    const image = doc.getImageProperties(imgData)
    const scale = Math.min(contentWidth / image.width, (contentBottom - margin - 7) / image.height)
    const imgWidth = image.width * scale
    const imgHeight = image.height * scale
    ensureSpace(imgHeight)
    doc.addImage(imgData, 'PNG', margin + (contentWidth - imgWidth) / 2, yPos, imgWidth, imgHeight)
    yPos += imgHeight + 5
  } catch (e) {
    console.error('Failed to add screenshot to PDF:', e)
  }

  if (options.includeSettings) {
    heading('Comparison Settings')
    writeText(`Mode: ${options.comparisonMode}`)
    if (options.webglMode) writeText(`Analysis Mode: ${options.webglMode}`)
    if (options.threshold !== undefined)
      writeText(`Threshold: ${(options.threshold * 100).toFixed(0)}%`)
    if (options.metrics?.ssim !== undefined) writeText(`SSIM: ${options.metrics.ssim.toFixed(4)}`)
    if (options.metrics?.psnr !== undefined)
      writeText(`PSNR: ${options.metrics.psnr.toFixed(2)} dB`)
  }

  if (options.webglMetrics) {
    heading('WebGL Analysis Metrics')
    const metrics = options.webglMetrics
    const ssimQuality =
      metrics.ssim > 0.95
        ? 'Excellent'
        : metrics.ssim > 0.8
          ? 'Good'
          : metrics.ssim > 0.5
            ? 'Fair'
            : 'Poor'
    writeText(`Structural Similarity (SSIM): ${metrics.ssim.toFixed(4)} (${ssimQuality})`)
    const deltaEInterpretation =
      metrics.deltaE < 1
        ? 'Imperceptible'
        : metrics.deltaE < 2
          ? 'Barely perceptible'
          : metrics.deltaE < 5
            ? 'Noticeable'
            : 'Obvious'
    writeText(
      `Perceptual Difference (Delta E CIE94): ${metrics.deltaE.toFixed(2)} (${deltaEInterpretation})`,
    )
    writeText(
      `Different Pixels: ${metrics.diffPixelPercent.toFixed(1)}% (${metrics.failPixelCount.toLocaleString()} of ${metrics.totalPixelCount.toLocaleString()})`,
    )
    writeText(`Peak Pixel Difference: ${metrics.peakDifference.toFixed(0)} / 255`)
    writeText(`Mean Pixel Difference: ${metrics.meanDifference.toFixed(2)} / 255`)
    const passRate = ((metrics.passPixelCount / metrics.totalPixelCount) * 100).toFixed(1)
    writeText(
      `Threshold Pass Rate: ${passRate}% (${metrics.passPixelCount.toLocaleString()} pixels)`,
    )
  }

  if (options.includeMetadata) {
    heading('Media Information')
    for (const [track, media] of [
      ['A', options.mediaA],
      ['B', options.mediaB],
    ] as const) {
      if (!media) continue
      writeText(`Track ${track}: ${media.name}`)
      writeText(`  Type: ${media.type}, Size: ${media.size}`)
      if (media.dimensions) writeText(`  Dimensions: ${media.dimensions}`)
      yPos += 3
    }
  }

  if (options.includeAnnotations && options.annotations?.length) {
    heading('Notes')
    for (const note of options.annotations) writeText(`• ${note}`)
  }

  // 本文の改ページが完了してから、すべてのページにフッターを置く。
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(128)
    doc.text(
      'Generated with DualView - github.com/gokayfem/dualview',
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' },
    )
  }

  return doc.output('blob')
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
