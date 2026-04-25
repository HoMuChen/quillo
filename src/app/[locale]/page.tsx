import { redirect } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const locale = (await getLocale()) as 'zh-TW' | 'en'

  if (user) {
    redirect({ href: '/projects', locale })
  } else {
    redirect({ href: '/login', locale })
  }
}
