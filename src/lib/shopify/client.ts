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
    `/blogs/${config.blogId}/articles.json?limit=250&published_status=any`,
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
