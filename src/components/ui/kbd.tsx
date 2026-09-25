import type { ComponentProps } from 'react'

import { cn } from '../../lib/utils'

export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex min-w-5 items-center justify-center ui-radius-sm border border-border bg-surface-hover px-1.5 py-0.5 font-mono text-[10px] text-text-secondary',
        className,
      )}
      {...props}
    />
  )
}
