'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('common')

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="max-w-md mx-auto mt-20 space-y-4 rounded-xl border border-rule bg-bg p-8 shadow-sh-1 text-center">
      <h2 className="font-serif italic text-[28px] text-ink leading-tight">{t('error_title')}</h2>
      <p className="text-[13px] text-ink-3">{t('error_body')}</p>
      {error.digest && (
        <p className="font-mono text-[10px] text-ink-4 select-all">ref: {error.digest}</p>
      )}
      <Button onClick={reset} variant="primary">{t('error_retry')}</Button>
    </div>
  )
}
