# Shopify Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Shopify as a publish and import platform alongside Ghost, with a "pick one platform per article" UX.

**Architecture:** Mirror the Ghost pattern exactly — encrypted credentials in `site_connections`, publish via a new `/api/publish/shopify` route, import via `syncShopifyArticlesAction`. The article page fetches all connections and passes them to the screen; the UI shows a platform tab/selector when both are connected. No Shopify SDK — use plain `fetch` against the Admin REST API 2024-01.

**Tech Stack:** Next.js App Router, Supabase, `marked` (MD→HTML), `@tiptap/html` (HTML→Tiptap for import), next-intl, Shopify Admin REST API 2024-01 (plain fetch).

---

## Codebase context

Read these before starting each task:

- Ghost connection form: `src/app/[locale]/(app)/projects/[projectId]/settings/_connection-form.tsx`
- Settings actions: `src/app/[locale]/(app)/projects/[projectId]/settings/settings-actions.ts`
- Settings page: `src/app/[locale]/(app)/projects/[projectId]/settings/page.tsx`
- Ghost publish route: `src/app/api/publish/ghost/route.ts`
- Ghost sync: `src/app/[locale]/(app)/projects/[projectId]/planning/planning-actions.ts` (lines 228–330)
- Article page: `src/app/[locale]/(focus)/projects/[projectId]/articles/[articleId]/page.tsx`
- Article screen: `src/app/[locale]/(focus)/projects/[projectId]/articles/[articleId]/_article-screen.tsx`

---

## Task 1: i18n keys

**Files:**
- Modify: `messages/en/publish.json`
- Modify: `messages/zh-TW/publish.json`
- Modify: `messages/en/planning.json`
- Modify: `messages/zh-TW/planning.json`

Add these keys to `messages/en/publish.json`:

```json
"shopify_title": "Shopify",
"store_url": "Store URL",
"store_url_help": "Your myshopify domain, e.g. my-store.myshopify.com",
"access_token": "Admin API Access Token",
"access_token_help": "In Shopify admin → Apps → Develop apps → create an app → Admin API access token (starts with shpat_)",
"default_blog": "Default blog",
"default_blog_help": "Articles will be published to this blog",
"select_blog": "Select a blog…",
"fetch_blogs": "Load blogs",
"no_connection_shopify_title": "No Shopify connection yet",
"no_connection_shopify_body": "Set up a Shopify connection in settings to publish this article.",
"tab_subtitle_shopify": "Publish this article to your Shopify blog",
"publish_platform": "Publish to {platform}"
```

Add to `messages/zh-TW/publish.json`:

```json
"shopify_title": "Shopify",
"store_url": "Store URL",
"store_url_help": "你的 myshopify 網域，例如 my-store.myshopify.com",
"access_token": "Admin API Access Token",
"access_token_help": "Shopify 後台 → Apps → Develop apps → 建立 app → Admin API access token（開頭為 shpat_）",
"default_blog": "預設 Blog",
"default_blog_help": "文章將發布到此 Blog",
"select_blog": "選擇 Blog…",
"fetch_blogs": "載入 Blog 列表",
"no_connection_shopify_title": "還沒有 Shopify 連線",
"no_connection_shopify_body": "請先在設定中建立 Shopify 連線，才能發布文章",
"tab_subtitle_shopify": "把這篇文章發布到 Shopify Blog",
"publish_platform": "發布到 {platform}"
```

Add to `messages/en/planning.json`:

```json
"sync_shopify": "Sync from Shopify",
"sync_shopify_done": "Imported {count} from Shopify"
```

Add to `messages/zh-TW/planning.json`:

```json
"sync_shopify": "從 Shopify 同步",
"sync_shopify_done": "從 Shopify 匯入 {count} 篇"
```

**Step 1:** Add the keys above to all four files.

**Step 2:** Verify TypeScript is happy:
```bash
cd /Users/largitdata/project/quillo.dev/quillo && npx tsc --noEmit 2>&1 | head -20
```

**Step 3:** Commit:
```bash
git add messages/ && git commit -m "feat(i18n): add Shopify integration strings"
```

---

## Task 2: Shopify client lib

**Files:**
- Create: `src/lib/shopify/client.ts`

This is a thin fetch wrapper around the Shopify Admin REST API 2024-01.

```typescript
import 'server-only'
import { decryptJson, fromBytea } from '@/lib/crypto/encrypt'

export type ShopifyConfig = {
  storeUrl: string     // https://xxx.myshopify.com
  accessToken: string
  blogId: number
  blogTitle: string
}

export type ShopifyBlog = { id: number; title: string }

export type ShopifyArticle = {
  id: number
  title: string
  body_html: string
  handle: string
  excerpt: string | null
  tags: string
  published: boolean
  published_at: string | null
  image: { src: string } | null
}

function shopifyFetch(
  storeUrl: string,
  accessToken: string,
  path: string,
  options: RequestInit = {},
) {
  return fetch(`${storeUrl}/admin/api/2024-01${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
      ...options.headers,
    },
  })
}

export async function listShopifyBlogs(
  storeUrl: string,
  accessToken: string,
): Promise<ShopifyBlog[]> {
  const res = await shopifyFetch(storeUrl, accessToken, '/blogs.json')
  if (!res.ok) throw new Error(`Shopify blogs fetch failed: ${res.status}`)
  const json = await res.json() as { blogs: ShopifyBlog[] }
  return json.blogs
}

export async function testShopifyConnection(
  storeUrl: string,
  accessToken: string,
): Promise<void> {
  const res = await shopifyFetch(storeUrl, accessToken, '/shop.json')
  if (!res.ok) throw new Error(`Shopify connection test failed: ${res.status}`)
}

export async function createShopifyArticle(
  config: ShopifyConfig,
  payload: Partial<ShopifyArticle>,
): Promise<ShopifyArticle> {
  const res = await shopifyFetch(
    config.storeUrl,
    config.accessToken,
    `/blogs/${config.blogId}/articles.json`,
    { method: 'POST', body: JSON.stringify({ article: payload }) },
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Shopify create article failed: ${res.status} ${err}`)
  }
  const json = await res.json() as { article: ShopifyArticle }
  return json.article
}

export async function updateShopifyArticle(
  config: ShopifyConfig,
  articleId: number,
  payload: Partial<ShopifyArticle>,
): Promise<ShopifyArticle> {
  const res = await shopifyFetch(
    config.storeUrl,
    config.accessToken,
    `/blogs/${config.blogId}/articles/${articleId}.json`,
    { method: 'PUT', body: JSON.stringify({ article: payload }) },
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Shopify update article failed: ${res.status} ${err}`)
  }
  const json = await res.json() as { article: ShopifyArticle }
  return json.article
}

export async function deleteShopifyArticle(
  config: ShopifyConfig,
  articleId: number,
): Promise<void> {
  const res = await shopifyFetch(
    config.storeUrl,
    config.accessToken,
    `/blogs/${config.blogId}/articles/${articleId}.json`,
    { method: 'DELETE' },
  )
  if (!res.ok && res.status !== 404) {
    throw new Error(`Shopify delete article failed: ${res.status}`)
  }
}

export async function upsertShopifyMetafield(
  config: ShopifyConfig,
  articleId: number,
  key: string,
  value: string,
): Promise<void> {
  if (!value) return
  await shopifyFetch(
    config.storeUrl,
    config.accessToken,
    `/blogs/${config.blogId}/articles/${articleId}/metafields.json`,
    {
      method: 'POST',
      body: JSON.stringify({
        metafield: { namespace: 'global', key, value, type: 'single_line_text_field' },
      }),
    },
  )
}

export async function listShopifyArticles(
  config: ShopifyConfig,
): Promise<ShopifyArticle[]> {
  const res = await shopifyFetch(
    config.storeUrl,
    config.accessToken,
    `/blogs/${config.blogId}/articles.json?limit=250&status=any`,
  )
  if (!res.ok) throw new Error(`Shopify articles fetch failed: ${res.status}`)
  const json = await res.json() as { articles: ShopifyArticle[] }
  return json.articles
}

export function shopifyConfigFromRow(row: { config_encrypted: unknown }): ShopifyConfig {
  return decryptJson<ShopifyConfig>(fromBytea(row.config_encrypted))
}

export function normalizeStoreUrl(input: string): string {
  const s = input.trim().replace(/\/$/, '')
  if (s.startsWith('http')) return s
  return `https://${s}`
}
```

**Step 1:** Create the file with the code above.

**Step 2:** Type-check:
```bash
cd /Users/largitdata/project/quillo.dev/quillo && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

**Step 3:** Commit:
```bash
git add src/lib/shopify/ && git commit -m "feat(shopify): add Shopify client lib"
```

