import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import * as React from 'react'

import { cn } from '../../lib/utils'
import { ElevatedSurface } from './surface'

const DropdownMenu = MenuPrimitive.Root
const DropdownMenuTrigger = MenuPrimitive.Trigger
const DropdownMenuGroup = MenuPrimitive.Group

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
              'min-w-40 ui-radius-md border border-transparent py-1 text-text-primary outline-none data-[starting-style]:scale-[0.99] data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.99] data-[ending-style]:opacity-0',
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
        'mx-1 flex cursor-default select-none items-center gap-2 ui-radius-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.GroupLabel>) {
  return (
    <MenuPrimitive.GroupLabel
      className={cn('px-3 py-1.5 text-xs font-semibold text-text-secondary', className)}
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
  return <span className={cn('ml-auto text-[10px] text-text-muted', className)} {...props} />
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
}
