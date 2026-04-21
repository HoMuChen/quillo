'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { clusterArticlesSchema, type ClusterArticles } from '@/lib/ai/schemas'
import { ghostClientFromRow } from '@/lib/ghost/client'

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

// --- Ghost sync ---

export async function syncGhostArticlesAction(projectId: string) {
  const supabase = await sb()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: membership } = await supabase
    .from('tenant_members').select('tenant_id').eq('user_id', user.id).single()
  if (!membership) throw new Error('No tenant')

  const { data: conn } = await supabase
    .from('site_connections')
    .select('id,config_encrypted')
    .eq('project_id', projectId)
    .eq('platform', 'ghost')
    .maybeSingle()
  if (!conn) throw new Error('No Ghost connection configured')

  // IDs already tracked (published by us OR previously imported)
  const { data: existingTargets } = await supabase
    .from('publish_targets')
    .select('remote_post_id')
    .eq('connection_id', conn.id)
  const trackedIds = new Set(
    (existingTargets ?? []).map((t) => t.remote_post_id).filter(Boolean),
  )

  const ghost = ghostClientFromRow({ config_encrypted: conn.config_encrypted })
  const posts = await ghost.posts.browse({
    limit: 'all',
    status: 'all',
    fields: 'id,title,slug,meta_title,meta_description,excerpt,published_at,url,status',
    include: 'tags',
  } as Record<string, unknown>)

  const newPosts = posts.filter((p) => p.id && !trackedIds.has(p.id))
  if (newPosts.length === 0) {
    revalidatePath(`/projects/${projectId}/planning`)
    return { imported: 0 }
  }

  const { data: lastArticle } = await supabase
    .from('articles')
    .select('position')
    .eq('project_id', projectId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  let nextPos = (lastArticle?.position ?? -1) + 1

  let imported = 0
  for (const post of newPosts) {
    const tagNames = ((post.tags ?? []) as Array<{ name?: string } | string>)
      .map((t) => (typeof t === 'string' ? t : (t.name ?? '')))
      .filter(Boolean)

    const { data: article, error: artErr } = await supabase
      .from('articles')
      .insert({
        project_id: projectId,
        tenant_id: membership.tenant_id,
        pillar_id: null,
        title: post.title ?? '(untitled)',
        slug: post.slug ?? null,
        meta_title: post.meta_title ?? null,
        meta_description: post.meta_description ?? null,
        excerpt: post.excerpt ?? null,
        tags: tagNames,
        status: 'editing',
        position: nextPos++,
        // source is not in generated types yet but exists in DB
        ...({ source: 'ghost' } as Record<string, unknown>),
      })
      .select('id')
      .single()
    if (artErr || !article) continue

    const { error: ptErr } = await supabase.from('publish_targets').insert({
      article_id: article.id,
      connection_id: conn.id,
      tenant_id: membership.tenant_id,
      remote_post_id: post.id ?? null,
      remote_url: (typeof post.url === 'string' ? post.url : null),
      remote_status: post.status ?? null,
      published_at: post.published_at ?? null,
    })
    if (ptErr) {
      // Roll back the article to keep data consistent
      await supabase.from('articles').delete().eq('id', article.id)
      continue
    }
    imported++
  }

  revalidatePath(`/projects/${projectId}/planning`)
  return { imported }
}

// --- Orphan assign ---

export async function assignOrphanToPillarAction(
  projectId: string,
  articleId: string,
  pillarId: string,
) {
  const supabase = await sb()
  const { data: pillarCheck } = await supabase
    .from('pillars')
    .select('id')
    .eq('id', pillarId)
    .eq('project_id', projectId)
    .maybeSingle()
  if (!pillarCheck) throw new Error('Pillar does not belong to this project')
  const { error } = await supabase
    .from('articles')
    .update({ pillar_id: pillarId })
    .eq('id', articleId)
    .eq('project_id', projectId)
    .eq('source', 'ghost')
    .is('pillar_id', null)
  if (error) throw error
  revalidatePath(`/projects/${projectId}/planning`)
}

export async function createPillarAndAssignAction(
  projectId: string,
  articleId: string,
  pillarInput: { title: string; target_keyword?: string | null },
) {
  const supabase = await sb()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: membership } = await supabase
    .from('tenant_members').select('tenant_id').eq('user_id', user.id).single()
  if (!membership) throw new Error('No tenant')

  const { data: last } = await supabase
    .from('pillars').select('position').eq('project_id', projectId)
    .order('position', { ascending: false }).limit(1).maybeSingle()
  const nextPos = (last?.position ?? -1) + 1

  const { data: pillar, error: pillarErr } = await supabase
    .from('pillars')
    .insert({
      project_id: projectId,
      tenant_id: membership.tenant_id,
      title: pillarInput.title,
      target_keyword: pillarInput.target_keyword ?? null,
      position: nextPos,
    })
    .select('id')
    .single()
  if (pillarErr || !pillar) throw pillarErr ?? new Error('Failed to create pillar')

  const { error: assignErr } = await supabase
    .from('articles')
    .update({ pillar_id: pillar.id })
    .eq('id', articleId)
    .eq('project_id', projectId)
  if (assignErr) throw assignErr

  revalidatePath(`/projects/${projectId}/planning`)
  return { pillarId: pillar.id }
}
