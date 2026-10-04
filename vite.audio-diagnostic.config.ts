import path from 'node:path'

import { defineConfig, mergeConfig, type Plugin } from 'vite'

import baseConfig from './vite.config'

// Opt-in, test-side export wrappers. Production files and function bodies stay unchanged.
// Observers return each original promise; no diagnostic hook is awaited by the application.
function audioObservers(): Plugin {
  const wrappers = new Map([
    [path.resolve('src/lib/audio/AudioAnalyzer.ts'), ['analyzeAudio']],
    [path.resolve('src/lib/media/audio.ts'), ['extractPrimaryAudioBuffer']],
  ])
  const prefix = '\0audio-diagnostic:'
  return {
    name: 'audio-diagnostic-observers',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (source.startsWith(prefix)) return source
      if (source.includes('?audio-diagnostic-original')) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (resolved && wrappers.has(resolved.id)) return prefix + resolved.id
      return null
    },
    load(id) {
      if (!id.startsWith(prefix)) return null
      const original = id.slice(prefix.length)
      const url = `/src/${path.relative(path.resolve('src'), original).replaceAll('\\', '/')}?audio-diagnostic-original`
      return [
        `import * as original from ${JSON.stringify(url)};`,
        `export * from ${JSON.stringify(url)};`,
        `import { observeCall } from '/e2e/diagnostics/observers.ts';`,
        ...wrappers
          .get(original)!
          .map(
            (name) =>
              `export function ${name}(...args) { return observeCall(${JSON.stringify(name)}, args, () => original.${name}(...args)); }`,
          ),
      ].join('\n')
    },
  }
}

export default defineConfig(mergeConfig(baseConfig, { plugins: [audioObservers()] }))
