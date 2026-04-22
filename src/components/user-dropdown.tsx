'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ChevronUp, LogOut } from 'lucide-react'

export function UserDropdown({ email }: { email?: string }) {
  const t = useTranslations('auth')
  const current = useLocale() as (typeof routing.locales)[number]
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onMouse(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pickLocale(next: (typeof routing.locales)[number]) {
    if (next === current) return
    setOpen(false)
    startTransition(() => router.replace(pathname, { locale: next }))
  }

  function logout() {
    const supabase = createClient()
    startTransition(async () => {
      await supabase.auth.signOut()
      router.replace('/login')
      router.refresh()
    })
  }

  return (
    <div ref={wrapRef} className="relative">
      {/* Dropdown — opens upward */}
      <div className={cn(
        'absolute bottom-full left-0 right-0 mb-1.5 rounded-lg border border-rule bg-bg shadow-sh-2 overflow-hidden',
        'transition-all duration-200 origin-bottom',
        open ? 'opacity-100 scale-y-100 pointer-events-auto' : 'opacity-0 scale-y-95 pointer-events-none',
      )}>
        {/* Email header */}
        <div className="px-3 py-2.5 border-b border-rule">
          <div className="text-[12px] font-medium text-ink truncate">{email}</div>
        </div>

        {/* Language */}
        <div className="px-3 py-2.5 border-b border-rule space-y-2">
          <div className="text-[10px] uppercase tracking-[0.12em] text-ink-4">Language</div>
          <div className="flex gap-1">
            {routing.locales.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => pickLocale(loc)}
                disabled={pending}
                className={cn(
                  'flex-1 py-1 rounded-md text-[12px] font-mono transition-colors cursor-pointer',
                  loc === current
                    ? 'bg-ink text-bg font-medium'
                    : 'text-ink-3 hover:bg-mist hover:text-ink',
                )}
              >
                {loc === 'zh-TW' ? '繁中' : 'EN'}
              </button>
            ))}
          </div>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={logout}
          disabled={pending}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-ink-2 hover:bg-mist transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 text-ink-4 shrink-0" />
          {pending ? '…' : t('logout')}
        </button>
      </div>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors cursor-pointer',
          open ? 'bg-mist' : 'hover:bg-mist',
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-ink-3 truncate">{email}</div>
        </div>
        <ChevronUp className={cn(
          'w-3.5 h-3.5 text-ink-4 shrink-0 transition-transform duration-200',
          open ? 'rotate-0' : 'rotate-180',
        )} />
      </button>
    </div>
  )
}
