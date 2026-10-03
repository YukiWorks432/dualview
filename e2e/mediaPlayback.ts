import path from 'node:path'

import { expect, type Page } from '@playwright/test'

export async function upload(page: Page, label: string, file: string) {
  const count = await page.locator('[data-clip]').count()
  const chooser = page.waitForEvent('filechooser')
  await page.getByText(label, { exact: true }).last().click()
  await (await chooser).setFiles(path.join(process.cwd(), 'e2e', 'fixtures', file))
  await expect(page.locator('[data-clip]')).toHaveCount(count + 1)
}

export async function seek(page: Page, time: number) {
  await page.evaluate(async (time) => {
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    usePlaybackStore.getState().seek(time)
  }, time)
}

export async function expectColor(page: Page, track: 'a' | 'b', color: 'red' | 'blue') {
  const source = page
    .locator(`${track === 'a' ? 'video' : 'canvas'}[data-track="${track}"]`)
    .first()
  await expect
    .poll(
      () =>
        source.evaluate(async (element: HTMLVideoElement | HTMLCanvasElement) => {
          const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
          const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
          const { calculateMediaTime, findActiveClip } = await import('/src/lib/media/timeline.ts')
          const time = usePlaybackStore.getState().currentTime
          const clips =
            useTimelineStore.getState().tracks.find((track) => track.type === element.dataset.track)
              ?.clips ?? []
          const clip = findActiveClip(clips, time)
          if (!clip) return null
          const target = calculateMediaTime(time, clip)
          if (target === null) return null
          if (element instanceof HTMLVideoElement) {
            // An initial decoded frame need not trigger another frame callback.
            // Inspect real pixels only at this clip's current requested position.
            if (
              Math.abs(element.currentTime - target) > 0.000001 ||
              element.dataset.frameSourceClipId !== clip.id
            )
              return null
          } else if (
            element.dataset.frameReady !== 'true' ||
            Number(element.dataset.frameRequestedMediaTime) !== target ||
            element.dataset.frameClipId !== clip.id ||
            element.dataset.frameSeekGeneration !== element.dataset.framePresentedGeneration
          )
            return null
          if (element instanceof HTMLVideoElement && (element.seeking || element.readyState < 2))
            return null
          const canvas = document.createElement('canvas')
          canvas.width = canvas.height = 64
          const context = canvas.getContext('2d')!
          context.drawImage(element, 0, 0, 64, 64)
          const [r, g, b] = context.getImageData(32, 32, 1, 1).data
          if (r > 220 && g < 30 && b < 30) return 'red'
          if (b > 220 && r < 30 && g < 30) return 'blue'
          return `${r},${g},${b}`
        }),
      { timeout: 15_000 },
    )
    .toBe(color)
}
