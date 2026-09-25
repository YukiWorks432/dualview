import * as React from 'react'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

import { cn } from '../../lib/utils'

export const SURFACE_MIN_LEVEL = 1
export const SURFACE_MAX_LEVEL = 6

const SurfaceContext = React.createContext(SURFACE_MIN_LEVEL)

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
    <SurfaceContext.Provider value={clampSurfaceLevel(value)}>{children}</SurfaceContext.Provider>
  )
}

type SurfaceStyle = CSSProperties & {
  '--surface-current'?: string
  '--surface-control'?: string
  '--surface-shadow-current'?: string
  '--surface-control-shadow'?: string
}

function surfaceStyle(
  level: number,
  shadowLevel: number | null | undefined,
  style?: CSSProperties,
): SurfaceStyle {
  const controlLevel = resolveSurfaceLevel(level, 1)
  const resolvedShadowLevel =
    shadowLevel === null ? null : clampSurfaceLevel(shadowLevel ?? level)

  return {
    ...style,
    '--surface-current': `var(--surface-${level})`,
    '--surface-control': `var(--surface-${controlLevel})`,
    '--surface-shadow-current':
      resolvedShadowLevel === null ? 'none' : `var(--surface-shadow-${resolvedShadowLevel})`,
    '--surface-control-shadow': `var(--surface-shadow-${controlLevel})`,
  }
}

type SurfaceChildProps = HTMLAttributes<HTMLElement> & {
  'data-surface-level'?: number
  className?: string
  style?: CSSProperties
}

export type ElevatedSurfaceProps = HTMLAttributes<HTMLElement> & {
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
  const substrate = React.useContext(SurfaceContext)
  const level = resolveSurfaceLevel(substrate, offset)
  const classNames = cn('fluid-surface', className)

  if (asChild) {
    const child = React.Children.only(children)

    if (!React.isValidElement<SurfaceChildProps>(child)) {
      return null
    }

    const childProps = child.props

    return (
      <SurfaceContext.Provider value={level}>
        {React.cloneElement(child, {
          ...props,
          ...childProps,
          'data-surface-level': level,
          className: cn(childProps.className, classNames),
          style: surfaceStyle(level, shadowLevel, {
            ...childProps.style,
            ...style,
          }),
        })}
      </SurfaceContext.Provider>
    )
  }

  return (
    <SurfaceContext.Provider value={level}>
      <div
        data-surface-level={level}
        className={classNames}
        style={surfaceStyle(level, shadowLevel, style)}
        {...props}
      >
        {children}
      </div>
    </SurfaceContext.Provider>
  )
}
