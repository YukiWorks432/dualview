import { afterEach, describe, expect, it, vi } from 'vitest'

import { generatePDFReport } from './screenshotExport'

type TextMark = { page: number; text: string; x: number; y: number; width: number; height: number }
type ImageMark = { x: number; y: number; width: number; height: number }
const output = vi.hoisted(() => ({ texts: [] as TextMark[], images: [] as ImageMark[] }))

// 実際のjsPDFに渡した描画範囲を観測する。改ページ位置や行数は固定しない。
vi.mock('jspdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jspdf')>()
  return {
    ...actual,
    jsPDF: class extends actual.jsPDF {
      constructor(options: ConstructorParameters<typeof actual.jsPDF>[0]) {
        super(options)
        const text = this.text.bind(this)
        this.text = ((value: string | string[], x: number, y: number, ...args: unknown[]) => {
          const lines = typeof value === 'string' ? [value] : value
          const dimensions = this.getTextDimensions(lines.join('\n'))
          output.texts.push({
            page: this.getCurrentPageInfo().pageNumber,
            text: lines.join('\n'),
            x,
            y,
            width: dimensions.w,
            height: dimensions.h,
          })
          return Reflect.apply(text, this, [value, x, y, ...args])
        }) as typeof this.text
        const addImage = this.addImage.bind(this)
        this.addImage = ((
          data: string,
          format: string,
          x: number,
          y: number,
          width: number,
          height: number,
        ) => {
          output.images.push({ x, y, width, height })
          return addImage(data, format, x, y, width, height)
        }) as typeof this.addImage
      }
    },
  }
})

const landscape =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAFUlEQVR4nGP8z0AaYCJR/agG2mgAAMeRARHH28OHAAAAAElFTkSuQmCC'
const portrait =
  'iVBORw0KGgoAAAANSUhEUgAAAAkAAAAQCAIAAABLKsIUAAAAFElEQVR4nGP8z4ATMOGWGpUbJHIA2xABHwYm7PIAAAAASUVORK5CYII='

function options(image = landscape) {
  vi.stubGlobal(
    'FileReader',
    class {
      result = ''
      onload?: () => void
      async readAsDataURL(blob: Blob) {
        this.result = `data:image/png;base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`
        this.onload?.()
      }
    },
  )
  return {
    title: 'Comparison report',
    includeMetadata: true,
    includeSettings: true,
    includeAnnotations: true,
    comparisonMode: 'slider',
    screenshotBlob: new Blob([Buffer.from(image, 'base64')], { type: 'image/png' }),
    mediaA: { name: 'Original.mov', type: 'video', size: '1 MB', dimensions: '64 x 64' },
    mediaB: { name: 'Revised.mov', type: 'video', size: '2 MB', dimensions: '64 x 64' },
  }
}

function expectInsidePages() {
  const body = output.texts.filter((mark) => !mark.text.startsWith('Generated with DualView'))
  for (const mark of body) {
    expect(mark.x).toBeGreaterThanOrEqual(0)
    expect(mark.x + mark.width).toBeLessThanOrEqual(297.1)
    expect(mark.y - mark.height).toBeGreaterThanOrEqual(0)
    // 本文はフッターより上に置く。ページ下端に存在するだけでは不十分。
    const footer = output.texts.find(
      (item) => item.page === mark.page && item.text.startsWith('Generated with DualView'),
    )
    expect(footer).toBeDefined()
    expect(mark.y).toBeLessThan(footer!.y - footer!.height)
  }
  for (const image of output.images) {
    expect(image.width).toBeGreaterThan(0)
    expect(image.height).toBeGreaterThan(0)
    expect(image.x).toBeGreaterThanOrEqual(0)
    expect(image.y).toBeGreaterThanOrEqual(0)
    expect(image.x + image.width).toBeLessThanOrEqual(297.1)
    expect(image.y + image.height).toBeLessThan(200)
  }
  return body
}

afterEach(() => {
  output.texts.length = 0
  output.images.length = 0
  vi.unstubAllGlobals()
})

describe('PDF報告書の可視内容', () => {
  it('既定の設定・両素材情報をページ内に残し、フッターと重ねない', async () => {
    const blob = await generatePDFReport(options())
    expect((await blob.text()).startsWith('%PDF-')).toBe(true)
    const body = expectInsidePages()
      .map((mark) => mark.text)
      .join('\n')
    expect(body).toContain('Track A: Original.mov')
    expect(body).toContain('Track B: Revised.mov')
    expect(body).toContain('Mode: slider')
  })
  it('長い名前・指標・複数の注釈を折り返し、最後の注釈まで描画する', async () => {
    const input = options()
    input.title = 'A long report title '.repeat(200)
    input.mediaA.name = 'a'.repeat(300) + '.mov'
    const annotations = Array.from(
      { length: 70 },
      (_, index) => `Note ${index}: ${'Detail '.repeat(30)}`,
    )
    annotations.push('FINAL_ANNOTATION')
    await generatePDFReport({
      ...input,
      annotations,
      webglMode: 'difference',
      threshold: 0.1,
      metrics: { ssim: 0.9, psnr: 30 },
      webglMetrics: {
        ssim: 0.9,
        deltaE: 2,
        diffPixelPercent: 50,
        peakDifference: 255,
        meanDifference: 10,
        passPixelCount: 50,
        failPixelCount: 50,
        totalPixelCount: 100,
      },
    })
    const marks = expectInsidePages()
    const content = marks
      .map((mark) => mark.text)
      .join('')
      .replaceAll('\n', '')
    expect(content).toContain(input.mediaA.name)
    expect(content).toContain('FINAL_ANNOTATION')
    expect(content).toContain('Structural Similarity')
    expect(new Set(marks.map((mark) => mark.page)).size).toBeGreaterThan(1)
  })
  it.each([
    [landscape, 16 / 9],
    [portrait, 9 / 16],
  ] as const)('画像の実縦横比を保持する %#', async (image, ratio) => {
    await generatePDFReport(options(image))
    expectInsidePages()
    expect(output.images).toHaveLength(1)
    expect(output.images[0].width / output.images[0].height).toBeCloseTo(ratio, 5)
  })
})
