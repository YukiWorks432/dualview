export function calculateAverageRgbaDifference(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  offset: number,
): number {
  const red = Math.abs(a[offset] - b[offset])
  const green = Math.abs(a[offset + 1] - b[offset + 1])
  const blue = Math.abs(a[offset + 2] - b[offset + 2])
  const alpha = Math.abs(a[offset + 3] - b[offset + 3])

  return (red + green + blue + alpha) / 4
}
