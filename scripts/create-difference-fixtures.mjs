import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
const output = resolve('tests/browser/fixtures')
mkdirSync(output, { recursive: true })
function video(
  name,
  { rate = 24, duration = 1, filter, prores = false, variable = false, colour = 'black' } = {},
) {
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=${colour}:s=96x64:r=${rate}:d=${duration}`,
  ]
  if (filter) args.push('-vf', filter)
  args.push('-an')
  if (variable) args.push('-fps_mode', 'vfr')
  args.push(
    ...(prores
      ? ['-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le']
      : ['-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p']),
  )
  args.push(resolve(output, name))
  const result = spawnSync('ffmpeg', args, { stdio: 'inherit' })
  if (result.error || result.status !== 0)
    throw result.error ?? new Error(`Fixture generation failed: ${name}`)
}
const changed = "drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='eq(n,7)+between(n,12,15)'"
video('base.mp4')
video('changed.mp4', { filter: changed })
video('base.mov', { prores: true })
video('changed.mov', { prores: true, filter: changed })
video('short.mp4', { duration: 0.5 })
video('partial.mp4', { filter: 'drawbox=x=0:y=0:w=24:h=16:color=white:t=fill' })
video('near-black.mp4', { colour: '0x050505' })
video('vfr.mp4', {
  rate: 48,
  variable: true,
  filter:
    "drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='eq(n,8)',select='not(eq(mod(n,3),1))'",
})