---

## Task 3: Shopify settings actions

**Files:**
- Modify: `src/app/[locale]/(app)/projects/[projectId]/settings/settings-actions.ts`

Add these four server actions after the existing Ghost actions. The pattern is identical — validate, encrypt, upsert `site_connections` with `platform = 'shopify'`.

```typescript
// Add at the top of the file (import section):
import {
  listShopifyBlogs,
  testShopifyConnection,
  normalizeStoreUrl,
  type ShopifyBlog,
} from '@/lib/shopify/client'

// Add these actions after deleteGhostConnectionAction:

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
```

**Step 1:** Add the import at the top of the file.

**Step 2:** Append the four actions to the file.

**Step 3:** Type-check:
```bash
cd /Users/largitdata/project/quillo.dev/quillo && npx tsc --noEmit 2>&1 | head -20
```

**Step 4:** Commit:
```bash
git add src/app/\[locale\]/\(app\)/projects/\[projectId\]/settings/settings-actions.ts && git commit -m "feat(shopify): add Shopify settings server actions"
```

---

## Task 4: Shopify connection form UI

**Files:**
- Create: `src/app/[locale]/(app)/projects/[projectId]/settings/_shopify-connection-form.tsx`

Mirrors `_connection-form.tsx` closely. Key difference: after entering Store URL + Access Token, user clicks "Load blogs" (calls `fetchShopifyBlogsAction`), then picks a blog from a dropdown, then saves.

