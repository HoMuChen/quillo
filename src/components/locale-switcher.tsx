'use client'

import { useTransition } from 'react'
import { useLocale } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { cn } from '@/lib/utils'

export function LocaleSwitcher() {
  const current = useLocale() as (typeof routing.locales)[number]
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  function pick(next: (typeof routing.locales)[number]) {
    if (next === current) return
    startTransition(() => {
      router.replace(pathname, { locale: next })
    })
  }

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-rule bg-bg p-0.5">
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => pick(loc)}
          disabled={pending}
          className={cn(
            'text-[10px] font-mono uppercase tracking-[0.1em] px-1.5 py-0.5 rounded transition-colors cursor-pointer',
            loc === current
              ? 'bg-ink text-bg'
              : 'text-ink-3 hover:text-ink',
          )}
        >
          {loc === 'zh-TW' ? '中' : 'EN'}
        </button>
      ))}
    </div>
  )
}
