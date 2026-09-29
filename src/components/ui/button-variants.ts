import { cva, type VariantProps } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap ui-radius-md border border-transparent text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'surface-control-elevation border-primary bg-primary text-primary-foreground hover:bg-primary/80 active:bg-primary/80',
        secondary: 'surface-control text-foreground',
        ghost: 'surface-interactive bg-transparent text-muted-foreground hover:text-foreground',
        outline: 'surface-control text-foreground',
        destructive:
          'surface-control-elevation border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/90',
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
