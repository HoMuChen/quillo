'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { encryptJson, decryptJson, toBytea, fromBytea } from '@/lib/crypto/encrypt'
import { ghostClientFromConfig } from '@/lib/ghost/client'
import {
  listShopifyBlogs,
  testShopifyConnection,
  normalizeStoreUrl,
  type ShopifyBlog,
} from '@/lib/shopify/client'

const saveSchema = z.object({
  name: z.string().min(1).max(100),
  apiUrl: z.string().url().refine((u) => u.startsWith('http'), 'Must be http(s)'),
  apiKey: z.string().regex(/^[a-f0-9]{24}:[a-f0-9]{64}$/, 'Invalid Ghost Admin API Key format'),
})

export async function saveGhostConnectionAction(
  projectId: string,
  input: z.infer<typeof saveSchema>,
) {
  const parsed = saveSchema.parse(input)
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: membership } = await supabase
    .from('tenant_members').select('tenant_id').eq('user_id', user.id).single()
  if (!membership) throw new Error('No tenant')

  const ciphertext = toBytea(encryptJson({ apiUrl: parsed.apiUrl, apiKey: parsed.apiKey }))

  // Upsert — one ghost connection per project for M1
  const { data: existing } = await supabase
    .from('site_connections')
    .select('id')
    .eq('project_id', projectId)
    .eq('platform', 'ghost')
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('site_connections')
      .update({ name: parsed.name, config_encrypted: ciphertext })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('site_connections').insert({
      project_id: projectId,
      tenant_id: membership.tenant_id,
      platform: 'ghost',
      name: parsed.name,
      config_encrypted: ciphertext,
    })
    if (error) throw error
  }

  revalidatePath(`/projects/${projectId}/settings`)
}

export async function testGhostConnectionAction(projectId: string) {
  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('site_connections')
    .select('id,config_encrypted')
    .eq('project_id', projectId)
    .eq('platform', 'ghost')
    .single()
  if (error || !row) throw new Error('No connection to test')

  let ok = false
  let errorMessage: string | null = null
  try {
    const config = decryptJson<{ apiUrl: string; apiKey: string }>(fromBytea(row.config_encrypted))
    const client = ghostClientFromConfig(config)
    await client.site.read()
    ok = true
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Unknown error'
  }

  const { error: updErr } = await supabase
    .from('site_connections')
    .update({ last_tested_at: new Date().toISOString(), last_test_ok: ok })
    .eq('id', row.id)
  if (updErr) console.error('Could not persist test result', updErr)

  revalidatePath(`/projects/${projectId}/settings`)
  return { ok, error: errorMessage }
}

export async function deleteGhostConnectionAction(projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('site_connections')
    .delete()
    .eq('project_id', projectId)
    .eq('platform', 'ghost')
  if (error) throw error
  revalidatePath(`/projects/${projectId}/settings`)
}

const saveShopifySchema = z.object({
  name: z.string().min(1).max(100),
  storeUrl: z.string().min(1),
  accessToken: z.string().min(1),
  blogId: z.number().int().positive(),
  blogTitle: z.string().min(1),
})

export async function saveShopifyConnectionAction(
  projectId: string,
  input: z.infer<typeof saveShopifySchema>,
) {
  const parsed = saveShopifySchema.parse(input)
  const storeUrl = normalizeStoreUrl(parsed.storeUrl)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: membership } = await supabase
    .from('tenant_members').select('tenant_id').eq('user_id', user.id).single()
  if (!membership) throw new Error('No tenant')

  const ciphertext = toBytea(encryptJson({
    storeUrl,
    accessToken: parsed.accessToken,
    blogId: parsed.blogId,
    blogTitle: parsed.blogTitle,
  }))

  const { data: existing } = await supabase
    .from('site_connections')
    .select('id')
    .eq('project_id', projectId)
    .eq('platform', 'shopify')
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('site_connections')
      .update({ name: parsed.name, config_encrypted: ciphertext })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('site_connections').insert({
      project_id: projectId,
      tenant_id: membership.tenant_id,
      platform: 'shopify',
      name: parsed.name,
      config_encrypted: ciphertext,
    })
    if (error) throw error
  }

  revalidatePath(`/projects/${projectId}/settings`)
}

export async function testShopifyConnectionAction(projectId: string) {
  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('site_connections')
    .select('id,config_encrypted')
    .eq('project_id', projectId)
    .eq('platform', 'shopify')
    .single()
  if (error || !row) throw new Error('No Shopify connection to test')

  let ok = false
  let errorMessage: string | null = null
  try {
    const { storeUrl, accessToken } = decryptJson<{ storeUrl: string; accessToken: string }>(
      fromBytea(row.config_encrypted),
    )
    await testShopifyConnection(storeUrl, accessToken)
    ok = true
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Unknown error'
  }

  await supabase
    .from('site_connections')
    .update({ last_tested_at: new Date().toISOString(), last_test_ok: ok })
    .eq('id', row.id)

  revalidatePath(`/projects/${projectId}/settings`)
  return { ok, error: errorMessage }
}

export async function deleteShopifyConnectionAction(projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('site_connections')
    .delete()
    .eq('project_id', projectId)
    .eq('platform', 'shopify')
  if (error) throw error
  revalidatePath(`/projects/${projectId}/settings`)
}

export async function fetchShopifyBlogsAction(
  storeUrl: string,
  accessToken: string,
): Promise<ShopifyBlog[]> {
  return listShopifyBlogs(normalizeStoreUrl(storeUrl), accessToken)
}
