'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1).max(120),
  domain: z.string().trim().optional(),
  audience: z.string().optional(),
  theme: z.string().optional(),
  content_locale: z.enum(['zh-TW', 'en']).default('zh-TW'),
})

export async function createProjectAction(
  locale: 'zh-TW' | 'en',
  formData: FormData,
) {
  const parsed = schema.parse({
    name: formData.get('name'),
    domain: formData.get('domain') || '',
    audience: formData.get('audience') || '',
    theme: formData.get('theme') || '',
    content_locale: (formData.get('content_locale') as string) || 'zh-TW',
  })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: membership, error: memErr } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single()
  if (memErr || !membership) throw new Error('No tenant found for user')

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      ...parsed,
      domain: parsed.domain || null,
      audience: parsed.audience || null,
      theme: parsed.theme || null,
      tenant_id: membership.tenant_id,
    })
    .select('id')
    .single()
  if (error || !project) throw error ?? new Error('Insert failed')

  // Create the empty brand_materials row so the brand page has something to load
  await supabase
    .from('brand_materials')
    .insert({ project_id: project.id, tenant_id: membership.tenant_id })

  revalidatePath('/projects')
  redirect({ href: `/projects/${project.id}/brand`, locale })
}
