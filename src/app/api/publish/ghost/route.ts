import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { marked } from 'marked'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { ghostClientFromRow } from '@/lib/ghost/client'
import type { GhostPost } from '@tryghost/admin-api'

export const runtime = 'nodejs'
export const maxDuration = 300

const bodySchema = z.object({
  articleId: z.string().uuid(),
  connectionId: z.string().uuid(),
  action: z.enum(['publish', 'draft', 'unpublish']),
  scheduledFor: z.string().datetime().optional(),
})

const BUCKET = 'article-images'

async function fetchImageBuffer(storagePath: string): Promise<Buffer> {
  const admin = adminClient()
  const { data, error } = await admin.storage.from(BUCKET).download(storagePath)
  if (error || !data) throw new Error(`Failed to download ${storagePath}: ${error?.message}`)
  const ab = await data.arrayBuffer()
  return Buffer.from(ab)
}

function replaceUrlInMarkdown(md: string, from: string, to: string): string {
  return md.split(from).join(to)
}

function normalizeTags(tags: string[] | null | undefined): Array<{ name: string }> {
  if (!tags || tags.length === 0) return []
  return tags.map((name) => ({ name }))
}

export async function POST(req: NextRequest) {
  let parsed
  try {
    parsed = bodySchema.parse(await req.json())
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  const supabase = await createClient()

  // --- Load everything ---
  const { data: article, error: artErr } = await supabase
    .from('articles')
    .select('id,project_id,tenant_id,title,slug,excerpt,meta_title,meta_description,canonical_url,feature_image_url,tags,body_markdown')
    .eq('id', parsed.articleId)
    .single()
  if (artErr || !article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

  const { data: conn, error: connErr } = await supabase
    .from('site_connections')
    .select('id,project_id,config_encrypted,platform')
    .eq('id', parsed.connectionId)
    .single()
  if (connErr || !conn || conn.platform !== 'ghost') {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }
  if (conn.project_id !== article.project_id) {
    return NextResponse.json({ error: 'Connection does not belong to article project' }, { status: 403 })
  }

  const { data: images } = await supabase
    .from('article_images')
    .select('id,storage_path,url,alt,kind')
    .eq('article_id', article.id)

  const { data: existingTarget } = await supabase
    .from('publish_targets')
    .select('id,remote_post_id,remote_url,remote_status')
    .eq('article_id', article.id)
    .eq('connection_id', conn.id)
    .maybeSingle()

  const ghost = ghostClientFromRow({ config_encrypted: conn.config_encrypted })

  // --- Log helper ---
  async function writeLog(
    publish_target_id: string,
    action: 'publish' | 'republish' | 'unpublish',
    status: 'success' | 'failure',
    errorMessage: string | null = null,
  ) {
    try {
      await supabase.from('publish_logs').insert({
        publish_target_id,
        tenant_id: article!.tenant_id,
        action,
        status,
        error_message: errorMessage,
      })
    } catch (err) {
      console.error('Could not write publish log', err)
    }
  }

  // --- UNPUBLISH branch ---
  if (parsed.action === 'unpublish') {
    if (!existingTarget) {
      return NextResponse.json({ error: 'Nothing to unpublish' }, { status: 400 })
    }
    try {
      if (existingTarget.remote_post_id) {
        try {
          await ghost.posts.delete({ id: existingTarget.remote_post_id })
        } catch (err) {
          // If Ghost already deleted the post, treat as idempotent
          console.warn('Ghost delete returned error (may be already deleted):', err)
        }
      }
      const { error: updErr } = await supabase
        .from('publish_targets')
        .update({
          remote_status: 'unpublished',
          remote_post_id: null,
          remote_url: null,
          published_at: null,
        })
        .eq('id', existingTarget.id)
      if (updErr) throw updErr

      await writeLog(existingTarget.id, 'unpublish', 'success')
      return NextResponse.json({ ok: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unpublish failed'
      await writeLog(existingTarget.id, 'unpublish', 'failure', msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  // --- PUBLISH / DRAFT branch ---
  // 1. Re-upload images to Ghost, build replacement map
  const imageMap = new Map<string, string>()
  let featureImageUrl: string | null = article.feature_image_url ?? null

  for (const img of images ?? []) {
    try {
      const buf = await fetchImageBuffer(img.storage_path)
      const uploaded = await ghost.images.upload({ file: buf, purpose: 'image', ref: img.id })
      imageMap.set(img.url, uploaded.url)
      if (img.kind === 'feature' && img.url === article.feature_image_url) {
        featureImageUrl = uploaded.url
      }
    } catch (err) {
      console.error('Image upload failed', img.storage_path, err)
      // Continue — fall back to original URL; Ghost may hotlink but we warn in log
    }
  }

  // 2. Replace URLs in markdown body
  let bodyMd = article.body_markdown ?? ''
  for (const [from, to] of imageMap) {
    bodyMd = replaceUrlInMarkdown(bodyMd, from, to)
  }

  // 3. Normalize headings: demote any H1 (# ...) to H2 so the Ghost post
  //    title remains the only H1 on the page.  The AI draft occasionally
  //    opens with a "# Title" line despite the system prompt saying "##".
  const normalizedMd = bodyMd.replace(/^# /gm, '## ')

  // 4. Convert markdown to HTML
  const html = (await marked.parse(normalizedMd, { async: true })) as string

  // 5. Compose Ghost post payload
  const statusValue: GhostPost['status'] = parsed.scheduledFor
    ? 'scheduled'
    : parsed.action === 'publish'
      ? 'published'
      : 'draft'

  const payload: Partial<GhostPost> = {
    title: article.title,
    slug: article.slug || undefined,
    html,
    excerpt: article.excerpt ?? undefined,
    meta_title: article.meta_title ?? null,
    meta_description: article.meta_description ?? null,
    canonical_url: article.canonical_url ?? null,
    feature_image: featureImageUrl ?? null,
    tags: normalizeTags(article.tags),
    status: statusValue,
    published_at: parsed.scheduledFor ?? (parsed.action === 'publish' ? new Date().toISOString() : undefined),
  }

  // 6. Call Ghost: add or edit.
  // - Ghost Admin API rejects edits without a matching updated_at — read the
  //   current post first to get it.
  // - If the stored remote_post_id no longer exists on Ghost (deleted there,
  //   or cleared-but-stale locally), fall through to add instead of surfacing
  //   a confusing "cannot edit post" error.
  let remotePost: GhostPost
  const canEdit =
    !!existingTarget?.remote_post_id && existingTarget.remote_status !== 'unpublished'
  try {
    let current: GhostPost | null = null
    if (canEdit) {
      try {
        current = await ghost.posts.read({ id: existingTarget!.remote_post_id! })
      } catch (err) {
        console.warn('Ghost read returned error, will create a new post:', err)
        current = null
      }
    }
    if (canEdit && current) {
      remotePost = await ghost.posts.edit(
        { ...payload, id: existingTarget!.remote_post_id!, updated_at: current.updated_at },
        { source: 'html' },
      )
    } else {
      remotePost = await ghost.posts.add(payload, { source: 'html' })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ghost API failed'
    if (existingTarget) await writeLog(existingTarget.id, 'republish', 'failure', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // 6. Upsert publish_targets
  const { data: saved, error: saveErr } = await supabase
    .from('publish_targets')
    .upsert(
      {
        id: existingTarget?.id,
        article_id: article.id,
        connection_id: conn.id,
        tenant_id: article.tenant_id,
        remote_post_id: remotePost.id ?? null,
        remote_url: remotePost.url ?? null,
        remote_status: remotePost.status ?? statusValue,
        published_at: remotePost.published_at ?? null,
        scheduled_for: parsed.scheduledFor ?? null,
      },
      { onConflict: 'article_id,connection_id' },
    )
    .select('id')
    .single()

  if (saveErr || !saved) {
    return NextResponse.json(
      { error: saveErr?.message ?? 'could not persist publish target' },
      { status: 500 },
    )
  }

  await writeLog(saved.id, existingTarget ? 'republish' : 'publish', 'success')

  return NextResponse.json({
    ok: true,
    publishTargetId: saved.id,
    remoteUrl: remotePost.url,
    remoteStatus: remotePost.status,
  })
}