```typescript
'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Check, X, Trash2, RefreshCw } from 'lucide-react'
import {
  saveShopifyConnectionAction,
  testShopifyConnectionAction,
  deleteShopifyConnectionAction,
  fetchShopifyBlogsAction,
} from './settings-actions'
import { syncShopifyArticlesAction } from '../planning/planning-actions'

type Blog = { id: number; title: string }

type Initial = {
  id: string
  name: string
  storeUrl: string | null
  blogTitle: string | null
  last_tested_at: string | null
  last_test_ok: boolean | null
} | null

export function ShopifyConnectionForm({
  projectId,
  initial,
}: {
  projectId: string
  initial: Initial
}) {
  const t = useTranslations('publish')
  const tp = useTranslations('planning')
  const router = useRouter()

  const [name, setName] = useState(initial?.name ?? '')
  const [storeUrl, setStoreUrl] = useState(initial?.storeUrl ?? '')
  const [accessToken, setAccessToken] = useState('')
  const [blogs, setBlogs] = useState<Blog[]>([])
  const [selectedBlogId, setSelectedBlogId] = useState<number | null>(null)
  const [selectedBlogTitle, setSelectedBlogTitle] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; error: string | null } | null>(null)
  const [editing, setEditing] = useState(!initial)
  const [savePending, startSave] = useTransition()
  const [testPending, startTest] = useTransition()
  const [deletePending, startDelete] = useTransition()
  const [syncPending, startSync] = useTransition()
  const [blogsPending, startBlogsLoad] = useTransition()

  function loadBlogs() {
    setError(null)
    startBlogsLoad(async () => {
      try {
        const result = await fetchShopifyBlogsAction(storeUrl, accessToken)
        setBlogs(result)
        if (result.length > 0) {
          setSelectedBlogId(result[0].id)
          setSelectedBlogTitle(result[0].title)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load blogs')
      }
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedBlogId) { setError('Please select a blog first'); return }
    setError(null); setMessage(null)
    startSave(async () => {
      try {
        await saveShopifyConnectionAction(projectId, {
          name,
          storeUrl,
          accessToken,
          blogId: selectedBlogId,
          blogTitle: selectedBlogTitle,
        })
        setMessage(t('saved'))
        setEditing(false)
        setAccessToken('')
      } catch (err) {
        setError(err instanceof Error ? err.message : t('save_error'))
      }
    })
  }

  function test() {
    setTestResult(null)
    startTest(async () => {
      try {
        const result = await testShopifyConnectionAction(projectId)
        setTestResult(result)
      } catch (err) {
        setTestResult({ ok: false, error: err instanceof Error ? err.message : 'error' })
      }
    })
  }

  function remove() {
    startDelete(async () => {
      try {
        await deleteShopifyConnectionAction(projectId)
        setName(''); setStoreUrl(''); setAccessToken('')
        setBlogs([]); setSelectedBlogId(null); setEditing(true)
        setMessage(t('deleted'))
      } catch (err) {
        setError(err instanceof Error ? err.message : t('save_error'))
      }
    })
  }

  function sync() {
    setSyncMessage(null)
    startSync(async () => {
      try {
        const result = await syncShopifyArticlesAction(projectId)
        setSyncMessage({ ok: true, text: tp('sync_shopify_done', { count: result.imported }) })
        router.refresh()
      } catch (err) {
        setSyncMessage({ ok: false, text: err instanceof Error ? err.message : 'Error' })
      }
    })
  }

  return (
    <section className="space-y-4">
      <h2 className="font-sans font-semibold text-[18px] text-ink tracking-tight">{t('shopify_title')}</h2>

      {initial && !editing ? (
        <div className="rounded-xl bg-white p-5 shadow-sh-1 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[14px] text-ink font-medium">{initial.name}</div>
              <div className="text-[11px] text-ink-4 mt-0.5">
                {initial.blogTitle && <span className="mr-2">{initial.blogTitle}</span>}
                {initial.last_tested_at ? (
                  <>
                    <LastTestBadge ok={initial.last_test_ok} />{' '}
                    <span className="font-mono">{new Date(initial.last_tested_at).toISOString().slice(0, 16).replace('T', ' ')}</span>
                  </>
                ) : t('never_tested')}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="default" size="sm" onClick={sync} disabled={syncPending}>
                <RefreshCw className={cn('w-3 h-3 mr-1', syncPending && 'animate-spin')} />
                {syncPending ? tp('syncing') : tp('sync_shopify')}
              </Button>
              <Button variant="default" size="sm" onClick={test} disabled={testPending}>
                {testPending ? '...' : t('test_connection')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>{t('replace')}</Button>
              <Button variant="ghost" size="sm" onClick={remove} disabled={deletePending}>
                <Trash2 className="w-3 h-3 mr-1" /> {t('delete')}
              </Button>
            </div>
          </div>
          {syncMessage && (
            <p className={cn('text-[12px]', syncMessage.ok ? 'text-sage-ink' : 'text-rust')}>
              {syncMessage.ok
                ? <><Check className="inline w-3 h-3 mr-1" />{syncMessage.text}</>
                : <><X className="inline w-3 h-3 mr-1" />{syncMessage.text}</>}
            </p>
          )}
          {testResult && (
            <p className={cn('text-[12px]', testResult.ok ? 'text-sage' : 'text-rust')}>
              {testResult.ok
                ? <><Check className="inline w-3 h-3 mr-1" />{t('test_success')}</>
                : <><X className="inline w-3 h-3 mr-1" />{testResult.error ?? t('test_failed')}</>}
            </p>
          )}
          {message && <p className="text-[12px] text-sage">{message}</p>}
          {error && <p className="text-[12px] text-rust">{error}</p>}
        </div>
      ) : (
        <form onSubmit={save} className="rounded-xl bg-white p-5 shadow-sh-1 space-y-4">
          <div className="space-y-1.5">
            <Label>{t('conn_name')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder={t('conn_name_placeholder')} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('store_url')}</Label>
            <Input
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              required
              placeholder="my-store.myshopify.com"
            />
            <p className="text-[11px] text-ink-4">{t('store_url_help')}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t('access_token')}</Label>
            <Input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              required
              placeholder="shpat_..."
              autoComplete="off"
            />
            <p className="text-[11px] text-ink-4">{t('access_token_help')}</p>
          </div>

          {/* Blog picker — load then select */}
          <div className="space-y-1.5">
            <Label>{t('default_blog')}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={loadBlogs}
                disabled={!storeUrl || !accessToken || blogsPending}
              >
                {blogsPending ? '...' : t('fetch_blogs')}
              </Button>
              {blogs.length > 0 && (
                <select
                  className="flex-1 rounded-lg border border-rule bg-white px-3 py-2 text-[14px] text-ink focus:outline-none focus:border-ink-3"
                  value={selectedBlogId ?? ''}
                  onChange={(e) => {
                    const id = Number(e.target.value)
                    setSelectedBlogId(id)
                    setSelectedBlogTitle(blogs.find((b) => b.id === id)?.title ?? '')
                  }}
                >
                  {blogs.map((b) => (
                    <option key={b.id} value={b.id}>{b.title}</option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-[11px] text-ink-4">{t('default_blog_help')}</p>
          </div>

          {error && <p className="text-[12px] text-rust">{error}</p>}
          {message && <p className="text-[12px] text-sage">{message}</p>}
          <div className="flex justify-end gap-2">
            {initial && (
              <Button type="button" variant="ghost" onClick={() => { setEditing(false); setAccessToken(''); setBlogs([]) }} disabled={savePending}>
                {t('cancel')}
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={savePending || !selectedBlogId}>
              {savePending ? '...' : t('save')}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}

function LastTestBadge({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="text-ink-4">—</span>
  return ok
    ? <span className="text-sage inline-flex items-center gap-1"><Check className="w-3 h-3" /> ok</span>
    : <span className="text-rust inline-flex items-center gap-1"><X className="w-3 h-3" /> failed</span>
}
```

