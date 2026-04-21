# Ghost Article Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Import existing Ghost posts into the planning graph as unassigned orphan nodes that can be manually dragged into a pillar or assigned via a panel.

**Architecture:** Add a `source` column to `articles` to distinguish imported posts. A sync action fetches Ghost posts, creates article + publish_target rows for ones not already tracked. The planning graph renders orphan articles (`pillar_id IS NULL AND source = 'ghost'`) in a horizontal shelf below the main graph. Clicking an orphan opens an OrphanPanel with pillar assignment (existing or new).

**Tech Stack:** Next.js Server Actions, Supabase, `@tryghost/admin-api`, existing `ghostClientFromRow` + `fromBytea` helpers, Tailwind, existing `PlanningGraph` component.

---

## Key file paths

- Migration: `supabase/migrations/20260421000000_add_article_source.sql`
- Planning actions: `src/app/[locale]/(app)/projects/[projectId]/planning/planning-actions.ts`
- Planning page: `src/app/[locale]/(app)/projects/[projectId]/planning/page.tsx`
- Graph component: `src/app/[locale]/(app)/projects/[projectId]/planning/_graph.tsx`
- Ghost client: `src/lib/ghost/client.ts`
- Ghost types: `src/lib/ghost/types.d.ts`
- i18n: `messages/zh-TW/planning.json`, `messages/en/planning.json`

## Context for implementer

- `articles.pillar_id` is nullable — orphans have `pillar_id = null`
- `publish_targets` links articles to Ghost posts via `remote_post_id` + `connection_id`; we use this as the dedup key so syncing twice never creates duplicates
- `ghostClientFromRow({ config_encrypted })` decrypts the Ghost connection config; the `config_encrypted` value is a Postgres bytea hex string — call `fromBytea(raw)` before decrypting
- The planning page's `PlanningGraph` already receives `pillars`, `articles`, `publishTargets`; we add a new `orphanArticles` prop
- Orphan nodes live in a fixed horizontal shelf (not part of force layout) at the bottom of the graph canvas; clicking them shows an `OrphanPanel` (similar to `PillarDetail`)
- `addPillar` in planning-actions already exists; we add `createPillarAndAssignAction` as a convenience wrapper

---

### Task 1: DB migration — add `source` column

**Files:**
- Create: `supabase/migrations/20260421000000_add_article_source.sql`

**Step 1: Write the migration**

```sql
ALTER TABLE articles
  ADD COLUMN source text NOT NULL DEFAULT 'quillo'
    CHECK (source IN ('quillo', 'ghost'));

CREATE INDEX ON articles(project_id, source) WHERE pillar_id IS NULL;
```

**Step 2: Apply locally**

```bash
npx supabase db reset
```

Expected: migration runs, `articles` table now has `source` column with default `'quillo'`.

**Step 3: Verify**

```bash
cat <<'SQL' | npx supabase db query --local
SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'articles' AND column_name = 'source';
SQL
```

Expected: `source | 'quillo'::text | NO`

**Step 4: Commit**

```bash
git add supabase/migrations/20260421000000_add_article_source.sql
git commit -m "feat(db): add source column to articles for ghost import tracking"
```

---

### Task 2: Extend Ghost types + sync + assign actions

**Files:**
- Modify: `src/lib/ghost/types.d.ts`
- Modify: `src/app/[locale]/(app)/projects/[projectId]/planning/planning-actions.ts`

**Step 1: Add missing Ghost post fields to types.d.ts**

In the `GhostPost` interface, add:
```ts
tags?: Array<string | { id?: string; name?: string; slug?: string }>
published_at?: string | null
url?: string | null
```

(These are already partially there — make sure `tags` allows the object form that Ghost actually returns, and that `url` and `published_at` are present.)

**Step 2: Add `syncGhostArticlesAction` to planning-actions.ts**

Add these imports at the top:
```ts
import { ghostClientFromRow } from '@/lib/ghost/client'
import { fromBytea } from '@/lib/crypto/encrypt'
```

