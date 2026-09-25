import { ChevronDown } from 'lucide-react'
import { forwardRef, type SelectHTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && <label className="text-xs text-text-secondary">{label}</label>}
        <div className="relative">
          <select
            className={cn(
              'h-8 w-full cursor-pointer appearance-none ui-radius-md surface-control border px-2.5 pr-8 text-sm text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/40',
              className,
            )}
            ref={ref}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        </div>
      </div>
    )
  },
)
Select.displayName = 'Select'

export { Select }
