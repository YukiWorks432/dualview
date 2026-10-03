import { ChevronDown } from 'lucide-react'
import { useId } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

interface DropdownSelectProps<Value extends string> {
  label: string
  value: Value
  options: { value: Value; label: string }[]
  onValueChange: (value: Value) => void
}

export function DropdownSelect<Value extends string>({
  label,
  value,
  options,
  onValueChange,
}: DropdownSelectProps<Value>) {
  const id = useId()
  const labelId = `${id}-label`
  const valueId = `${id}-value`

  return (
    <div className="flex flex-col gap-1" onKeyDown={(event) => event.stopPropagation()}>
      <span id={labelId} className="text-xs text-muted-foreground">
        {label}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-labelledby={`${labelId} ${valueId}`}
          className="flex h-8 w-full cursor-pointer items-center justify-between gap-2 ui-radius-md surface-control border px-2.5 text-left text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <span id={valueId} className="min-w-0 truncate">
            {options.find((option) => option.value === value)?.label}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          aria-labelledby={labelId}
          className="max-h-[var(--available-height)] w-[var(--anchor-width)] min-w-0 overflow-y-auto overscroll-contain"
        >
          <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
            {options.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value} closeOnClick>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
