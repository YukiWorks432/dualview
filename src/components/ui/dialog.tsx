import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import * as React from 'react'

import { cn } from '../../lib/utils'
import { Button } from './button'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close
const DialogTitle = DialogPrimitive.Title
const DialogDescription = DialogPrimitive.Description

interface DialogContentProps extends React.ComponentProps<typeof DialogPrimitive.Popup> {
  backdropClassName?: string
  viewportClassName?: string
  showCloseButton?: boolean
}

function DialogContent({
  className,
  backdropClassName,
  viewportClassName,
  children,
  showCloseButton = true,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        className={cn(
          'fixed inset-0 z-50 bg-black/55 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
          backdropClassName,
        )}
      />
      <DialogPrimitive.Viewport
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4',
          viewportClassName,
        )}
      >
        <DialogPrimitive.Popup
          className={cn(
            'relative w-full max-w-lg ui-radius-lg border border-border bg-surface text-text-primary shadow-[0_12px_32px_rgba(0,0,0,0.35)] outline-none data-[starting-style]:scale-[0.99] data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.99] data-[ending-style]:opacity-0',
            className,
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 h-7 w-7"
                  aria-label="Close dialog"
                />
              }
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPrimitive.Portal>
  )
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger }
