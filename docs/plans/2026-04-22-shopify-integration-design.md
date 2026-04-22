# Shopify Integration Design

## Goal

Add Shopify as a publish and import platform, following the same patterns as Ghost.

## Architecture

- `site_connections` already supports `platform = 'shopify'` in the DB CHECK constraint — no new migration needed.
- `publish_targets` and `publish_logs` are platform-agnostic and reused as-is.
- No Shopify SDK; use plain `fetch` against the Shopify Admin REST API 2024-01.

## Key Design Decisions

- **One connection per project** (same as Ghost): project can connect to both Ghost and Shopify simultaneously, but publishing an article goes to one platform at a time.
- **Default Blog at connection time**: Shopify stores can have multiple blogs. After saving credentials, the UI fetches the blog list and the user picks a default blog. Subsequent publishes and imports always use that blog.
- **Import from default blog only**: `syncShopifyArticlesAction` fetches articles from the configured blog only.
- **Images in body**: keep Supabase CDN URLs as-is (Shopify body HTML hotlinks external images fine). Feature image goes into Shopify's `article.image.src`.
- **SEO fields**: title tag, description tag, and canonical URL stored as Shopify metafields (`namespace: global`).

---

## 1. Connection & Settings

### Settings page changes

- Currently only fetches the Ghost connection. Extend to fetch both Ghost and Shopify connections in parallel.
- Render two independent cards: Ghost card (existing) + Shopify card (new).

### Shopify connection form fields

| Field | Notes |
|---|---|
| Connection name | Display label |
| Store URL | `xxx.myshopify.com`; normalise to `https://xxx.myshopify.com` |
| Admin API Access Token | `shpat_...` |
| Default Blog | Populated after save; dropdown from `GET /admin/api/2024-01/blogs.json` |

### Encrypted config shape

```ts
type ShopifyConfig = {
  storeUrl: string      // normalised https URL
  accessToken: string
  blogId: number
  blogTitle: string
}
```

### Actions (mirroring Ghost pattern)

- `saveShopifyConnectionAction` — validate, encrypt, upsert `site_connections`
- `testShopifyConnectionAction` — call `GET /admin/api/2024-01/shop.json`, update `last_test_ok`
- `deleteShopifyConnectionAction` — delete row
- `fetchShopifyBlogsAction` — called client-side after credentials are saved to populate blog dropdown

### Files

- Modify: `src/app/[locale]/(app)/projects/[projectId]/settings/page.tsx`
- Modify: `src/app/[locale]/(app)/projects/[projectId]/settings/settings-actions.ts`
- Create: `src/app/[locale]/(app)/projects/[projectId]/settings/_shopify-connection-form.tsx`
- Create: `src/lib/shopify/client.ts`

---

## 2. Publish

### API route: `/api/publish/shopify/route.ts`

Input: `{ articleId, connectionId, action: 'publish' | 'draft' | 'unpublish' }`

Steps:
1. Auth check + load article + load connection (platform must be `shopify`)
2. Decrypt config → `ShopifyConfig`
3. `markdown → HTML` via `marked` (same as Ghost route)
4. Compose Shopify article payload:
   - `title`, `body_html`, `handle` (slug), `excerpt`
   - `tags` → comma-separated string
   - `published` → boolean
   - `published_at` → ISO string
   - `image: { src: feature_image_url }` (if exists)
5. SEO metafields (upserted separately after article create/update):
   - `{ namespace: 'global', key: 'title_tag', value: meta_title }`
   - `{ namespace: 'global', key: 'description_tag', value: meta_description }`
   - `{ namespace: 'global', key: 'canonical_url', value: canonical_url }`
6. Call Shopify REST:
   - Create: `POST /admin/api/2024-01/blogs/{blog_id}/articles.json`
   - Update: `PUT /admin/api/2024-01/blogs/{blog_id}/articles/{article_id}.json`
   - Unpublish (set `published: false`): `PUT ...`
7. Upsert `publish_targets`, write `publish_logs`

### Files

- Create: `src/app/api/publish/shopify/route.ts`
- Create: `src/lib/shopify/client.ts` (thin fetch wrapper)

---

## 3. Import (Sync)

### `syncShopifyArticlesAction`

Located in `planning-actions.ts` (same file as `syncGhostArticlesAction`).

Steps:
1. Load Shopify connection for project
2. Decrypt config → get `blogId`
3. `GET /admin/api/2024-01/blogs/{blogId}/articles.json?limit=250&status=any`
4. Filter out already-tracked `remote_post_id` values (from `publish_targets`)
5. For each new article:
   - `generateJSON(body_html, [StarterKit, TiptapImage, TiptapLink])` → `body_tiptap`
   - Insert into `articles` with `source: 'shopify'`
   - Insert into `publish_targets` with `remote_post_id`, `remote_url`, `remote_status`

### Sync button

Add Shopify sync button to Settings → Shopify connection card (same as Ghost sync button in Settings).

---

## 4. Article Publish UI

### Current

Article screen receives a single `connection` prop (Ghost only).

### New

Server component (`page.tsx`) fetches both Ghost and Shopify connections. Passes `connections: Connection[]` to the article screen.

Publish panel logic:
- 0 connections → "No connection" CTA (existing)
- 1 connection → use it directly (same UX as today)
- 2 connections → show two tabs (Ghost | Shopify) in the publish panel; each tab has independent publish/unpublish state from its own `publish_target` row

Publish fetch path determined by `connection.platform`:
- `ghost` → `/api/publish/ghost`
- `shopify` → `/api/publish/shopify`

### Files

- Modify: `src/app/[locale]/(focus)/projects/[projectId]/articles/[articleId]/page.tsx`
- Modify: `src/app/[locale]/(focus)/projects/[projectId]/articles/[articleId]/_article-screen.tsx`

---

## 5. i18n

Add keys to `messages/en/` and `messages/zh-TW/` for Shopify-specific strings (store URL label, access token label, blog label, sync button, etc.).

---

## Out of Scope

- Image re-upload to Shopify Files API (body images stay as Supabase CDN URLs)
- Shopify GraphQL API (REST is sufficient for this scope)
- WordPress integration (future)
