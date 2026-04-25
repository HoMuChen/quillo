import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  shopifyConfigFromRow,
  createShopifyArticle,
  updateShopifyArticle,
  deleteShopifyArticle,
  upsertShopifyMetafield,
} from '@/lib/shopify/client'
import {
  loadPublishContext,
  makePublishLogger,
  markdownToHtml,
  upsertPublishTarget,
} from '@/lib/publish/helpers'

export const runtime = 'nodejs'
export const maxDuration = 300

const bodySchema = z.object({
  articleId: z.string().uuid(),
  connectionId: z.string().uuid(),
  action: z.enum(['publish', 'draft', 'unpublish']),
})

export async function POST(req: NextRequest) {
  let parsed
  try {
    parsed = bodySchema.parse(await req.json())
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  const supabase = await createClient()
  const ctx = await loadPublishContext(supabase, parsed.articleId, parsed.connectionId, 'shopify')
  if (ctx instanceof NextResponse) return ctx
  const { article, conn, existingTarget } = ctx

  const config = shopifyConfigFromRow({ config_encrypted: conn.config_encrypted })
  const writeLog = makePublishLogger(supabase, article.tenant_id)

  // --- UNPUBLISH branch ---
  if (parsed.action === 'unpublish') {
    if (!existingTarget?.remote_post_id) {
      return NextResponse.json({ error: 'Nothing to unpublish' }, { status: 400 })
    }
    try {
      await deleteShopifyArticle(config, Number(existingTarget.remote_post_id))
      const { error: updErr } = await supabase
        .from('publish_targets')
        .update({ remote_status: 'unpublished', remote_post_id: null, remote_url: null, published_at: null })
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
  const bodyHtml = await markdownToHtml(article.body_markdown ?? '')
  const published = parsed.action === 'publish'
  const tagString = (article.tags ?? []).join(', ')

  const payload = {
    title: article.title,
    body_html: bodyHtml,
    handle: article.slug || undefined,
    excerpt: article.excerpt ?? undefined,
    tags: tagString,
    published,
    published_at: published ? new Date().toISOString() : undefined,
    ...(article.feature_image_url ? { image: { src: article.feature_image_url } } : {}),
  }

  let remoteArticle: { id: number; url?: string; admin_url?: string }
  const canEdit =
    !!existingTarget?.remote_post_id && existingTarget.remote_status !== 'unpublished'

  try {
    if (canEdit) {
      remoteArticle = await updateShopifyArticle(config, Number(existingTarget!.remote_post_id), payload)
    } else {
      remoteArticle = await createShopifyArticle(config, payload)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Shopify API failed'
    if (existingTarget) await writeLog(existingTarget.id, 'republish', 'failure', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Upsert SEO metafields (fire-and-forget errors)
  await Promise.allSettled([
    article.meta_title
      ? upsertShopifyMetafield(config, remoteArticle.id, 'title_tag', article.meta_title)
      : Promise.resolve(),
    article.meta_description
      ? upsertShopifyMetafield(config, remoteArticle.id, 'description_tag', article.meta_description)
      : Promise.resolve(),
    article.canonical_url
      ? upsertShopifyMetafield(config, remoteArticle.id, 'canonical_url', article.canonical_url)
      : Promise.resolve(),
  ])

  const remoteUrl = remoteArticle.url ?? null
  const remoteStatus = published ? 'published' : 'draft'

  const { data: saved, error: saveErr } = await upsertPublishTarget(supabase, {
    id: existingTarget?.id,
    article_id: article.id,
    connection_id: conn.id,
    tenant_id: article.tenant_id,
    remote_post_id: String(remoteArticle.id),
    remote_url: remoteUrl,
    remote_status: remoteStatus,
    published_at: published ? new Date().toISOString() : null,
  })

  if (saveErr || !saved) {
    return NextResponse.json(
      { error: saveErr?.message ?? 'could not persist publish target' },
      { status: 500 },
    )
  }

  await writeLog(saved.id, existingTarget ? 'republish' : 'publish', 'success')

  return NextResponse.json({ ok: true, publishTargetId: saved.id, remoteUrl, remoteStatus })
}
