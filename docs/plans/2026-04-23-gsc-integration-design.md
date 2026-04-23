# Google Search Console Integration — Design

**Status:** Approved 2026-04-23
**Goal:** Close the loop between published articles, real Google search demand, and Quillo's planning workflow — by pulling GSC Search Analytics data into Postgres and surfacing it in three places: per-article performance, planning wizard, and an opportunities inbox.

---

## Scope summary

| Decision | Choice |
|---|---|
| Primary use case | Closed loop: performance tracking + feeding search data into planning |
| Auth model | Per-project OAuth (mirrors existing `site_connections` pattern) |
| UI surfaces | (A) Per-article Performance tab + (C) Planning wizard Step 1 injection + (D) Opportunities inbox |
| Data refresh | Daily background sync → local Postgres storage |
| Opportunity categories | Striking distance, rising queries, decaying pages |
| Planning injection | Topic-filtered queries into Step 1 AI prompt |
| Retention | None — user cleans up manually if needed |

Deferred (not in M1): project-level SEO dashboard; unowned queries; cannibalisation; content-gap-vs-plan; Step 2 cluster injection; property-level aggregation across multiple properties.

---

## Architecture

```
[GSC API] ←── [daily Vercel Cron: /api/cron/gsc-sync]
                ↓ writes
[Postgres: gsc_* tables]
                ↓ reads
  ┌─────────────┼────────────────────┐
 Perf tab    Planning wizard      Opportunities inbox
 (A)         (C: step1 prompt)    (D: inbox page)
```

Background sync is the single writer. All UI features read from Postgres only — never call GSC live. This keeps UI fast, lets us compute trends with SQL, and stays well inside GSC API rate limits.

---

## Data model

All tables `tenant_id` scoped with RLS; same pattern as existing tables.

### `gsc_connections`
Per-project Google OAuth credentials and property binding.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `project_id` | uuid, **unique**, fk → projects | one connection per project |
| `tenant_id` | uuid | |
| `google_user_email` | text | shown in Settings for clarity |
| `property_url` | text | e.g. `sc-domain:example.com` or `https://example.com/` |
| `refresh_token_encrypted` | bytea | via `pgp_sym_encrypt` |
| `access_token_encrypted` | bytea | cached; refreshed on demand |
| `access_token_expires_at` | timestamptz | |
| `last_synced_at` | timestamptz | |
| `last_sync_status` | text | `ok` / `partial` / `error` |
| `last_sync_error` | text | nullable; e.g. `refresh_token_revoked` |
| `created_at`, `updated_at` | timestamptz | |

### `gsc_daily_query_page`
Raw daily rows from GSC Search Analytics.

| Column | Type | Notes |
|---|---|---|
| `project_id` | uuid | pk part |
| `tenant_id` | uuid | |
| `date` | date | pk part |
| `query` | text | pk part |
| `page_url` | text | |
| `normalized_page_url` | text generated | `public.normalize_url(page_url)`; pk part |
| `clicks` | integer | |
| `impressions` | integer | |
| `ctr` | numeric | |
| `position` | numeric | avg position |

Primary key: `(project_id, date, query, normalized_page_url)`.
Indexes: `(project_id, date)`, `(project_id, normalized_page_url)`.

### `gsc_sync_runs`
Sync audit log — one row per sync attempt.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `project_id` | uuid | |
| `started_at`, `finished_at` | timestamptz | |
| `rows_inserted` | integer | |
| `status` | text | `ok` / `partial` / `error` |
| `error` | text | nullable |

---

## OAuth connection flow

1. Settings page gains a **"Google Search Console"** card next to existing CMS connection cards.
2. User clicks **Connect** → redirect to Google OAuth consent with scope `https://www.googleapis.com/auth/webmasters.readonly`.
3. `state` param carries `{projectId, nonce}`, HMAC-signed with a server secret (CSRF guard).
4. Callback at `/api/gsc/oauth/callback` exchanges code → access + refresh tokens.
5. Callback calls `sites.list` to fetch user's GSC properties.
6. UI shows a **property picker**. User selects one.
7. Save encrypted tokens + `property_url` into `gsc_connections`.
8. Trigger an **immediate first sync** (last 7 days) so data appears right away.

