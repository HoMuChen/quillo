import 'server-only'
import { NextResponse } from 'next/server'
import { marked } from 'marked'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type DB = SupabaseClient<Database>
type ArticleRow = Pick<
  Database['public']['Tables']['articles']['Row'],
  | 'id'
  | 'project_id'
  | 'tenant_id'
  | 'title'
  | 'slug'
  | 'excerpt'
  | 'meta_title'
  | 'meta_description'
  | 'canonical_url'
  | 'feature_image_url'
  | 'tags'
  | 'body_markdown'
>
type ConnectionRow = {
  id: string
  project_id: string
  config_encrypted: unknown
  platform: string
}
type TargetRow = {
  id: string
  remote_post_id: string | null
  remote_url: string | null
  remote_status: string | null
}

export type PublishContext = {
  article: ArticleRow
  conn: ConnectionRow
  existingTarget: TargetRow | null
}

export async function loadPublishContext(
  supabase: DB,
  articleId: string,
  connectionId: string,
  expectedPlatform: 'ghost' | 'shopify',
): Promise<PublishContext | NextResponse> {
  const { data: article } = await supabase
    .from('articles')
    .select(
      'id,project_id,tenant_id,title,slug,excerpt,meta_title,meta_description,canonical_url,feature_image_url,tags,body_markdown',
    )
    .eq('id', articleId)
    .single()
  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

  const { data: conn } = await supabase
    .from('site_connections')
    .select('id,project_id,config_encrypted,platform')
    .eq('id', connectionId)
    .single()
  if (!conn || conn.platform !== expectedPlatform) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }
  if (conn.project_id !== article.project_id) {
    return NextResponse.json(
      { error: 'Connection does not belong to article project' },
      { status: 403 },
    )
  }

  const { data: existingTarget } = await supabase
    .from('publish_targets')
    .select('id,remote_post_id,remote_url,remote_status')
    .eq('article_id', article.id)
    .eq('connection_id', conn.id)
    .maybeSingle()

  return { article, conn, existingTarget }
}

export type PublishLogger = (
  publishTargetId: string,
  action: 'publish' | 'republish' | 'unpublish',
  status: 'success' | 'failure',
  errorMessage?: string | null,
) => Promise<void>

export function makePublishLogger(supabase: DB, tenantId: string): PublishLogger {
  return async (publishTargetId, action, status, errorMessage = null) => {
    try {
      await supabase.from('publish_logs').insert({
        publish_target_id: publishTargetId,
        tenant_id: tenantId,
        action,
        status,
        error_message: errorMessage,
      })
    } catch (err) {
      console.error('Could not write publish log', err)
    }
  }
}

// Demote any leftover H1 to H2 so the platform's post title remains the
// only H1 on the rendered page. AI drafts occasionally open with `# Title`
// despite the prompt saying `## ...`.
export async function markdownToHtml(md: string): Promise<string> {
  const normalized = md.replace(/^# /gm, '## ')
  return (await marked.parse(normalized, { async: true })) as string
}

export async function upsertPublishTarget(
  supabase: DB,
  fields: {
    id?: string
    article_id: string
    connection_id: string
    tenant_id: string
    remote_post_id: string | null
    remote_url: string | null
    remote_status: string | null
    published_at: string | null
    scheduled_for?: string | null
  },
) {
  return supabase
    .from('publish_targets')
    .upsert(fields, { onConflict: 'article_id,connection_id' })
    .select('id')
    .single()
}

// Derive articles.status from publish_targets after any publish/unpublish:
// any target with remote_status='published' → 'published', otherwise 'editing'.
// (We assume the caller knows the article already has content.)
export async function syncArticlePublishStatus(supabase: DB, articleId: string) {
  const { data } = await supabase
    .from('publish_targets')
    .select('remote_status')
    .eq('article_id', articleId)
  const isPublished = (data ?? []).some((t) => t.remote_status === 'published')
  await supabase
    .from('articles')
    .update({ status: isPublished ? 'published' : 'editing' })
    .eq('id', articleId)
}
