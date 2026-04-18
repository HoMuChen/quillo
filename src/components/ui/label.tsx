import * as React from 'react'
import { cn } from '@/lib/utils'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('block text-[12px] font-medium text-ink-2 uppercase tracking-[0.08em]', className)}
      {...props}
    />
  )
}
