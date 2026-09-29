import { EASE_PRESETS } from './easeCurve'
import type { ClipTransition } from '../../types'

// Transition effect definition
export interface TransitionEffect {
  id: string
  name: string
  category: 'basic' | 'wipe' | 'geometric' | 'dissolve' | 'blur' | 'color' | 'distortion'
  fragmentShader: string
}

// Default transition
export const DEFAULT_TRANSITION: ClipTransition = {
  effectId: 'dissolve',
  duration: 0.5,
  easeCurve: EASE_PRESETS[4], // ease-in-out
}

// Common uniforms and functions for transitions
const TRANSITION_COMMON = `
precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_textureFrom;
uniform sampler2D u_textureTo;
uniform float u_progress;
uniform vec2 u_resolution;

// Noise functions
float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

// Smooth step
float smootherstep(float edge0, float edge1, float x) {
  x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}
`

// Built-in transition effects
export const TRANSITION_EFFECTS: TransitionEffect[] = [
  // Basic
  {
    id: 'cut',
    name: 'Cut',
    category: 'basic',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        gl_FragColor = u_progress < 0.5 ? colorFrom : colorTo;
      }
    `,
  },
  {
    id: 'dissolve',
    name: 'Dissolve',
    category: 'dissolve',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        gl_FragColor = mix(colorFrom, colorTo, u_progress);
      }
    `,
  },

  // Wipes
  {
    id: 'wipe-left',
    name: 'Wipe Left',
    category: 'wipe',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        float edge = u_progress;
        gl_FragColor = v_texCoord.x < edge ? colorTo : colorFrom;
      }
    `,
  },
  {
    id: 'wipe-right',
    name: 'Wipe Right',
    category: 'wipe',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        float edge = 1.0 - u_progress;
        gl_FragColor = v_texCoord.x > edge ? colorTo : colorFrom;
      }
    `,
  },
  {
    id: 'wipe-up',
    name: 'Wipe Up',
    category: 'wipe',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        float edge = 1.0 - u_progress;
        gl_FragColor = v_texCoord.y > edge ? colorTo : colorFrom;
      }
    `,
  },
  {
    id: 'wipe-down',
    name: 'Wipe Down',
    category: 'wipe',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        float edge = u_progress;
        gl_FragColor = v_texCoord.y < edge ? colorTo : colorFrom;
      }
    `,
  },
  {
    id: 'wipe-diagonal',
    name: 'Wipe Diagonal',
    category: 'wipe',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        float diag = (v_texCoord.x + v_texCoord.y) * 0.5;
        gl_FragColor = diag < u_progress ? colorTo : colorFrom;
      }
    `,
  },

  // Geometric
  {
    id: 'circle-expand',
    name: 'Circle Expand',
    category: 'geometric',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        vec2 center = vec2(0.5, 0.5);
        float dist = distance(v_texCoord, center);
        float radius = u_progress * 1.5;
        gl_FragColor = dist < radius ? colorTo : colorFrom;
      }
    `,
  },
  {
    id: 'circle-contract',
    name: 'Circle Contract',
    category: 'geometric',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        vec2 center = vec2(0.5, 0.5);
        float dist = distance(v_texCoord, center);
        float radius = (1.0 - u_progress) * 1.5;
        gl_FragColor = dist > radius ? colorTo : colorFrom;
      }
    `,
  },
  {
    id: 'rectangle-expand',
    name: 'Rectangle Expand',
    category: 'geometric',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        vec2 center = vec2(0.5, 0.5);
        vec2 d = abs(v_texCoord - center);
        float dist = max(d.x, d.y);
        float radius = u_progress * 0.8;
        gl_FragColor = dist < radius ? colorTo : colorFrom;
      }
    `,
  },
  {
    id: 'blinds-h',
    name: 'Blinds Horizontal',
    category: 'geometric',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        float blinds = 8.0;
        float y = fract(v_texCoord.y * blinds);
        gl_FragColor = y < u_progress ? colorTo : colorFrom;
      }
    `,
  },
  {
    id: 'blinds-v',
    name: 'Blinds Vertical',
    category: 'geometric',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        float blinds = 8.0;
        float x = fract(v_texCoord.x * blinds);
        gl_FragColor = x < u_progress ? colorTo : colorFrom;
      }
    `,
  },
  {
    id: 'checkerboard',
    name: 'Checkerboard',
    category: 'geometric',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        float size = 8.0;
        float cx = floor(v_texCoord.x * size);
        float cy = floor(v_texCoord.y * size);
        float isOdd = mod(cx + cy, 2.0);
        float threshold = isOdd > 0.5 ? u_progress * 2.0 : u_progress * 2.0 - 1.0;
        gl_FragColor = threshold > 0.0 ? colorTo : colorFrom;
      }
    `,
  },

  // Dissolve variations
  {
    id: 'dissolve-noise',
    name: 'Dissolve Noise',
    category: 'dissolve',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        float noise = rand(v_texCoord);
        float t = smoothstep(0.0, 1.0, u_progress);
        gl_FragColor = noise < t ? colorTo : colorFrom;
      }
    `,
  },
  {
    id: 'pixelate',
    name: 'Pixelate',
    category: 'dissolve',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        float pixelSize = mix(1.0, 40.0, sin(u_progress * 3.14159));
        vec2 pixelCoord = floor(v_texCoord * u_resolution / pixelSize) * pixelSize / u_resolution;
        vec4 colorFrom = texture2D(u_textureFrom, pixelCoord);
        vec4 colorTo = texture2D(u_textureTo, pixelCoord);
        gl_FragColor = mix(colorFrom, colorTo, u_progress);
      }
    `,
  },

  // Blur
  {
    id: 'blur-fade',
    name: 'Blur Fade',
    category: 'blur',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        float blurAmount = sin(u_progress * 3.14159) * 0.02;
        vec4 colorFrom = vec4(0.0);
        vec4 colorTo = vec4(0.0);
        for (int i = -2; i <= 2; i++) {
          for (int j = -2; j <= 2; j++) {
            vec2 offset = vec2(float(i), float(j)) * blurAmount;
            colorFrom += texture2D(u_textureFrom, v_texCoord + offset);
            colorTo += texture2D(u_textureTo, v_texCoord + offset);
          }
        }
        colorFrom /= 25.0;
        colorTo /= 25.0;
        gl_FragColor = mix(colorFrom, colorTo, u_progress);
      }
    `,
  },

  // Color effects
  {
    id: 'fade-white',
    name: 'Fade to White',
    category: 'color',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        vec4 white = vec4(1.0);
        float t = u_progress * 2.0;
        if (t < 1.0) {
          gl_FragColor = mix(colorFrom, white, t);
        } else {
          gl_FragColor = mix(white, colorTo, t - 1.0);
        }
      }
    `,
  },
  {
    id: 'fade-black',
    name: 'Fade to Black',
    category: 'color',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        vec4 black = vec4(0.0, 0.0, 0.0, 1.0);
        float t = u_progress * 2.0;
        if (t < 1.0) {
          gl_FragColor = mix(colorFrom, black, t);
        } else {
          gl_FragColor = mix(black, colorTo, t - 1.0);
        }
      }
    `,
  },

  // Distortion
  {
    id: 'zoom-in',
    name: 'Zoom In',
    category: 'distortion',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        float zoom = 1.0 + u_progress * 5.0;
        vec2 center = vec2(0.5, 0.5);
        vec2 zoomedCoord = (v_texCoord - center) / zoom + center;
        vec4 colorFrom = texture2D(u_textureFrom, zoomedCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        gl_FragColor = mix(colorFrom, colorTo, u_progress);
      }
    `,
  },
  {
    id: 'zoom-out',
    name: 'Zoom Out',
    category: 'distortion',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        float zoom = 6.0 - u_progress * 5.0;
        vec2 center = vec2(0.5, 0.5);
        vec2 zoomedCoord = (v_texCoord - center) / zoom + center;
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, zoomedCoord);
        gl_FragColor = mix(colorFrom, colorTo, u_progress);
      }
    `,
  },
  {
    id: 'rotate',
    name: 'Rotate',
    category: 'distortion',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        float angle = u_progress * 3.14159 * 2.0;
        vec2 center = vec2(0.5, 0.5);
        vec2 tc = v_texCoord - center;
        float s = sin(angle);
        float c = cos(angle);
        vec2 rotated = vec2(tc.x * c - tc.y * s, tc.x * s + tc.y * c) + center;
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, rotated);
        gl_FragColor = mix(colorFrom, colorTo, u_progress);
      }
    `,
  },
  {
    id: 'swirl',
    name: 'Swirl',
    category: 'distortion',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec2 center = vec2(0.5, 0.5);
        vec2 tc = v_texCoord - center;
        float dist = length(tc);
        float angle = dist * u_progress * 10.0;
        float s = sin(angle);
        float c = cos(angle);
        vec2 swirled = vec2(tc.x * c - tc.y * s, tc.x * s + tc.y * c) + center;
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, swirled);
        gl_FragColor = mix(colorFrom, colorTo, u_progress);
      }
    `,
  },
  {
    id: 'wave',
    name: 'Wave',
    category: 'distortion',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        float amplitude = sin(u_progress * 3.14159) * 0.1;
        float frequency = 10.0;
        vec2 distorted = v_texCoord;
        distorted.x += sin(v_texCoord.y * frequency) * amplitude;
        vec4 colorFrom = texture2D(u_textureFrom, distorted);
        vec4 colorTo = texture2D(u_textureTo, distorted);
        gl_FragColor = mix(colorFrom, colorTo, u_progress);
      }
    `,
  },
  {
    id: 'slide-left',
    name: 'Slide Left',
    category: 'wipe',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec2 fromCoord = v_texCoord + vec2(u_progress, 0.0);
        vec2 toCoord = v_texCoord - vec2(1.0 - u_progress, 0.0);
        vec4 colorFrom = texture2D(u_textureFrom, fromCoord);
        vec4 colorTo = texture2D(u_textureTo, toCoord);
        gl_FragColor = v_texCoord.x < u_progress ? colorTo : colorFrom;
      }
    `,
  },
  {
    id: 'slide-right',
    name: 'Slide Right',
    category: 'wipe',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec2 fromCoord = v_texCoord - vec2(u_progress, 0.0);
        vec2 toCoord = v_texCoord + vec2(1.0 - u_progress, 0.0);
        vec4 colorFrom = texture2D(u_textureFrom, fromCoord);
        vec4 colorTo = texture2D(u_textureTo, toCoord);
        gl_FragColor = v_texCoord.x > 1.0 - u_progress ? colorTo : colorFrom;
      }
    `,
  },
]

// Group effects by category
export function getEffectsByCategory(): Map<string, TransitionEffect[]> {
  const map = new Map<string, TransitionEffect[]>()
  TRANSITION_EFFECTS.forEach((effect) => {
    const list = map.get(effect.category) || []
    list.push(effect)
    map.set(effect.category, list)
  })
  return map
}
