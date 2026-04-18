'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB
const BUCKET = 'article-images'

export async function getUploadUrlAction(
  articleId: string,
  contentType: string,
  sizeBytes: number,
  kind: 'feature' | 'inline',
) {
  if (!ALLOWED_TYPES.has(contentType)) throw new Error('Unsupported image type')
  if (sizeBytes > MAX_BYTES) throw new Error('Image too large (max 8MB)')

  const supabase = await createClient()
  const { data: article, error } = await supabase
    .from('articles').select('tenant_id, project_id').eq('id', articleId).single()
  if (error || !article) throw new Error('Unauthorized')

  const ext = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1] || 'bin'
  const path = `${article.tenant_id}/${articleId}/${kind}/${randomUUID()}.${ext}`

  const admin = adminClient()
  const { data, error: signErr } = await admin.storage
    .from(BUCKET).createSignedUploadUrl(path)
  if (signErr || !data) throw signErr ?? new Error('sign failed')

  return { path, token: data.token, signedUrl: data.signedUrl }
}

export async function saveImageAction(
  projectId: string,
  articleId: string,
  storagePath: string,
  kind: 'feature' | 'inline',
) {
  const supabase = await createClient()

  // Public URL for the bucket (bucket is public so this works everywhere)
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const publicUrl = `${base}/storage/v1/object/public/${BUCKET}/${storagePath}`

  const { data: article } = await supabase
    .from('articles').select('tenant_id').eq('id', articleId).single()
  if (!article) throw new Error('Unauthorized')

  const { data: row, error } = await supabase
    .from('article_images')
    .insert({
      article_id: articleId,
      tenant_id: article.tenant_id,
      storage_path: storagePath,
      url: publicUrl,
      kind,
    })
    .select('id,url')
    .single()
  if (error || !row) throw error ?? new Error('insert failed')

  if (kind === 'feature') {
    await supabase.from('articles').update({ feature_image_url: publicUrl }).eq('id', articleId)
  }

  revalidatePath(`/projects/${projectId}/articles/${articleId}`)
  return { id: row.id, url: row.url }
}

export async function updateImageMetaAction(
  projectId: string,
  articleId: string,
  imageId: string,
  patch: { alt?: string | null; caption?: string | null },
) {
  const supabase = await createClient()
  const { error } = await supabase.from('article_images').update(patch).eq('id', imageId)
  if (error) throw error
  revalidatePath(`/projects/${projectId}/articles/${articleId}`)
}

export async function clearFeatureImageAction(projectId: string, articleId: string) {
  const supabase = await createClient()
  // Unset on articles
  await supabase.from('articles').update({ feature_image_url: null }).eq('id', articleId)
  // Delete the feature image rows
  await supabase.from('article_images').delete().eq('article_id', articleId).eq('kind', 'feature')
  revalidatePath(`/projects/${projectId}/articles/${articleId}`)
}
