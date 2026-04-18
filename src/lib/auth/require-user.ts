import { redirect } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'

export async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    const locale = (await getLocale()) as 'zh-TW' | 'en'
    redirect({ href: '/login', locale })
  }
  return user!
}
