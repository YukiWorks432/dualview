'use client'

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'

import { surfaceClasses } from '@/lib/surface-classes'
import { useSurface } from '@/lib/surface-context'
import { SurfaceProvider } from '@/lib/surface-provider'
import { cn } from '@/lib/utils'

interface ElevatedProps extends ComponentPropsWithoutRef<'div'> {
  /**
   * Steps above the current substrate.
   *
   * The component's own surface level becomes min(substrate + offset, 8)
   * and is re-provided to descendants so further nesting walks the ladder.
   */
  offset: number
  /**
   * Override for the shadow level. Defaults to the computed surface level.
   */
  shadowLevel?: number
  children?: ReactNode
}

const Elevated = forwardRef<HTMLDivElement, ElevatedProps>(
  ({ offset, shadowLevel, className, children, ...props }, ref) => {
    const substrate = useSurface()
    const level = Math.min(substrate + offset, 8)

    return (
      <SurfaceProvider value={level}>
        <div
          ref={ref}
          className={cn(surfaceClasses(level, shadowLevel ?? level), className)}
          {...props}
        >
          {children}
        </div>
      </SurfaceProvider>
    )
  },
)
Elevated.displayName = 'Elevated'

export { Elevated }
