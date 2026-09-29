import pixelmatch from 'pixelmatch'

/** Reusable buffers keep memory proportional to one comparison, not video duration. */
export class PixelComparator {
  private readonly width: number
  private readonly height: number
  private readonly a: Uint8ClampedArray
  private readonly b: Uint8ClampedArray
  private readonly mask: Uint8ClampedArray
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    const size = width * height * 4
    this.a = new Uint8ClampedArray(size)
    this.b = new Uint8ClampedArray(size)
    this.mask = new Uint8ClampedArray(size)
  }
  compare(a: Uint8ClampedArray, b: Uint8ClampedArray, threshold: number): number {
    if (a.length !== this.a.length || b.length !== this.b.length)
      throw new Error('Comparison buffers must have identical dimensions')
    // Compare the visible colour over black. Hidden RGB under zero alpha is irrelevant.
    for (let index = 0; index < a.length; index += 4) {
      for (let channel = 0; channel < 3; channel++) {
        this.a[index + channel] = Math.round((a[index + channel] * a[index + 3]) / 255)
        this.b[index + channel] = Math.round((b[index + channel] * b[index + 3]) / 255)
      }
      this.a[index + 3] = 255
      this.b[index + 3] = 255
    }
    this.mask.fill(0)
    let changed = pixelmatch(this.a, this.b, this.mask, this.width, this.height, {
      threshold,
      includeAA: true,
      diffMask: true,
    })
    // Count the UNION of visible-colour and alpha changes, never the sum of both counts.
    for (let index = 3; index < a.length; index += 4) {
      if (Math.abs(a[index] - b[index]) > threshold * 255 && this.mask[index] === 0) changed++
    }
    return changed / (this.width * this.height)
  }
}
