'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { clusterArticlesSchema, type ClusterArticles } from '@/lib/ai/schemas'

const intent = z.enum(['informational', 'commercial', 'transactional'])
const role = z.enum(['hub', 'supporting', 'comparison'])

async function sb() {
  return createClient()
}

// --- Pillar ---

const pillarUpdateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  target_keyword: z.string().optional().nullable(),
  search_intent: intent.optional().nullable(),
})

export async function updatePillar(
  projectId: string,
  pillarId: string,
  input: z.infer<typeof pillarUpdateSchema>,
) {
  const patch = pillarUpdateSchema.parse(input)
  const supabase = await sb()
  const { error } = await supabase.from('pillars').update(patch).eq('id', pillarId)
  if (error) throw error
  revalidatePath(`/projects/${projectId}/planning`)
}

export async function deletePillar(projectId: string, pillarId: string) {
  const supabase = await sb()
  const { error } = await supabase.from('pillars').delete().eq('id', pillarId)
  if (error) throw error
  revalidatePath(`/projects/${projectId}/planning`)
}

export async function addPillar(
  projectId: string,
  input: {
    title: string
    description?: string | null
    target_keyword?: string | null
    search_intent?: z.infer<typeof intent> | null
  },
) {
  const parsed = pillarUpdateSchema.parse({ ...input })
  const supabase = await sb()
  // Determine next position
  const { data: last } = await supabase
    .from('pillars')
    .select('position')
    .eq('project_id', projectId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPos = (last?.position ?? -1) + 1

  // tenant_id from membership
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

  const { error } = await supabase.from('pillars').insert({
    project_id: projectId,
    tenant_id: membership.tenant_id,
    title: parsed.title,
    description: parsed.description ?? null,
    target_keyword: parsed.target_keyword ?? null,
    search_intent: parsed.search_intent ?? null,
    position: nextPos,
  })
  if (error) throw error
  revalidatePath(`/projects/${projectId}/planning`)
}

// --- Article ---

const articleUpdateSchema = z.object({
  title: z.string().min(1).max(300),
  target_keyword: z.string().optional().nullable(),
  lsi_keywords: z.array(z.string()).max(3).optional(),
  search_intent: intent.optional().nullable(),
  word_count_target: z.number().int().min(300).max(8000).optional().nullable(),
  role: role.optional().nullable(),
})

export async function updateArticle(
  projectId: string,
  articleId: string,
  input: z.infer<typeof articleUpdateSchema>,
) {
  const patch = articleUpdateSchema.parse(input)
  const supabase = await sb()
  const { error } = await supabase
    .from('articles')
    .update({
      title: patch.title,
      target_keyword: patch.target_keyword ?? null,
      lsi_keywords: patch.lsi_keywords ?? [],
      search_intent: patch.search_intent ?? null,
      word_count_target: patch.word_count_target ?? null,
      role: patch.role ?? null,
    })
    .eq('id', articleId)
  if (error) throw error
  revalidatePath(`/projects/${projectId}/planning`)
}

export async function deleteArticle(projectId: string, articleId: string) {
  const supabase = await sb()
  const { error } = await supabase.from('articles').delete().eq('id', articleId)
  if (error) throw error
  revalidatePath(`/projects/${projectId}/planning`)
}

export async function addArticle(
  projectId: string,
  pillarId: string,
  input: z.infer<typeof articleUpdateSchema>,
) {
  const parsed = articleUpdateSchema.parse(input)
  const supabase = await sb()

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

  const { data: last } = await supabase
    .from('articles')
    .select('position')
    .eq('pillar_id', pillarId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPos = (last?.position ?? -1) + 1

  const { error } = await supabase.from('articles').insert({
    project_id: projectId,
    pillar_id: pillarId,
    tenant_id: membership.tenant_id,
    title: parsed.title,
    target_keyword: parsed.target_keyword ?? null,
    lsi_keywords: parsed.lsi_keywords ?? [],
    search_intent: parsed.search_intent ?? null,
    word_count_target: parsed.word_count_target ?? null,
    role: parsed.role ?? 'supporting',
    position: nextPos,
  })
  if (error) throw error
  revalidatePath(`/projects/${projectId}/planning`)
}

// --- Regenerate Cluster ---

export async function regenerateClusterAction(
  projectId: string,
  pillarId: string,
  articles: ClusterArticles['articles'],
) {
  const parsed = clusterArticlesSchema.parse({ articles })

  const supabase = await sb()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: membership } = await supabase
    .from('tenant_members').select('tenant_id').eq('user_id', user.id).single()
  if (!membership) throw new Error('No tenant')

  // Guard: all existing articles for this pillar must be planned
  const { data: existing } = await supabase
    .from('articles').select('id,status').eq('pillar_id', pillarId)
  const blocker = (existing ?? []).find((a) => a.status !== 'planned')
  if (blocker) throw new Error('Some articles already past planning — cannot regenerate')

  // Replace: delete all children, insert new ones
  const { error: delError } = await supabase
    .from('articles').delete().eq('pillar_id', pillarId)
  if (delError) throw delError

  const rows = parsed.articles.map((a, i) => ({
    project_id: projectId,
    pillar_id: pillarId,
    tenant_id: membership.tenant_id,
    title: a.title,
    target_keyword: a.target_keyword,
    lsi_keywords: a.lsi_keywords,
    search_intent: a.search_intent,
    word_count_target: a.word_count_target,
    role: a.role,
    position: i,
  }))
  const { error: insError } = await supabase.from('articles').insert(rows)
  if (insError) throw insError

  revalidatePath(`/projects/${projectId}/planning`)
}
