import * as React from 'react'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

import { Elevated } from '../../lib/elevated'
import { SURFACE_BG, surfaceClasses } from '../../lib/surface-classes'
import {
  SurfaceProvider as UpstreamSurfaceProvider,
  useSurface,
} from '../../lib/surface-context'
import { cn } from '../../lib/utils'

export const SURFACE_MIN_LEVEL = 1
export const SURFACE_MAX_LEVEL = 8

export function clampSurfaceLevel(level: number): number {
  return Math.max(SURFACE_MIN_LEVEL, Math.min(SURFACE_MAX_LEVEL, level))
}

export function resolveSurfaceLevel(substrate: number, offset: number): number {
  return clampSurfaceLevel(substrate + offset)
}

export interface SurfaceProviderProps {
  value?: number
  children: ReactNode
}

export function SurfaceProvider({ value = SURFACE_MIN_LEVEL, children }: SurfaceProviderProps) {
  return React.createElement(UpstreamSurfaceProvider, { value: clampSurfaceLevel(value) }, children)
}

type SurfaceStyle = CSSProperties & {
  '--surface-current'?: string
  '--surface-control'?: string
  '--surface-control-shadow'?: string
}

function surfaceStyle(level: number, style?: CSSProperties): SurfaceStyle {
  const controlLevel = resolveSurfaceLevel(level, 1)

  return {
    ...style,
    '--surface-current': `var(--surface-${level})`,
    '--surface-control': `var(--surface-${controlLevel})`,
    '--surface-control-shadow': `var(--shadow-${controlLevel})`,
  }
}

type SurfaceChildProps = HTMLAttributes<HTMLElement> & {
  'data-surface-level'?: number
  className?: string
  style?: CSSProperties
}

/**
 * Compatibility adapter around Fluid Functionalism's upstream surface system.
 *
 * Normal surfaces delegate to upstream Elevated. The asChild path and the
 * control-surface CSS variables are dualview-specific compatibility behavior.
 */
export type ElevatedSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  asChild?: boolean
  children?: ReactNode
  offset?: number
  shadowLevel?: number | null
}

export function ElevatedSurface({
  asChild = false,
  children,
  className,
  offset = 1,
  shadowLevel,
  style,
  ...props
}: ElevatedSurfaceProps) {
  const substrate = useSurface()
  const level = resolveSurfaceLevel(substrate, offset)

  if (asChild) {
    const child = React.Children.only(children)

    if (!React.isValidElement<SurfaceChildProps>(child)) {
      return null
    }

    const childProps = child.props
    const surfaceClassName =
      shadowLevel === null ? SURFACE_BG[level] : surfaceClasses(level, shadowLevel ?? level)
    const elevatedChild = React.cloneElement(child, {
      ...props,
      ...childProps,
      'data-surface-level': level,
      className: cn(childProps.className, surfaceClassName, className),
      style: surfaceStyle(level, {
        ...childProps.style,
        ...style,
      }),
    })

    return React.createElement(UpstreamSurfaceProvider, { value: level }, elevatedChild)
  }

  return React.createElement(
    Elevated,
    {
      ...props,
      offset,
      shadowLevel: shadowLevel ?? undefined,
      'data-surface-level': level,
      className: cn(className, shadowLevel === null && 'shadow-none'),
      style: surfaceStyle(level, style),
    },
    children,
  )
}