Add the action:
```ts
export async function syncGhostArticlesAction(projectId: string) {
  const supabase = await sb()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: membership } = await supabase
    .from('tenant_members').select('tenant_id').eq('user_id', user.id).single()
  if (!membership) throw new Error('No tenant')

  // Ghost connection for this project
  const { data: conn } = await supabase
    .from('site_connections')
    .select('id,config_encrypted')
    .eq('project_id', projectId)
    .eq('platform', 'ghost')
    .maybeSingle()
  if (!conn) throw new Error('No Ghost connection configured')

  // IDs already tracked (either published by us or previously imported)
  const { data: existingTargets } = await supabase
    .from('publish_targets')
    .select('remote_post_id')
    .eq('connection_id', conn.id)
  const trackedIds = new Set(
    (existingTargets ?? []).map((t) => t.remote_post_id).filter(Boolean),
  )

  // Fetch all Ghost posts
  const ghost = ghostClientFromRow({ config_encrypted: conn.config_encrypted })
  const posts = await ghost.posts.browse({
    limit: 'all',
    status: 'all',
    fields: 'id,title,slug,meta_title,meta_description,excerpt,tags,published_at,url,status',
  } as Record<string, unknown>)

  const newPosts = posts.filter((p) => p.id && !trackedIds.has(p.id))
  if (newPosts.length === 0) {
    revalidatePath(`/projects/${projectId}/planning`)
    return { imported: 0 }
  }

  // Determine next article position
  const { data: lastArticle } = await supabase
    .from('articles')
    .select('position')
    .eq('project_id', projectId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  let nextPos = (lastArticle?.position ?? -1) + 1

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
        source: 'ghost',
        title: post.title ?? '(untitled)',
        slug: post.slug ?? null,
        meta_title: post.meta_title ?? null,
        meta_description: post.meta_description ?? null,
        excerpt: post.excerpt ?? null,
        tags: tagNames,
        status: 'editing',
        position: nextPos++,
      })
      .select('id')
      .single()
    if (artErr || !article) continue

    await supabase.from('publish_targets').insert({
      article_id: article.id,
      connection_id: conn.id,
      tenant_id: membership.tenant_id,
      remote_post_id: post.id ?? null,
      remote_url: (post as Record<string, unknown>).url as string ?? null,
      remote_status: post.status ?? null,
      published_at: post.published_at ?? null,
    })
  }

  revalidatePath(`/projects/${projectId}/planning`)
  return { imported: newPosts.length }
}
```

**Step 3: Add `assignOrphanToPillarAction`**

```ts
export async function assignOrphanToPillarAction(
  projectId: string,
  articleId: string,
  pillarId: string,
) {
  const supabase = await sb()
  const { error } = await supabase
    .from('articles')
    .update({ pillar_id: pillarId })
    .eq('id', articleId)
    .eq('project_id', projectId)
  if (error) throw error
  revalidatePath(`/projects/${projectId}/planning`)
}
```

**Step 4: Add `createPillarAndAssignAction`**

This atomically creates a new pillar then assigns the orphan article.

```ts
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
  if (assignErr) throw assignErr

  revalidatePath(`/projects/${projectId}/planning`)
  return { pillarId: pillar.id }
}
```

**Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 6: Commit**

```bash
git add src/lib/ghost/types.d.ts src/app/\[locale\]/\(app\)/projects/\[projectId\]/planning/planning-actions.ts
git commit -m "feat(planning): ghost sync + orphan assign actions"
```

---

### Task 3: Update planning page to fetch orphans and add sync button

**Files:**
- Modify: `src/app/[locale]/(app)/projects/[projectId]/planning/page.tsx`

**Step 1: Add orphan articles query**

After the existing `publishTargets` query, add:

```ts
// Orphan articles — Ghost-imported, not yet assigned to a pillar
const { data: orphanArticles } = await supabase
  .from('articles')
  .select('id,title,target_keyword,slug,tags,status,source')
  .eq('project_id', projectId)
  .eq('source', 'ghost')
  .is('pillar_id', null)
  .order('created_at', { ascending: false })
```

**Step 2: Pass connection presence and orphans to PlanningGraph**

