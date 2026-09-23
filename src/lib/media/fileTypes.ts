const VIDEO_EXTENSIONS = new Set(['mov', 'qt', 'mp4', 'm4v', 'webm', 'mkv'])
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp'])

export const SUPPORTED_MEDIA_ACCEPT = 'video/*,.mov,.qt,.mp4,.m4v,.webm,.mkv,image/*'
export type SupportedMediaType = 'video' | 'image'

export function getFileExtension(name: string): string {
  return name.toLowerCase().split('.').pop() || ''
}

export function isLikelyVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || VIDEO_EXTENSIONS.has(getFileExtension(file.name))
}

export function isLikelyImageFile(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_EXTENSIONS.has(getFileExtension(file.name))
}

export function getSupportedMediaType(file: File): SupportedMediaType | null {
  if (isLikelyVideoFile(file)) return 'video'
  if (isLikelyImageFile(file)) return 'image'
  return null
}

export function isSupportedMediaFile(file: File): boolean {
  return getSupportedMediaType(file) !== null
}