**Step 1:** Create the file.

**Step 2:** Type-check:
```bash
cd /Users/largitdata/project/quillo.dev/quillo && npx tsc --noEmit 2>&1 | head -20
```

**Step 3:** Commit:
```bash
git add src/app/\[locale\]/\(app\)/projects/\[projectId\]/settings/_shopify-connection-form.tsx && git commit -m "feat(shopify): add Shopify connection form UI"
```

---

## Task 5: Settings page — add Shopify card

**Files:**
- Modify: `src/app/[locale]/(app)/projects/[projectId]/settings/page.tsx`

Currently only fetches Ghost. Extend to also fetch the Shopify connection in parallel, then render both cards.

Replace the entire file content with:

```typescript
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { decryptJson, fromBytea } from '@/lib/crypto/encrypt'
import { ConnectionForm } from './_connection-form'
import { ShopifyConnectionForm } from './_shopify-connection-form'

type Props = { params: Promise<{ locale: string; projectId: string }> }

export default async function SettingsPage({ params }: Props) {
  const { locale, projectId } = await params
  setRequestLocale(locale)
  const t = await getTranslations('publish')

  const supabase = await createClient()
  const { data: project } = await supabase
    .from('projects').select('id,name').eq('id', projectId).single()
  if (!project) notFound()

  const [{ data: ghostConn }, { data: shopifyConn }] = await Promise.all([
    supabase
      .from('site_connections')
      .select('id,name,platform,last_tested_at,last_test_ok,config_encrypted')
      .eq('project_id', projectId)
      .eq('platform', 'ghost')
      .maybeSingle(),
    supabase
      .from('site_connections')
      .select('id,name,platform,last_tested_at,last_test_ok,config_encrypted')
      .eq('project_id', projectId)
      .eq('platform', 'shopify')
      .maybeSingle(),
  ])

  let ghostApiUrl: string | null = null
  if (ghostConn?.config_encrypted) {
    try {
      const cfg = decryptJson<{ apiUrl: string; apiKey: string }>(fromBytea(ghostConn.config_encrypted))
      ghostApiUrl = cfg.apiUrl
    } catch (err) {
      console.error('decrypt ghost config', err)
    }
  }

  let shopifyInitial: {
    id: string; name: string; storeUrl: string | null; blogTitle: string | null;
    last_tested_at: string | null; last_test_ok: boolean | null
  } | null = null
  if (shopifyConn?.config_encrypted) {
    try {
      const cfg = decryptJson<{ storeUrl: string; blogTitle: string }>(fromBytea(shopifyConn.config_encrypted))
      shopifyInitial = {
        id: shopifyConn.id,
        name: shopifyConn.name,
        storeUrl: cfg.storeUrl,
        blogTitle: cfg.blogTitle,
        last_tested_at: shopifyConn.last_tested_at,
        last_test_ok: shopifyConn.last_test_ok,
      }
    } catch (err) {
      console.error('decrypt shopify config', err)
    }
  }

  return (
    <div className="space-y-10 max-w-2xl">
      <header>
        <h1 className="font-serif italic text-[32px] text-ink leading-tight">{t('settings_title')}</h1>
        <p className="text-[12px] text-ink-3 mt-1">{t('settings_subtitle')}</p>
      </header>
      <ConnectionForm
        projectId={projectId}
        initial={ghostConn ? {
          id: ghostConn.id,
          name: ghostConn.name,
          last_tested_at: ghostConn.last_tested_at,
          last_test_ok: ghostConn.last_test_ok,
          apiUrl: ghostApiUrl,
        } : null}
      />
      <ShopifyConnectionForm
        projectId={projectId}
        initial={shopifyInitial}
      />
    </div>
  )
}
```

