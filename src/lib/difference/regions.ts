export interface NormalizedDifferenceRegion {
  x: number
  y: number
  width: number
  height: number
  pixelCount: number
}

interface PixelRegion {
  x: number
  y: number
  width: number
  height: number
  pixelCount: number
}

interface ExtractDifferenceRegionsOptions {
  minPixels: number
  mergeGap: number
  padding: number
  maxRegions: number
}

function isDifferencePixel(mask: Uint8ClampedArray, pixelIndex: number): boolean {
  return mask[pixelIndex * 4 + 3] > 0
}

function regionsAreNear(a: PixelRegion, b: PixelRegion, gap: number): boolean {
  const aRight = a.x + a.width
  const aBottom = a.y + a.height
  const bRight = b.x + b.width
  const bBottom = b.y + b.height

  return (
    a.x <= bRight + gap &&
    aRight + gap >= b.x &&
    a.y <= bBottom + gap &&
    aBottom + gap >= b.y
  )
}

function mergeRegionPair(a: PixelRegion, b: PixelRegion): PixelRegion {
  const left = Math.min(a.x, b.x)
  const top = Math.min(a.y, b.y)
  const right = Math.max(a.x + a.width, b.x + b.width)
  const bottom = Math.max(a.y + a.height, b.y + b.height)

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    pixelCount: a.pixelCount + b.pixelCount,
  }
}

export function mergeNearbyRegions(regions: PixelRegion[], gap: number): PixelRegion[] {
  const merged = regions.map((region) => ({ ...region }))
  let changed = true

  while (changed) {
    changed = false

    outer: for (let i = 0; i < merged.length; i += 1) {
      for (let j = i + 1; j < merged.length; j += 1) {
        if (!regionsAreNear(merged[i], merged[j], gap)) continue

        merged[i] = mergeRegionPair(merged[i], merged[j])
        merged.splice(j, 1)
        changed = true
        break outer
      }
    }
  }

  return merged
}

export function extractDifferenceRegions(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  options: ExtractDifferenceRegionsOptions,
): NormalizedDifferenceRegion[] {
  if (width <= 0 || height <= 0 || mask.length !== width * height * 4) return []

  const pixelTotal = width * height
  const visited = new Uint8Array(pixelTotal)
  const stack = new Int32Array(pixelTotal)
  const regions: PixelRegion[] = []

  for (let start = 0; start < pixelTotal; start += 1) {
    if (visited[start] || !isDifferencePixel(mask, start)) continue

    let stackLength = 0
    stack[stackLength] = start
    stackLength += 1
    visited[start] = 1

    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0
    let pixelCount = 0

    while (stackLength > 0) {
      stackLength -= 1
      const current = stack[stackLength]
      const y = Math.floor(current / width)
      const x = current - y * width

      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      pixelCount += 1

      const fromY = Math.max(0, y - 1)
      const toY = Math.min(height - 1, y + 1)
      const fromX = Math.max(0, x - 1)
      const toX = Math.min(width - 1, x + 1)

      for (let neighborY = fromY; neighborY <= toY; neighborY += 1) {
        for (let neighborX = fromX; neighborX <= toX; neighborX += 1) {
          const neighbor = neighborY * width + neighborX
          if (visited[neighbor] || !isDifferencePixel(mask, neighbor)) continue
          visited[neighbor] = 1
          stack[stackLength] = neighbor
          stackLength += 1
        }
      }
    }

    if (pixelCount >= options.minPixels) {
      regions.push({
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        pixelCount,
      })
    }
  }

  const candidateLimit = Math.max(options.maxRegions * 20, options.maxRegions)
  const limitedCandidates = regions
    .sort((a, b) => b.pixelCount - a.pixelCount)
    .slice(0, candidateLimit)
  const merged = mergeNearbyRegions(limitedCandidates, options.mergeGap)
    .sort((a, b) => b.pixelCount - a.pixelCount)
    .slice(0, options.maxRegions)

  return merged.map((region) => {
    const left = Math.max(0, region.x - options.padding)
    const top = Math.max(0, region.y - options.padding)
    const right = Math.min(width, region.x + region.width + options.padding)
    const bottom = Math.min(height, region.y + region.height + options.padding)

    return {
      x: left / width,
      y: top / height,
      width: (right - left) / width,
      height: (bottom - top) / height,
      pixelCount: region.pixelCount,
    }
  })
}
