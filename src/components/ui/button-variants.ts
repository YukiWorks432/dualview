import { cva, type VariantProps } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap ui-radius-md border border-transparent text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-accent text-white hover:bg-accent-hover active:bg-accent-hover',
        secondary:
          'surface-control text-text-primary active:surface-interactive-active',
        ghost:
          'surface-interactive bg-transparent text-text-secondary hover:text-text-primary active:surface-interactive-active',
        outline:
          'surface-control text-text-primary active:surface-interactive-active',
        destructive: 'border-error bg-error text-white hover:bg-error/90 active:bg-error/90',
      },
      size: {
        default: 'h-8 px-3 py-1.5',
        sm: 'h-7 px-2.5 text-xs',
        lg: 'h-9 px-4',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export type ButtonVariantProps = VariantProps<typeof buttonVariants>
