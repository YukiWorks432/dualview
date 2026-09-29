import pixelmatch from 'pixelmatch'

function normalizeFullyTransparentRgb(data: Uint8ClampedArray): void {
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] !== 0) continue
    data[offset] = 0
    data[offset + 1] = 0
    data[offset + 2] = 0
  }
}

export function createDifferenceMask(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
): { mask: Uint8ClampedArray; diffPixelCount: number } {
  const expectedLength = width * height * 4
  if (a.length !== expectedLength || b.length !== expectedLength) {
    throw new Error('Difference inputs must match the requested analysis dimensions')
  }

  normalizeFullyTransparentRgb(a)
  normalizeFullyTransparentRgb(b)

  const mask = new Uint8ClampedArray(expectedLength)
  let diffPixelCount = pixelmatch(a, b, mask, width, height, {
    threshold,
    includeAA: true,
    diffMask: true,
    checkerboard: true,
  })

  for (let offset = 0; offset < expectedLength; offset += 4) {
    if (a[offset + 3] === b[offset + 3] || mask[offset + 3] !== 0) continue

    mask[offset] = 255
    mask[offset + 1] = 255
    mask[offset + 2] = 255
    mask[offset + 3] = 255
    diffPixelCount += 1
  }

  return { mask, diffPixelCount }
}
