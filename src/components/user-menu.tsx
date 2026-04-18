'use client'

import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function UserMenu() {
  const t = useTranslations('auth')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleLogout() {
    const supabase = createClient()
    startTransition(async () => {
      await supabase.auth.signOut()
      router.replace('/login')
      router.refresh()
    })
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout} disabled={pending} className="w-full justify-start px-2">
      {pending ? '...' : t('logout')}
    </Button>
  )
}
