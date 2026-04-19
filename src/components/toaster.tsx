'use client'

import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      toastOptions={{
        style: {
          background: 'var(--color-ink)',
          color: 'var(--color-bg)',
          border: '1px solid var(--color-ink)',
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
          borderRadius: '999px',
          padding: '10px 18px',
          boxShadow: '0 2px 0 rgba(18,34,28,0.06), 0 8px 24px rgba(18,34,28,0.08)',
        },
      }}
    />
  )
}
