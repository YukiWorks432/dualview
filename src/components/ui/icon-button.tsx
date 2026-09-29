import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'
import { Button, type ButtonProps } from './button'
import { iconButtonGroupClasses, iconButtonIconHoverScaleClasses } from './icon-interactions'

export type IconButtonProps = Omit<ButtonProps, 'children' | 'size'> & {
  children: ReactNode
}

export function IconButton({ className, children, ...props }: IconButtonProps) {
  return (
    <Button
      size="icon"
      className={cn(iconButtonGroupClasses, className)}
      data-slot="icon-button"
      {...props}
    >
      <span
        data-slot="icon-button-icon"
        className={cn(
          'flex size-full items-center justify-center',
          iconButtonIconHoverScaleClasses,
        )}
      >
        {children}
      </span>
    </Button>
  )
}
