import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'
import { Button, type ButtonProps } from './button'
import { labeledButtonGroupClasses, labeledButtonIconHoverScaleClasses } from './icon-interactions'

export type ButtonWithIconProps = Omit<ButtonProps, 'children'> & {
  icon: ReactNode
  iconPosition?: 'start' | 'end'
  children: ReactNode
}

export function ButtonWithIcon({
  icon,
  iconPosition = 'start',
  children,
  className,
  ...props
}: ButtonWithIconProps) {
  const iconSlot = (
    <span
      data-slot="button-with-icon-icon"
      className={cn(
        'inline-flex shrink-0 items-center justify-center [&_svg]:pointer-events-none',
        labeledButtonIconHoverScaleClasses,
      )}
    >
      {icon}
    </span>
  )

  return (
    <Button className={cn(labeledButtonGroupClasses, className)} {...props}>
      {iconPosition === 'start' ? (
        <>
          {iconSlot}
          {children}
        </>
      ) : (
        <>
          {children}
          {iconSlot}
        </>
      )}
    </Button>
  )
}
