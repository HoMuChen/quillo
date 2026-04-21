'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/server'
import { pillarPlanSchema, type PillarPlan } from '@/lib/ai/schemas'

export async function savePlanAction(
  locale: 'zh-TW' | 'en',
  projectId: string,
  plan: PillarPlan,
  orphanAssignments: Record<string, number> = {},
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

  // Assign orphan articles to the newly created pillars
  const assignEntries = Object.entries(orphanAssignments)
  if (assignEntries.length > 0) {
    // Fetch newly created pillars ordered by position to map by index
    const { data: pillars } = await supabase
      .from('pillars')
      .select('id,position')
      .eq('project_id', projectId)
      .order('position')

    if (pillars && pillars.length > 0) {
      for (const [articleId, pillarIndex] of assignEntries) {
        const pillar = pillars[pillarIndex]
        if (!pillar) continue
        await supabase
          .from('articles')
          .update({ pillar_id: pillar.id })
          .eq('id', articleId)
          .eq('project_id', projectId)
          .is('pillar_id', null)
      }
    }
  }

  revalidatePath(`/projects/${projectId}/planning`)
  redirect({ href: `/projects/${projectId}/planning`, locale })
}
