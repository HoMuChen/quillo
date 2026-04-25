'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { throwIfError } from '@/lib/supabase/helpers'
import { encryptJson, decryptJson, toBytea, fromBytea } from '@/lib/crypto/encrypt'
import { ghostClientFromConfig } from '@/lib/ghost/client'
import {
  listShopifyBlogs,
  testShopifyConnection,
  normalizeStoreUrl,
  type ShopifyBlog,
} from '@/lib/shopify/client'

type Platform = 'ghost' | 'shopify'

// --- Shared helpers ----------------------------------------------------------

async function upsertConnection(
  projectId: string,
  platform: Platform,
  name: string,
  ciphertext: string,
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: membership } = await supabase
    .from('tenant_members').select('tenant_id').eq('user_id', user.id).single()
  if (!membership) throw new Error('No tenant')

  const { data: existing } = await supabase
    .from('site_connections')
    .select('id')
    .eq('project_id', projectId)
    .eq('platform', platform)
    .maybeSingle()

  if (existing) {
    throwIfError(
      await supabase
        .from('site_connections')
        .update({ name, config_encrypted: ciphertext })
        .eq('id', existing.id),
    )
  } else {
    throwIfError(
      await supabase.from('site_connections').insert({
        project_id: projectId,
        tenant_id: membership.tenant_id,
        platform,
        name,
        config_encrypted: ciphertext,
      }),
    )
  }

  revalidatePath(`/projects/${projectId}/settings`)
}

async function runConnectionTest<Config>(
  projectId: string,
  platform: Platform,
  probe: (config: Config) => Promise<unknown>,
) {
  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('site_connections')
    .select('id,config_encrypted')
    .eq('project_id', projectId)
    .eq('platform', platform)
    .single()
  if (error || !row) throw new Error(`No ${platform} connection to test`)

  let ok = false
  let errorMessage: string | null = null
  try {
    const config = decryptJson<Config>(fromBytea(row.config_encrypted))
    await probe(config)
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

async function deleteConnection(projectId: string, platform: Platform) {
  const supabase: SupabaseClient = await createClient()
  throwIfError(
    await supabase
      .from('site_connections')
      .delete()
      .eq('project_id', projectId)
      .eq('platform', platform),
  )
  revalidatePath(`/projects/${projectId}/settings`)
}

// --- Ghost -------------------------------------------------------------------

const saveGhostSchema = z.object({
  name: z.string().min(1).max(100),
  apiUrl: z.string().url().refine((u) => u.startsWith('http'), 'Must be http(s)'),
  apiKey: z.string().regex(/^[a-f0-9]{24}:[a-f0-9]{64}$/, 'Invalid Ghost Admin API Key format'),
})

export async function saveGhostConnectionAction(
  projectId: string,
  input: z.infer<typeof saveGhostSchema>,
) {
  const parsed = saveGhostSchema.parse(input)
  const ciphertext = toBytea(encryptJson({ apiUrl: parsed.apiUrl, apiKey: parsed.apiKey }))
  await upsertConnection(projectId, 'ghost', parsed.name, ciphertext)
}

export async function testGhostConnectionAction(projectId: string) {
  return runConnectionTest<{ apiUrl: string; apiKey: string }>(
    projectId,
    'ghost',
    async (config) => {
      const client = ghostClientFromConfig(config)
      await client.site.read()
    },
  )
}

export async function deleteGhostConnectionAction(projectId: string) {
  await deleteConnection(projectId, 'ghost')
}

// --- Shopify -----------------------------------------------------------------

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
  const ciphertext = toBytea(encryptJson({
    storeUrl: normalizeStoreUrl(parsed.storeUrl),
    accessToken: parsed.accessToken,
    blogId: parsed.blogId,
    blogTitle: parsed.blogTitle,
  }))
  await upsertConnection(projectId, 'shopify', parsed.name, ciphertext)
}

export async function testShopifyConnectionAction(projectId: string) {
  return runConnectionTest<{ storeUrl: string; accessToken: string }>(
    projectId,
    'shopify',
    async ({ storeUrl, accessToken }) => {
      await testShopifyConnection(storeUrl, accessToken)
    },
  )
}

export async function deleteShopifyConnectionAction(projectId: string) {
  await deleteConnection(projectId, 'shopify')
}

export async function fetchShopifyBlogsAction(
  storeUrl: string,
  accessToken: string,
): Promise<ShopifyBlog[]> {
  return listShopifyBlogs(normalizeStoreUrl(storeUrl), accessToken)
}