Also fetch whether there's a Ghost connection (for showing the sync button):

```ts
const { data: ghostConn } = await supabase
  .from('site_connections')
  .select('id')
  .eq('project_id', projectId)
  .eq('platform', 'ghost')
  .maybeSingle()
```

Update `<PlanningGraph>` call:
```tsx
<PlanningGraph
  projectId={projectId}
  pillars={pillars}
  articles={articles ?? []}
  publishTargets={publishTargets ?? []}
  orphanArticles={(orphanArticles ?? []) as OrphanArticle[]}
  hasGhostConnection={!!ghostConn}
/>
```

Add the `OrphanArticle` type in the page (or export from graph):
```ts
type OrphanArticle = {
  id: string
  title: string
  target_keyword: string | null
  slug: string | null
  tags: string[]
  status: string
  source: string
}
```

**Step 3: Typecheck**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/app/\[locale\]/\(app\)/projects/\[projectId\]/planning/page.tsx
git commit -m "feat(planning): fetch ghost orphan articles for graph"
```

---

### Task 4: Add i18n strings

**Files:**
- Modify: `messages/zh-TW/planning.json`
- Modify: `messages/en/planning.json`

**Step 1: Add to zh-TW/planning.json**

```json
"sync_ghost": "從 Ghost 同步",
"syncing": "同步中…",
"sync_done": "已匯入 {count} 篇",
"orphan_label": "未分類 Ghost 文章",
"orphan_assign": "加入 Pillar",
"orphan_assign_existing": "選擇現有 Pillar",
"orphan_new_pillar": "建立新 Pillar",
"orphan_pillar_title": "Pillar 標題",
"orphan_pillar_keyword": "目標關鍵字",
"orphan_assign_confirm": "指定",
"orphan_no_pillars": "尚無 Pillar，請先建立"
```

**Step 2: Add to en/planning.json**

```json
"sync_ghost": "Sync from Ghost",
"syncing": "Syncing…",
"sync_done": "Imported {count}",
"orphan_label": "Unassigned Ghost articles",
"orphan_assign": "Add to Pillar",
"orphan_assign_existing": "Choose existing pillar",
"orphan_new_pillar": "Create new pillar",
"orphan_pillar_title": "Pillar title",
"orphan_pillar_keyword": "Target keyword",
"orphan_assign_confirm": "Assign",
"orphan_no_pillars": "No pillars yet — create one first"
```

**Step 3: Commit**

```bash
git add messages/
git commit -m "feat(i18n): ghost import strings for planning page"
```

---

### Task 5: Graph — orphan shelf + OrphanPanel

**Files:**
- Modify: `src/app/[locale]/(app)/projects/[projectId]/planning/_graph.tsx`

**Step 1: Add new props and OrphanArticle type to PlanningGraph**

At the top of the file, add type:

```ts
type OrphanArticle = {
  id: string
  title: string
  target_keyword: string | null
  slug: string | null
  tags: string[]
  status: string
  source: string
}
```

Update `PlanningGraph` signature:
```ts
export function PlanningGraph({
  projectId,
  pillars,
  articles,
  publishTargets,
  orphanArticles,
  hasGhostConnection,
}: {
  projectId: string
  pillars: Pillar[]
  articles: Article[]
  publishTargets: PublishTarget[]
  orphanArticles: OrphanArticle[]
  hasGhostConnection: boolean
})
```

**Step 2: Add orphan state**

Inside `PlanningGraph`, add:
```ts
const [selectedOrphanId, setSelectedOrphanId] = useState<string | null>(null)
const selectedOrphan = orphanArticles.find((o) => o.id === selectedOrphanId) ?? null
```

**Step 3: Add orphan shelf below the graph canvas**

After the `</div>` closing the main canvas div (before the PillarDetail panel), add:

```tsx
{/* ORPHAN SHELF — Ghost articles not yet assigned to a pillar */}
{orphanArticles.length > 0 && (
  <div className="border-t border-rule pt-3 space-y-2">
    <div className="text-[10px] uppercase tracking-[0.14em] text-ink-4 px-1">
      {t('orphan_label')} ({orphanArticles.length})
    </div>
    <div className="flex flex-wrap gap-2 px-1">
      {orphanArticles.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => setSelectedOrphanId(o.id === selectedOrphanId ? null : o.id)}
          className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[12px] transition-colors cursor-pointer',
            selectedOrphanId === o.id
              ? 'bg-ink text-bg border-ink'
              : 'bg-bg border-rule text-ink-2 hover:border-ink-3 hover:text-ink',
          )}
        >
          <span className="w-2 h-2 rounded-full border border-current opacity-60 shrink-0" />
          <span className="font-serif italic truncate max-w-[180px]">
            {o.target_keyword || o.title}
          </span>
        </button>
      ))}
    </div>
  </div>
)}
```

**Step 4: Render OrphanPanel when an orphan is selected**

After the existing `{selectedPillar && <PillarDetail ...>}` block, add:

```tsx
{selectedOrphan && (
  <OrphanPanel
    projectId={projectId}
    orphan={selectedOrphan}
    pillars={pillars}
    onClose={() => setSelectedOrphanId(null)}
  />
)}
```

**Step 5: Implement OrphanPanel component**

Add after `PillarDetail`:

```tsx
function OrphanPanel({
  projectId,
  orphan,
  pillars,
  onClose,
}: {
  projectId: string
  orphan: OrphanArticle
  pillars: Pillar[]
  onClose: () => void
}) {
  const t = useTranslations('planning')
  const router = useRouter()
  const [mode, setMode] = useState<'assign' | 'new-pillar'>('assign')
  const [selectedPillarId, setSelectedPillarId] = useState(pillars[0]?.id ?? '')
  const [newTitle, setNewTitle] = useState('')
  const [newKeyword, setNewKeyword] = useState(orphan.target_keyword ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function assign() {
    if (!selectedPillarId) return
    setError(null)
    startTransition(async () => {
      try {
        await assignOrphanToPillarAction(projectId, orphan.id, selectedPillarId)
        onClose()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error')
      }
    })
  }

  function createAndAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        await createPillarAndAssignAction(projectId, orphan.id, {
          title: newTitle.trim(),
          target_keyword: newKeyword || null,
        })
        onClose()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error')
      }
    })
  }

  return (
    <aside className="fixed right-6 bottom-6 top-24 w-[320px] z-40 flex flex-col rounded-xl border border-rule bg-bg shadow-sh-2 overflow-hidden">
      <header className="flex items-start justify-between gap-2 p-4 border-b border-rule">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-4">Ghost</div>
          <h3 className="font-serif italic text-[20px] text-ink leading-tight truncate">{orphan.title}</h3>
          {orphan.target_keyword && (
            <p className="font-mono text-[11px] text-ink-3 mt-0.5 truncate">{orphan.target_keyword}</p>
          )}
        </div>
        <button type="button" onClick={onClose} className="p-1 text-ink-3 hover:text-ink cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {orphan.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {orphan.tags.map((tag) => (
              <span key={tag} className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-rule bg-bg-2 text-ink-3">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-1 rounded-lg border border-rule overflow-hidden text-[11px]">
          {(['assign', 'new-pillar'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 px-3 py-1.5 transition-colors cursor-pointer',
                mode === m ? 'bg-ink text-bg' : 'text-ink-3 hover:bg-mist',
              )}
            >
              {m === 'assign' ? t('orphan_assign_existing') : t('orphan_new_pillar')}
            </button>
          ))}
        </div>

        {mode === 'assign' && (
          <div className="space-y-3">
            {pillars.length === 0 ? (
              <p className="text-[12px] text-ink-4">{t('orphan_no_pillars')}</p>
            ) : (
              <>
                <select
                  value={selectedPillarId}
                  onChange={(e) => setSelectedPillarId(e.target.value)}
                  className="w-full rounded-lg border border-rule bg-bg px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-ink-3"
                >
                  {pillars.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
                <Button
                  variant="primary"
                  disabled={!selectedPillarId || pending}
                  onClick={assign}
                  className="w-full"
                >
                  {pending ? '…' : t('orphan_assign_confirm')}
                </Button>
              </>
            )}
          </div>
        )}

        {mode === 'new-pillar' && (
          <form onSubmit={createAndAssign} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-[0.12em] text-ink-3">{t('orphan_pillar_title')}</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                className="w-full rounded-lg border border-rule bg-bg px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-ink-3"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-[0.12em] text-ink-3">{t('orphan_pillar_keyword')}</label>
              <input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                className="w-full rounded-lg border border-rule bg-bg px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-ink-3"
              />
            </div>
            <Button type="submit" variant="primary" disabled={!newTitle.trim() || pending} className="w-full">
              {pending ? '…' : t('orphan_assign_confirm')}
            </Button>
          </form>
        )}

        {error && <p className="text-[12px] text-rust">{error}</p>}
      </div>
    </aside>
  )
}
```

**Step 6: Import new actions in the graph component**

Add to the existing import from `./planning-actions`:
```ts
import {
  updatePillar, deletePillar, addArticle,
  assignOrphanToPillarAction, createPillarAndAssignAction,
} from './planning-actions'
```

**Step 7: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 8: Commit**

```bash
git add src/app/\[locale\]/\(app\)/projects/\[projectId\]/planning/_graph.tsx
git commit -m "feat(planning): orphan shelf and assign panel for ghost-imported articles"
```

---

### Task 6: Add sync button to planning page

**Files:**
- Modify: `src/app/[locale]/(app)/projects/[projectId]/planning/page.tsx`

The planning page is a Server Component, so the sync button needs to be a small Client Component.

**Step 1: Create `_sync-button.tsx`**

Create: `src/app/[locale]/(app)/projects/[projectId]/planning/_sync-button.tsx`

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { syncGhostArticlesAction } from './planning-actions'

export function SyncGhostButton({ projectId }: { projectId: string }) {
  const t = useTranslations('planning')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function sync() {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await syncGhostArticlesAction(projectId)
        setMessage(t('sync_done', { count: result.imported }))
        router.refresh()
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Error')
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="default" onClick={sync} disabled={pending}>
        <RefreshCw className={`w-3 h-3 mr-1.5 ${pending ? 'animate-spin' : ''}`} />
        {pending ? t('syncing') : t('sync_ghost')}
      </Button>
      {message && (
        <span className="text-[11px] text-ink-3">{message}</span>
      )}
    </div>
  )
}
```

