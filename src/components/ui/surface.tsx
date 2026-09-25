import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react'

import { cn } from '../../lib/utils'

export const SURFACE_MIN_LEVEL = 1
export const SURFACE_MAX_LEVEL = 6

const SurfaceContext = createContext(SURFACE_MIN_LEVEL)

export function clampSurfaceLevel(level: number): number {
  return Math.max(SURFACE_MIN_LEVEL, Math.min(SURFACE_MAX_LEVEL, level))
}

export function resolveSurfaceLevel(substrate: number, offset: number): number {
  return clampSurfaceLevel(substrate + offset)
}

interface SurfaceProviderProps {
  value?: number
  children: ReactNode
}

export function SurfaceProvider({ value = SURFACE_MIN_LEVEL, children }: SurfaceProviderProps) {
  return (
    <SurfaceContext.Provider value={clampSurfaceLevel(value)}>
      {children}
    </SurfaceContext.Provider>
  )
}

type SurfaceStyle = CSSProperties & {
  '--surface-current'?: string
  '--surface-control'?: string
  '--surface-shadow-current'?: string
  '--surface-control-shadow'?: string
}

function createSurfaceStyle(
  level: number,
  shadowLevel: number | null | undefined,
  style?: CSSProperties,
): SurfaceStyle {
  const controlLevel = resolveSurfaceLevel(level, 1)
  const resolvedShadowLevel = shadowLevel === null ? null : clampSurfaceLevel(shadowLevel ?? level)

  return {
    '--surface-current': `var(--surface-${level})`,
    '--surface-control': `var(--surface-${controlLevel})`,
    '--surface-shadow-current':
      resolvedShadowLevel === null ? 'none' : `var(--surface-shadow-${resolvedShadowLevel})`,
    '--surface-control-shadow': `var(--surface-shadow-${controlLevel})`,
    ...style,
  }
}

type SurfaceChildProps = HTMLAttributes<HTMLElement> & {
  'data-surface-level'?: number
}

export interface ElevatedSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  asChild?: boolean
  offset?: number
  shadowLevel?: number | null
  children?: ReactNode
}

export function ElevatedSurface({
  asChild = false,
  offset = 1,
  shadowLevel,
  className,
  style,
  children,
  ...props
}: ElevatedSurfaceProps) {
  const substrate = useContext(SurfaceContext)
  const level = resolveSurfaceLevel(substrate, offset)
  const surfaceStyle = createSurfaceStyle(level, shadowLevel, style)

  if (asChild) {
    const child = Children.only(children)

    if (!isValidElement<SurfaceChildProps>(child)) {
      return null
    }

    return (
      <SurfaceContext.Provider value={level}>
        {cloneElement(child, {
          ...props,
          ...child.props,
          'data-surface-level': level,
          className: cn('fluid-surface', child.props.className, className),
          style: createSurfaceStyle(level, shadowLevel, {
            ...child.props.style,
            ...style,
          }),
        })}
      </SurfaceContext.Provider>
    )
  }

  return (
    <SurfaceContext.Provider value={level}>
      <div
        {...props}
        data-surface-level={level}
        className={cn('fluid-surface', className)}
        style={surfaceStyle}
      >
        {children}
      </div>
    </SurfaceContext.Provider>
  )
}
