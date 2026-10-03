import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import { Check } from 'lucide-react'
import * as React from 'react'

import { cn } from '../../lib/utils'
import { ElevatedSurface } from './surface'

const DropdownMenu = MenuPrimitive.Root
const DropdownMenuTrigger = MenuPrimitive.Trigger
const DropdownMenuGroup = MenuPrimitive.Group
const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup

type PositionerProps = React.ComponentProps<typeof MenuPrimitive.Positioner>

interface DropdownMenuContentProps extends React.ComponentProps<typeof MenuPrimitive.Popup> {
  align?: PositionerProps['align']
  side?: PositionerProps['side']
  sideOffset?: PositionerProps['sideOffset']
}

function DropdownMenuContent({
  className,
  align = 'start',
  side = 'bottom',
  sideOffset = 6,
  ...props
}: DropdownMenuContentProps) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner align={align} side={side} sideOffset={sideOffset} className="z-50">
        <ElevatedSurface asChild offset={1}>
          <MenuPrimitive.Popup
            className={cn(
              'min-w-40 ui-radius-md border border-transparent py-1 text-foreground outline-none data-[starting-style]:scale-[0.99] data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.99] data-[ending-style]:opacity-0',
              className,
            )}
            {...props}
          />
        </ElevatedSurface>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Item>) {
  return (
    <MenuPrimitive.Item
      className={cn(
        'surface-highlighted mx-1 flex cursor-default select-none items-center gap-2 ui-radius-sm px-2 py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem
      className={cn(
        'surface-highlighted relative mx-1 flex cursor-default select-none items-center gap-2 ui-radius-sm py-1.5 pl-7 pr-2 text-sm outline-none data-[checked]:bg-accent/10 data-[checked]:text-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <MenuPrimitive.RadioItemIndicator className="absolute left-2 flex items-center">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      </MenuPrimitive.RadioItemIndicator>
      {children}
    </MenuPrimitive.RadioItem>
  )
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.GroupLabel>) {
  return (
    <MenuPrimitive.GroupLabel
      className={cn('px-3 py-1.5 text-xs font-semibold text-muted-foreground', className)}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn('my-1 h-px bg-border', className)} {...props} />
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return <span className={cn('ml-auto text-[10px] text-muted-foreground', className)} {...props} />
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
}
