import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-10 w-full rounded-lg border border-rule bg-white px-3 text-[14px] text-ink placeholder:text-ink-4 transition-colors',
          'focus:outline-none focus:border-ink-3 focus:ring-2 focus:ring-ochre focus:ring-offset-2 focus:ring-offset-bg',
          className,
        )}
        {...props}
      />
    )
  },
)
