import { ChevronDown } from 'lucide-react'
import { useId } from 'react'

import { cn } from '../../lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

export interface DropdownSelectProps<Value extends string = string> {
  label?: string
  'aria-label'?: string
  id?: string
  title?: string
  disabled?: boolean
  className?: string
  placeholder?: string
  value: Value
  options: { value: Value; label: string; disabled?: boolean }[]
  onValueChange: (value: Value) => void
}

export function DropdownSelect<Value extends string>({
  label,
  value,
  options,
  onValueChange,
  'aria-label': ariaLabel,
  id: triggerId,
  title,
  disabled,
  className,
  placeholder = 'Select…',
}: DropdownSelectProps<Value>) {
  const id = useId()
  const labelId = `${id}-label`
  const valueId = `${id}-value`

  return (
    <span
      className={label ? 'flex min-w-0 flex-col gap-1' : 'contents'}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {label && (
        <span id={labelId} className="text-xs text-muted-foreground">
          {label}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          id={triggerId}
          title={title}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-labelledby={label && !ariaLabel ? `${labelId} ${valueId}` : undefined}
          className={cn(
            'flex h-8 w-full cursor-pointer items-center justify-between gap-2 ui-radius-md surface-control border px-2.5 text-left text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span id={valueId} className="min-w-0 truncate">
            {options.find((option) => option.value === value)?.label ?? placeholder}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          aria-label={ariaLabel}
          aria-labelledby={label && !ariaLabel ? labelId : undefined}
          className="max-h-[var(--available-height)] w-[var(--anchor-width)] min-w-0 overflow-y-auto overscroll-contain"
        >
          <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
            {options.map((option) => (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                closeOnClick
              >
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  )
}