**Step 1:** Replace the settings page with the code above.

**Step 2:** Type-check:
```bash
cd /Users/largitdata/project/quillo.dev/quillo && npx tsc --noEmit 2>&1 | head -20
```

**Step 3:** Commit:
```bash
git add src/app/\[locale\]/\(app\)/projects/\[projectId\]/settings/page.tsx && git commit -m "feat(shopify): show Ghost + Shopify cards in settings page"
```

---

## Task 6: Shopify publish API route

**Files:**
- Create: `src/app/api/publish/shopify/route.ts`

Mirrors `/api/publish/ghost/route.ts`. Key differences:
- No image re-upload (keep Supabase CDN URLs)
- Feature image via `article.image.src`
- Tags as comma-separated string
- SEO via metafields after create/update
- Unpublish = update `published: false` (not delete)

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { marked } from 'marked'
import { createClient } from '@/lib/supabase/server'
import {
  shopifyConfigFromRow,
  createShopifyArticle,
  updateShopifyArticle,
  deleteShopifyArticle,
  upsertShopifyMetafield,
} from '@/lib/shopify/client'

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
  if (connErr || !conn || conn.platform !== 'shopify') {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }
  if (conn.project_id !== article.project_id) {
    return NextResponse.json({ error: 'Connection does not belong to article project' }, { status: 403 })
  }

  const { data: existingTarget } = await supabase
    .from('publish_targets')
    .select('id,remote_post_id,remote_url,remote_status')
    .eq('article_id', article.id)
    .eq('connection_id', conn.id)
    .maybeSingle()

  const config = shopifyConfigFromRow({ config_encrypted: conn.config_encrypted })

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
      if (existingTarget) await writeLog(existingTarget.id, 'unpublish', 'failure', msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  // --- PUBLISH / DRAFT branch ---
  const normalizedMd = (article.body_markdown ?? '').replace(/^# /gm, '## ')
  const bodyHtml = (await marked.parse(normalizedMd, { async: true })) as string

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

  // Build remote URL: Shopify articles have a url like /blogs/{handle}/articles/{handle}
  const remoteUrl = remoteArticle.url ?? null
  const remoteStatus = published ? 'published' : 'draft'

  const { data: saved, error: saveErr } = await supabase
    .from('publish_targets')
    .upsert(
      {
        id: existingTarget?.id,
        article_id: article.id,
        connection_id: conn.id,
        tenant_id: article.tenant_id,
        remote_post_id: String(remoteArticle.id),
        remote_url: remoteUrl,
        remote_status: remoteStatus,
        published_at: published ? new Date().toISOString() : null,
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

  return NextResponse.json({ ok: true, publishTargetId: saved.id, remoteUrl, remoteStatus })
}
```

**Step 1:** Create `src/app/api/publish/shopify/route.ts` with the code above.

**Step 2:** Type-check:
```bash
cd /Users/largitdata/project/quillo.dev/quillo && npx tsc --noEmit 2>&1 | head -20
```

**Step 3:** Commit:
```bash
git add src/app/api/publish/shopify/ && git commit -m "feat(shopify): add Shopify publish API route"
```

---

## Task 7: Shopify sync (import) action

**Files:**
- Modify: `src/app/[locale]/(app)/projects/[projectId]/planning/planning-actions.ts`

Add this import at the top of the file:

```typescript
import { shopifyConfigFromRow, listShopifyArticles } from '@/lib/shopify/client'
```

Then append `syncShopifyArticlesAction` after `syncGhostArticlesAction`. The logic mirrors Ghost's sync exactly, but uses the Shopify client:

```typescript
export async function syncShopifyArticlesAction(projectId: string) {
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
    .eq('platform', 'shopify')
    .maybeSingle()
  if (!conn) throw new Error('No Shopify connection configured')

  const { data: existingTargets } = await supabase
    .from('publish_targets')
    .select('remote_post_id')
    .eq('connection_id', conn.id)
  const trackedIds = new Set(
    (existingTargets ?? []).map((t) => t.remote_post_id).filter(Boolean),
  )

  const config = shopifyConfigFromRow({ config_encrypted: conn.config_encrypted })
  const articles = await listShopifyArticles(config)

  const newArticles = articles.filter((a) => a.id && !trackedIds.has(String(a.id)))
  if (newArticles.length === 0) {
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
  for (const post of newArticles) {
    const tagNames = post.tags
      ? post.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : []

    const { data: article, error: artErr } = await supabase
      .from('articles')
      .insert({
        project_id: projectId,
        tenant_id: membership.tenant_id,
        pillar_id: null,
        title: post.title ?? '(untitled)',
        slug: post.handle ?? null,
        excerpt: post.excerpt ?? null,
        body_tiptap: post.body_html
          ? generateJSON(post.body_html, [StarterKit, TiptapImage, TiptapLink])
          : null,
        tags: tagNames,
        status: 'draft_ready',
        position: nextPos++,
        ...({ source: 'shopify' } as Record<string, unknown>),
      })
      .select('id')
      .single()
    if (artErr || !article) continue

    const remoteUrl = post.handle
      ? `${config.storeUrl}/blogs/${config.blogTitle.toLowerCase().replace(/\s+/g, '-')}/${post.handle}`
      : null

    await supabase.from('publish_targets').insert({
      article_id: article.id,
      connection_id: conn.id,
      tenant_id: membership.tenant_id,
      remote_post_id: String(post.id),
      remote_url: remoteUrl,
      remote_status: post.published ? 'published' : 'draft',
      published_at: post.published_at ?? null,
    })
    imported++
  }

  revalidatePath(`/projects/${projectId}/planning`)
  return { imported }
}
```

**Step 1:** Add the import to the top of planning-actions.ts.

**Step 2:** Append `syncShopifyArticlesAction` to the file.

**Step 3:** Type-check:
```bash
cd /Users/largitdata/project/quillo.dev/quillo && npx tsc --noEmit 2>&1 | head -20
```

**Step 4:** Commit:
```bash
git add src/app/\[locale\]/\(app\)/projects/\[projectId\]/planning/planning-actions.ts && git commit -m "feat(shopify): add syncShopifyArticlesAction"
```

---

## Task 8: Article page + screen — multi-connection support

**Files:**
- Modify: `src/app/[locale]/(focus)/projects/[projectId]/articles/[articleId]/page.tsx`
- Modify: `src/app/[locale]/(focus)/projects/[projectId]/articles/[articleId]/_article-screen.tsx`

### 8a — Update `page.tsx`

Replace the Ghost-only connection fetch with a fetch for all connections:

```typescript
// Replace the existing connection/target/logs fetch block (lines 60-89) with:

  // Fetch all connections for this project (ghost + shopify)
  const { data: connections } = await supabase
    .from('site_connections')
    .select('id,name,platform')
    .eq('project_id', projectId)
    .in('platform', ['ghost', 'shopify'])

  const connList = connections ?? []

  // For each connection, fetch the publish_target and logs
  const connData = await Promise.all(
    connList.map(async (conn) => {
      const { data: target } = await supabase
        .from('publish_targets')
        .select('id,remote_post_id,remote_url,remote_status,published_at,scheduled_for')
        .eq('article_id', articleId)
        .eq('connection_id', conn.id)
        .maybeSingle()

      const { data: logs } = target
        ? await supabase
            .from('publish_logs')
            .select('id,action,status,error_message,created_at')
            .eq('publish_target_id', target.id)
            .order('created_at', { ascending: false })
            .limit(10)
        : { data: [] as Array<{ id: string; action: string; status: string; error_message: string | null; created_at: string }> }

      return { connection: conn, target: target ?? null, logs: logs ?? [] }
    }),
  )
```

Then update the `<ArticleScreen>` props — replace `connection`, `target`, `logs` props with `connections={connData}`:

```typescript
  return (
    <ArticleScreen
      projectId={projectId}
      articleId={articleId}
      locale={locale}
      article={{ ... }}  // unchanged
      pillar={...}       // unchanged
      connections={connData}
      featureImageSlot={featureImageSlot}
      settingsSlot={settingsSlot}
    >
      {hasBody ? <EditorTab ... /> : <InterviewTab ... />}
    </ArticleScreen>
  )
```

### 8b — Update `_article-screen.tsx`

**Type changes:**

```typescript
type ConnectionWithTarget = {
  connection: {
    id: string
    name: string
    platform: string
  }
  target: Target
  logs: Log[]
}
```

Replace the old `Connection = { id; name; platform } | null` type and the `connection: Connection`, `target: Target`, `logs: Log[]` props in `ArticleScreen` with:

```typescript
  connections: ConnectionWithTarget[]
```

**In `ArticleScreen`:** destructure `connections` and pass to children.

**`CornerRight` changes:**

The `run()` function must become platform-aware. Replace the hardcoded `/api/publish/ghost` with dynamic routing based on `connection.platform`. If there are two connections, `CornerRight` shows a simple platform selector (tabs) above the publish buttons.

```typescript
// At top of CornerRight, pick active connection from state:
const [activePlatform, setActivePlatform] = useState<string>(
  connections[0]?.connection.platform ?? 'ghost'
)
const activeConn = connections.find((c) => c.connection.platform === activePlatform)

function run(action: 'publish' | 'draft' | 'unpublish') {
  if (!activeConn) return
  startTransition(async () => {
    try {
      const res = await fetch(`/api/publish/${activeConn.connection.platform}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          articleId,
          connectionId: activeConn.connection.id,
          action,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'publish failed')
      router.refresh()
    } catch (err) {
      console.error(err)
    }
  })
}
```

If `connections.length > 1`, render platform tabs before the publish buttons:

```tsx
{connections.length > 1 && (
  <div className="flex gap-3 pointer-events-auto">
    {connections.map((c) => (
      <button
        key={c.connection.platform}
        type="button"
        onClick={() => setActivePlatform(c.connection.platform)}
        className={cn(
          'text-[11px] uppercase tracking-[0.1em] cursor-pointer transition-colors',
          activePlatform === c.connection.platform ? 'text-ink font-medium' : 'text-ink-4 hover:text-ink',
        )}
      >
        {c.connection.platform}
      </button>
    ))}
  </div>
)}
```

**`SettingsDrawer` changes:**

Replace the single `connection` / `target` / `logs` props with `connections: ConnectionWithTarget[]`. Show one publish section per connected platform inside the drawer:

```tsx
{connections.map(({ connection, target, logs }) => (
  <section key={connection.id} className="p-5 border-t border-rule space-y-3">
    <h3 className="font-sans font-semibold text-[13px] text-ink capitalize">{connection.platform}</h3>
    {/* same publish status / logs rendering as before, using this connection's target + logs */}
  </section>
))}
```

**CornerLeft** still shows a "view live" link — use the active platform's target URL.

**Step 1:** Update `page.tsx` to fetch `connections` array and pass as `connections={connData}`.

**Step 2:** Update `_article-screen.tsx`:
- Add `ConnectionWithTarget` type
- Change `ArticleScreen` prop from `connection/target/logs` → `connections: ConnectionWithTarget[]`
- Update `CornerRight` with platform state + dynamic fetch URL + optional platform tabs
- Update `SettingsDrawer` to render per-platform sections
- Update `CornerLeft` to use the first published target's URL

**Step 3:** Type-check:
```bash
cd /Users/largitdata/project/quillo.dev/quillo && npx tsc --noEmit 2>&1 | head -30
```
Fix all errors before committing.

**Step 4:** Commit:
```bash
git add src/app/\[locale\]/\(focus\)/projects/\[projectId\]/articles/\[articleId\]/ && git commit -m "feat(shopify): multi-connection article screen (Ghost + Shopify)"
```

---

## Task 9: End-to-end verification

No automated tests — verify manually.

**Checklist:**

1. Settings page loads without error — Ghost card still shows, Shopify card shows below it.
2. Enter a Shopify store URL + access token → click "Load blogs" → blog list appears → select → Save → connected state card shows.
3. Click "Test connection" → green ✓.
4. Go to an article with a body → top-right shows publish button; with Shopify connected it shows "Shopify" tab (or single button if only Shopify).
5. Click Publish → article appears in Shopify blog with correct title, body, tags.
6. Click "Sync from Shopify" in settings → existing Shopify articles imported into article list.
7. If BOTH Ghost and Shopify are connected, platform tabs appear in top-right; switching tabs changes which platform is published to.
8. `npx tsc --noEmit` passes with no errors.

**Step 1:** Start dev server: `npm run dev` (or `pnpm dev`).

**Step 2:** Walk through checklist items 1–7 in browser.

**Step 3:** Run type-check one final time:
```bash
cd /Users/largitdata/project/quillo.dev/quillo && npx tsc --noEmit 2>&1 | head -20
```

**Step 4:** Commit any last fixes, then done.
