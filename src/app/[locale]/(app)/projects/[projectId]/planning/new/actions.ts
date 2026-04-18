'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/server'
import { pillarPlanSchema, type PillarPlan } from '@/lib/ai/schemas'

export async function savePlanAction(
  locale: 'zh-TW' | 'en',
  projectId: string,
  plan: PillarPlan,
) {
  const parsed = pillarPlanSchema.parse(plan)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.rpc('create_pillar_plan', {
    p_project_id: projectId,
    p_plan: parsed,
  })
  if (error) throw error

  revalidatePath(`/projects/${projectId}/planning`)
  redirect({ href: `/projects/${projectId}/planning`, locale })
}
