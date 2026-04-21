import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

/*
  Button — see docs/DESIGN.md §7.1.
  Semantic color split:
    - primary (ink)        : main affirmative action
    - ochre                : AI / generation — the colour of "Quillo is doing something"
    - destructive (rust)   : delete, unpublish, dangerous
    - link (indigo-ink)    : navigate to data / external resource
    - default / ghost      : neutral chrome
  Focus ring is ochre — consistent across all variants so keyboard users see the same anchor.
*/
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 font-medium leading-none transition-colors cursor-pointer ' +
    'disabled:opacity-50 disabled:cursor-not-allowed ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ochre focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
  {
    variants: {
      variant: {
        default:     'bg-bg text-ink border border-rule hover:border-ink-3 hover:bg-bg-3',
        primary:     'bg-ink text-bg border border-ink hover:bg-ink-2 hover:border-ink-2',
        ochre:       'bg-ochre text-white border border-ochre-2 hover:bg-ochre-2',
        ghost:       'bg-transparent hover:bg-mist text-ink border-0',
        destructive: 'bg-rust text-white border border-rust hover:opacity-90',
        link:        'bg-transparent border-0 p-0 h-auto text-indigo-ink hover:underline underline-offset-2 decoration-rule hover:decoration-indigo-ink',
      },
      size: {
        default: 'h-10 px-4 rounded-lg text-[13px]',
        sm:      'h-8  px-2.5 rounded-md text-[12px]',
        lg:      'h-11 px-5 rounded-lg text-[14px]',
        icon:    'h-8  w-8 rounded-md',
      },
    },
    compoundVariants: [
      // link ignores size padding/height — it's just text
      { variant: 'link', size: 'sm',      class: 'h-auto px-0 text-[12px]' },
      { variant: 'link', size: 'lg',      class: 'h-auto px-0 text-[14px]' },
      { variant: 'link', size: 'default', class: 'h-auto px-0 text-[13px]' },
      { variant: 'link', size: 'icon',    class: 'h-auto w-auto px-0' },
    ],
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export type ButtonProps =
  React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { buttonVariants }
