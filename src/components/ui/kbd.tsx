import type { ComponentProps } from 'react'

import { cn } from '../../lib/utils'

export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'surface-control inline-flex min-w-5 items-center justify-center ui-radius-sm border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}