### Token refresh helper

`getGscClient(projectId)`:
- Loads the row, decrypts refresh token.
- If access token expired (with 5-min buffer) → call Google token endpoint to refresh, update row.
- If refresh token revoked (`400 invalid_grant`) → mark `last_sync_error = 'refresh_token_revoked'`, throw typed error; UI shows a "Reconnect" banner.

---

## Background sync

### Daily cron

**Route:** `/api/cron/gsc-sync`
**Schedule:** Daily at ~03:00 UTC (after GSC's nightly data drop).
**Auth:** Vercel Cron secret header.

**Per project with a valid connection:**

1. Determine sync window: `[max(last_synced_at - 3 days, today - 16 days), today - 1 day]`. The 3-day overlap handles GSC's late backfills; 16-day upper bound caps cold-start pulls.
2. Call `searchanalytics.query`:
   - `dimensions: ['date', 'query', 'page']`
   - `rowLimit: 25000`, paginate via `startRow` until exhausted
   - Hard cap per run: 100k rows
3. Upsert into `gsc_daily_query_page` with `ON CONFLICT (project_id, date, query, normalized_page_url) DO UPDATE`.
4. Update `last_synced_at`, write a `gsc_sync_runs` row.
5. On per-project failure: log, continue — one bad project doesn't block others.

Projects processed **sequentially** within the cron run to avoid hitting GSC's per-minute rate limits.

### Manual sync

**Route:** `/api/gsc/sync-now` (POST, authenticated).
Gated to one run per hour per project. Same sync function. Triggered by a **"Sync now"** button in Settings.

---

## UI surface A — Per-article Performance tab

**Route:** `/projects/[projectId]/articles/[articleId]/performance`
Added as a new tab in the focus editor alongside Editor / Interview / SEO / Publish.

**URL matching:** Look up `publish_targets` for this article, take the most recent successful publish's `normalized_url`. If none → empty state: *"Publish this article first to see performance data."*

**Range selector:** 7d / 28d (default) / 90d.

**Shown:**
- 4 summary tiles: Clicks, Impressions, CTR, Avg Position — each with delta vs. previous same-length period.
- Line chart: daily clicks + impressions over the window.
- Top queries table (top 20 by clicks): `query | clicks | impressions | ctr | position`.

All data read from `gsc_daily_query_page` filtered by `project_id` and `normalized_page_url`.

**If URL has no GSC rows** (may not be indexed yet) → empty state with the `normalized_url` we're looking up, to help the user debug canonical mismatches.

---

## UI surface C — Planning wizard Step 1 injection

**Where:** Existing `/projects/[projectId]/planning/new` wizard, Step 1 (topic → direction).

**Flow:**

1. User enters topic + pillar count, clicks **Generate**.
2. Client-side or server-side (TBD during implementation — server preferred) checks `gsc_connections` for the project.
3. If connection exists and sync data is available:
   - Extract tokens from the topic (lowercase, strip stopwords, split on whitespace).
   - Query `gsc_daily_query_page` for last 90 days where `query ILIKE` any of the tokens (or contains any significant token as substring).
   - Group by `query`, aggregate `sum(impressions)`, `sum(clicks)`, `avg(position) weighted by impressions`.
   - Sort by impressions desc, limit 40.
4. Pass results as `search_data` in the request body to `/api/ai/plan/step1`.
5. Route injects them into the prompt as:
   ```xml
   <search_data>
     <query>
       <text>example keyword</text>
       <impressions>1234</impressions>
       <clicks>23</clicks>
       <avg_position>14.2</avg_position>
     </query>
     ...
   </search_data>
   ```
6. `planStep1System(pillarCount)` gets a new paragraph:
   > *"If `<search_data>` is provided, ground the proposed core aspects in queries that show real demand. Prefer aspects where users are already searching but the site has weak coverage (avg_position > 10)."*

**Fallback:** No connection, no matches, or sync never ran → omit the `search_data` field entirely. Step 1 behaves exactly as today. **Zero regression risk.**

### Topic→query matching

Plain `ILIKE` substring matching on tokenized topic words for M1. Cheap, deterministic, works well for English and Chinese. If quality disappoints in practice, graduate to pgvector embedding similarity — but not until needed.

---

## UI surface D — Opportunities inbox

**Route:** `/projects/[projectId]/opportunities` — new top-level nav item under "SEO" group.

Three sections on the page, each a paginated list with a tooltip explaining why rows are listed.

### Striking distance

SQL (conceptual):
```sql
SELECT query, normalized_page_url,
       sum(clicks) AS clicks, sum(impressions) AS impressions,
       (sum(position * impressions) / sum(impressions)) AS avg_position
FROM gsc_daily_query_page
WHERE project_id = $1 AND date >= today - 28 days
GROUP BY query, normalized_page_url
HAVING avg_position BETWEEN 5 AND 20 AND sum(impressions) >= 100
ORDER BY sum(impressions) DESC
```
Row actions: **Open article** (when `normalized_page_url` matches a `publish_targets.normalized_url`), **Copy query**.

### Rising queries

Compare last 28d vs previous 28d.

Surface queries where:
- `current_impressions >= 50`
- AND (`previous_impressions = 0` OR `current_impressions / previous_impressions >= 1.5`)

Sorted by absolute impressions growth. Show current/previous counts side by side.

### Decaying pages

Group by `normalized_page_url`, last 28d vs previous 28d.

Surface pages where:
- `previous_clicks >= 50` (noise filter)
- AND `current_clicks / previous_clicks <= 0.7`

Row action: **Refresh article** (when URL matches a Quillo article, deep-links into the editor).

---

## Edge cases

### OAuth
- **User revokes access in Google** → next refresh returns `invalid_grant` → mark `refresh_token_revoked`; Settings banner prompts reconnect; Performance tab shows stale-data warning with `last_synced_at`.
- **`state` mismatch on callback** → reject with 400.
- **User switches property** → "Change property" button on the connection card; re-runs property picker; new syncs target the new property. Old rows remain (harmless; user cleans up manually).

### Sync
- **Property not verified** (403) → record error, surface in Settings.
- **Rate limit (429)** → exponential backoff inside the run; if still failing, mark run partial; next day's 3-day overlap catches up.
- **Huge query volume** → per-run cap of 100k rows stops runaway growth.
- **Upsert overlap** → primary key + `ON CONFLICT DO UPDATE` handles GSC's backfills cleanly.

### UI
- **Article not published** → empty state.
- **URL doesn't match any GSC row** (wrong canonical, www vs non-www) → empty state showing the `normalized_url` we're looking up, for debugging.
- **Planning wizard with connection but no query matches** → `<search_data>` omitted; wizard behaves as today.
- **Opportunities page before 2 weeks of data** → empty state: "Sync needs at least 2 weeks of data for most insights."

---

## Security

- Refresh and access tokens encrypted with `pgp_sym_encrypt`, same key as `site_connections.config_encrypted`.
- OAuth `state` param = `{projectId, nonce}` HMAC-signed with a server secret.
- All `gsc_*` tables RLS-scoped by `tenant_id` / `project_id`, same pattern as existing tables.
- Cron route protected by Vercel Cron secret header.
- Least-privilege scope: `webmasters.readonly` only.

---

## Testing

- **Unit** — token refresh helper (valid / expired / revoked paths); SQL for the three opportunity queries (seed a small fixture into `gsc_daily_query_page`); topic→query tokenisation + matching.
- **Integration** — mock GSC API (msw or nock); drive sync end-to-end; assert upserts, the 3-day overlap, and sync-run logging.
- **Manual smoke** — connect a real property in a dev project, trigger manual sync, verify each of the three UI surfaces. The only real test for data-integration work.

---

## Implementation order (rough)

1. Migration: `gsc_connections`, `gsc_daily_query_page`, `gsc_sync_runs`.
2. OAuth flow + property picker + Settings card.
3. Sync function + manual "Sync now" button (cron route wired but not yet scheduled).
4. Performance tab (surface A).
5. Opportunities inbox (surface D).
6. Planning wizard injection (surface C).
7. Enable Vercel Cron schedule.

This order lets us validate auth and sync end-to-end before building UI on top, and puts the highest-value feature (D) ahead of the hardest prompt-engineering work (C).
