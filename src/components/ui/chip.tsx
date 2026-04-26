import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

/*
  Chip — see docs/DESIGN.md §7.3.
  Tone semantics:
    - neutral   : default / planning chrome
    - muted     : in-flight state with no AI involvement
    - aiActive  : AI is generating this right now (e.g. drafting)
    - aiReady   : AI finished, awaiting user action
    - info      : state the user is actively working in
    - solid     : terminal / published
    - warning   : needs update / soft alarm
    - success   : stable / good signal
    - error     : hard failure
  Shape: rounded (data feel) | pill (label feel).
  Size: sm (10px mono, data tables) | md (11px mono, panel headings).
*/
const chipVariants = cva(
  'inline-flex items-center gap-1.5 font-mono uppercase border whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral:  'bg-bg border-rule text-ink-3',
        muted:    'bg-bg-2 border-rule text-ink-3',
        aiActive: 'bg-bg-2 border-rule text-ochre-ink',
        aiReady:  'bg-bg border-ochre text-ochre-ink',
        info:     'bg-bg border-ink text-ink',
        solid:    'bg-ink text-bg border-ink',
        warning:  'bg-ochre-tint text-rust border-rust/40',
        success:  'bg-bg border-sage text-sage-ink',
        error:    'bg-bg border-rust text-rust',
      },
      shape: {
        rounded: 'rounded',
        pill:    'rounded-full',
      },
      size: {
        sm: 'text-[10px] tracking-[0.1em] px-2 py-0.5',
        md: 'text-[11px] tracking-[0.14em] px-2.5 py-0.5',
      },
    },
    defaultVariants: { tone: 'neutral', shape: 'rounded', size: 'sm' },
  },
)

export type ChipTone = NonNullable<VariantProps<typeof chipVariants>['tone']>
export type ChipShape = NonNullable<VariantProps<typeof chipVariants>['shape']>
export type ChipSize = NonNullable<VariantProps<typeof chipVariants>['size']>

export type ChipProps =
  React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof chipVariants> & {
    /** Show a leading dot. Defaults to `false`. Dot colour inherits from text (60% opacity). */
    dot?: boolean
  }

export function Chip({ className, tone, shape, size, dot, children, ...props }: ChipProps) {
  const dotSize = size === 'md' ? 'w-1.5 h-1.5' : 'w-1 h-1'
  return (
    <span className={cn(chipVariants({ tone, shape, size }), className)} {...props}>
      {dot && <span aria-hidden className={cn(dotSize, 'rounded-full bg-current opacity-60 shrink-0')} />}
      {children}
    </span>
  )
}

export { chipVariants }

/* -----------------------------------------------------------------
   Domain wrappers — keep status → tone mappings in one place so the
   rule "drafting is an AI-active state" can be read as one line.
   ----------------------------------------------------------------- */

export const ARTICLE_STATUS_TONE: Record<string, ChipTone> = {
  planning:  'neutral',
  drafting:  'aiActive',
  editing:   'info',
  published: 'solid',
}

export function ArticleStatusChip({
  status,
  label,
  className,
}: {
  status: string
  label?: string
  className?: string
}) {
  const tone = ARTICLE_STATUS_TONE[status] ?? 'neutral'
  return (
    <Chip tone={tone} shape="rounded" size="sm" dot className={className}>
      {label ?? status.replace(/_/g, ' ')}
    </Chip>
  )
}

export const PUBLISH_STATUS_TONE: Record<string, ChipTone> = {
  draft:     'aiActive',
  published: 'solid',
  scheduled: 'aiReady',
}

export function PublishStatusChip({
  status,
  unpublishedLabel,
  className,
}: {
  status: string | null | undefined
  unpublishedLabel: string
  className?: string
}) {
  if (!status || status === 'unpublished') {
    return (
      <Chip tone="neutral" shape="pill" size="md" dot className={className}>
        {unpublishedLabel}
      </Chip>
    )
  }
  const tone = PUBLISH_STATUS_TONE[status] ?? 'neutral'
  return (
    <Chip tone={tone} shape="pill" size="md" dot className={className}>
      {status}
    </Chip>
  )
}
