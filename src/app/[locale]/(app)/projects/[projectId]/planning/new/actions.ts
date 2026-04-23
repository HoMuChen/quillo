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

  // Apply AI's existing_article_ids: assign orphan articles to the pillars the AI chose.
  const hasExistingAssignments = parsed.pillars.some(
    (p) => (p.existing_article_ids ?? []).length > 0,
  )
  if (hasExistingAssignments) {
    const { data: pillars } = await supabase
      .from('pillars')
      .select('id,position')
      .eq('project_id', projectId)
      .order('position')

    if (pillars && pillars.length > 0) {
      for (let i = 0; i < parsed.pillars.length; i++) {
        const pillar = pillars[i]
        const ids = parsed.pillars[i].existing_article_ids ?? []
        if (!pillar || ids.length === 0) continue
        for (const articleId of ids) {
          await supabase
            .from('articles')
            .update({ pillar_id: pillar.id })
            .eq('id', articleId)
            .eq('project_id', projectId)
            .is('pillar_id', null)
        }
      }
    }
  }

  revalidatePath(`/projects/${projectId}/planning`)
  redirect({ href: `/projects/${projectId}/planning`, locale })
}
