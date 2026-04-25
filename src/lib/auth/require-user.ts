import type { SupabaseClient } from '@supabase/supabase-js'
import { redirect } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
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

// For use in server actions (throws Error). Routes that prefer Response
// semantics should inline the check.
export async function requireTenant(
  supabase: SupabaseClient<Database>,
): Promise<{ userId: string; tenantId: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: membership } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single()
  if (!membership) throw new Error('No tenant')

  return { userId: user.id, tenantId: membership.tenant_id }
}
