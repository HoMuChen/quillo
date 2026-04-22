'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/*
  SlideOverPanel — right-side slide-over with backdrop.
  Owns the things every slide-over needs: the animated backdrop, the
  slide-in aside, Escape-to-close, and body-scroll lock while open.
  Callers pass in their own header/body so visuals stay custom.
*/
export function SlideOverPanel({
  open,
  onClose,
  width = 520,
  ariaLabel,
  className,
  children,
}: {
  open: boolean
  onClose: () => void
  width?: number
  ariaLabel?: string
  className?: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-ink-shade backdrop-blur-[1px] transition-opacity',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        style={{ width }}
        className={cn(
          'fixed top-0 right-0 bottom-0 z-50 max-w-[92vw] flex flex-col bg-bg border-l border-rule shadow-sh-3',
          'transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
          className,
        )}
      >
        {children}
      </aside>
    </>
  )
}