**Step 2: Add SyncGhostButton to planning page header**

In `page.tsx`, import `SyncGhostButton` and add it to the header next to the existing "plan new" button, but only when `hasGhostConnection` is true:

```tsx
import { SyncGhostButton } from './_sync-button'

// In the return:
<header className="flex items-start justify-between gap-6">
  <h1 className="font-serif italic text-[32px] text-ink leading-tight">
    {tp('nav_planning')}
  </h1>
  <div className="flex items-center gap-3">
    {ghostConn && <SyncGhostButton projectId={projectId} />}
    <Link href={`/projects/${projectId}/planning/new`}>
      <Button variant="default">{t('plan_new_button')}</Button>
    </Link>
  </div>
</header>
```

**Step 3: Typecheck + tests**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: no errors, 33 tests passing.

**Step 4: Commit**

```bash
git add src/app/\[locale\]/\(app\)/projects/\[projectId\]/planning/
git commit -m "feat(planning): sync from Ghost button with import count feedback"
```

---

## Testing checklist (manual)

1. No Ghost connection → sync button hidden on planning page ✓
2. Has Ghost connection → sync button visible ✓
3. Click sync → posts appear in orphan shelf below graph ✓
4. Click sync again → no duplicates ✓
5. Click orphan chip → OrphanPanel opens on right ✓
6. OrphanPanel: "assign to existing pillar" → article appears in pillar cluster ✓
7. OrphanPanel: "create new pillar" form → new pillar appears in graph with article ✓
8. Orphan disappears from shelf after assignment ✓
9. Assigned article links to editor ✓ (pillar_id now set → appears in graph as normal cluster)
