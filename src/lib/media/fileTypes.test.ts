import { describe, expect, it } from 'vitest'

import { getSupportedMediaType, isSupportedMediaFile } from './fileTypes'

function mockFile(name: string, type = ''): File {
  return { name, type } as File
}

describe('supported media detection', () => {
  it('accepts video containers by extension when MIME is missing', () => {
    expect(getSupportedMediaType(mockFile('delivery.mov'))).toBe('video')
    expect(getSupportedMediaType(mockFile('delivery.qt'))).toBe('video')
  })

  it('accepts images by MIME or extension', () => {
    expect(getSupportedMediaType(mockFile('frame.bin', 'image/png'))).toBe('image')
    expect(getSupportedMediaType(mockFile('frame.webp'))).toBe('image')
  })

  it('rejects standalone audio and removed media formats', () => {
    expect(isSupportedMediaFile(mockFile('mix.wav', 'audio/wav'))).toBe(false)
    expect(isSupportedMediaFile(mockFile('scene.glb', 'model/gltf-binary'))).toBe(false)
    expect(isSupportedMediaFile(mockFile('notes.pdf', 'application/pdf'))).toBe(false)
  })
})
