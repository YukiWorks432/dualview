import { forwardRef, type InputHTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

const Slider = forwardRef<HTMLInputElement, SliderProps>(({ className, label, ...props }, ref) => {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-text-secondary">{label}</label>}
      <input
        type="range"
        className={cn(
          'h-1 w-full cursor-pointer appearance-none rounded-full bg-border',
          '[&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-surface [&::-webkit-slider-thumb]:bg-accent',
          '[&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-surface [&::-moz-range-thumb]:bg-accent',
          className,
        )}
        ref={ref}
        {...props}
      />
    </div>
  )
})
Slider.displayName = 'Slider'

export { Slider }
