const VIDEO_EXTENSIONS = new Set(['mov', 'qt', 'mp4', 'm4v', 'webm', 'mkv'])

export function getFileExtension(name: string): string {
  return name.toLowerCase().split('.').pop() || ''
}

export function isLikelyVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || VIDEO_EXTENSIONS.has(getFileExtension(file.name))
}
