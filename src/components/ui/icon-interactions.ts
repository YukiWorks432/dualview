import { cn } from '../../lib/utils'

export const iconHoverScaleBaseClasses = cn(
  'will-change-transform transition-transform duration-150 ease-out',
)

export const iconButtonGroupClasses = 'group/icon-button'
export const iconButtonIconHoverScaleClasses = cn(
  iconHoverScaleBaseClasses,
  'group-hover/icon-button:scale-[1.25]',
)

export const labeledButtonGroupClasses = 'group/labeled-button'
export const labeledButtonIconHoverScaleClasses = cn(
  iconHoverScaleBaseClasses,
  'group-hover/labeled-button:scale-[1.25]',
)
