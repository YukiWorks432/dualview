import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import * as React from 'react'

import { cn } from '../../lib/utils'

const TooltipProvider = TooltipPrimitive.Provider
const TooltipRoot = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

type TooltipPositionerProps = React.ComponentProps<typeof TooltipPrimitive.Positioner>

interface TooltipContentProps extends React.ComponentProps<typeof TooltipPrimitive.Popup> {
  side?: TooltipPositionerProps['side']
  sideOffset?: TooltipPositionerProps['sideOffset']
}

function TooltipContent({
  className,
  side = 'top',
  sideOffset = 8,
  children,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner side={side} sideOffset={sideOffset} className="z-[70]">
        <TooltipPrimitive.Popup
          className={cn(
            'ui-radius-sm border border-border bg-surface-alt px-2 py-1.5 text-xs text-text-primary shadow-[0_6px_18px_rgba(0,0,0,0.3)] data-[starting-style]:scale-[0.99] data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.99] data-[ending-style]:opacity-0',
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

interface LegacyTooltipProps {
  children: React.ReactElement
  content: string
  side?: TooltipPositionerProps['side']
}

function Tooltip({ children, content, side = 'top' }: LegacyTooltipProps) {
  return (
    <TooltipRoot>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>{content}</TooltipContent>
    </TooltipRoot>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipRoot, TooltipTrigger }
