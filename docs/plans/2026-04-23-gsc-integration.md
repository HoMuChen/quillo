# Google Search Console Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship GSC integration per `docs/plans/2026-04-23-gsc-integration-design.md` — OAuth connect per project, daily background sync into Postgres, and three UI surfaces (per-article Performance tab, planning wizard Step 1 injection, Opportunities inbox).

**Architecture:** Per-project OAuth stores encrypted tokens in a new `gsc_connections` table. A daily Vercel Cron job pulls GSC Search Analytics rows into `gsc_daily_query_page`. All UI reads from Postgres only — never live GSC. Planning wizard Step 1 optionally injects topic-matched queries into the AI prompt when a connection exists.

**Tech Stack:** Next.js 16 App Router; Supabase Postgres + RLS; raw `fetch()` against Google OAuth + Search Console REST APIs (no SDK); Vercel Cron; Vitest (happy-dom); next-intl for zh-TW + en.

**Reference:** Design doc at `docs/plans/2026-04-23-gsc-integration-design.md`. Read that first for scope decisions (auth model, retention, opportunity categories, etc.).

**Ground rules:**
- TDD where tests add value (SQL helpers, token refresh, tokeniser, URL matching). Manual smoke tests for UI and OAuth flow — document the smoke steps in the commit message.
- DRY: reuse `encryptJson`/`decryptJson` from `src/lib/crypto/encrypt.ts`, `normalizeUrl` from `src/lib/url/normalize.ts`, and the Settings-actions shape from `src/app/[locale]/(app)/projects/[projectId]/settings/settings-actions.ts`.
- YAGNI: no rollup tables, no retention cron, no embeddings (plain ILIKE tokeniser). These are in the "deferred" list in the design doc.
- Commit per task. Keep the working tree clean between tasks.

---

## Required environment variables

Add to `.env.local` and production before Task 3 lands:

| Name | Example | Purpose |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | `1234...apps.googleusercontent.com` | Google Cloud project OAuth 2.0 client |
| `GOOGLE_OAUTH_CLIENT_SECRET` | `GOCSPX-...` | Client secret |
| `GOOGLE_OAUTH_REDIRECT_URL` | `http://localhost:3000/api/gsc/oauth/callback` | Must match what's registered in GCP |
| `OAUTH_STATE_SECRET` | 32-byte base64 | HMAC key for signing `state` param |
| `CRON_SECRET` | random string | Vercel Cron auth; set this also in Vercel project settings |

`ENCRYPTION_KEY` (already set) is reused for token encryption.

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260423000000_gsc_integration.sql`

**Step 1: Write the migration**

```sql
-- GSC per-project OAuth credentials + property binding.
CREATE TABLE gsc_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  tenant_id uuid NOT NULL,
  google_user_email text NOT NULL,
  property_url text NOT NULL,
  refresh_token_encrypted bytea NOT NULL,
  access_token_encrypted bytea,
  access_token_expires_at timestamptz,
  last_synced_at timestamptz,
  last_sync_status text CHECK (last_sync_status IN ('ok','partial','error')),
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON gsc_connections(tenant_id);

ALTER TABLE gsc_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gsc_connections tenant isolation"
  ON gsc_connections FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()));

-- Raw per-day/query/page metrics. No retention; user cleans up manually if it grows.
CREATE TABLE gsc_daily_query_page (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  date date NOT NULL,
  query text NOT NULL,
  page_url text NOT NULL,
  normalized_page_url text GENERATED ALWAYS AS (public.normalize_url(page_url)) STORED,
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  ctr numeric NOT NULL DEFAULT 0,
  position numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, date, query, normalized_page_url)
);
CREATE INDEX ON gsc_daily_query_page (project_id, date);
CREATE INDEX ON gsc_daily_query_page (project_id, normalized_page_url);
CREATE INDEX ON gsc_daily_query_page (project_id, query);

ALTER TABLE gsc_daily_query_page ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gsc_daily_query_page tenant isolation"
  ON gsc_daily_query_page FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()));

-- Sync audit log.
CREATE TABLE gsc_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  rows_inserted integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('ok','partial','error')),
  error text
);
CREATE INDEX ON gsc_sync_runs(project_id, started_at DESC);

ALTER TABLE gsc_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gsc_sync_runs tenant isolation"
  ON gsc_sync_runs FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()));
```

**Step 2: Apply locally**

Run: `npx supabase migration up --local`
Expected: migration applies cleanly; `\d gsc_connections`, `\d gsc_daily_query_page`, `\d gsc_sync_runs` show tables.

**Step 3: Regenerate types**

Run: `pnpm db:types`
Expected: `src/lib/supabase/types.ts` now contains the three new tables. Commit this change with the migration.

**Step 4: Commit**

```bash
git add supabase/migrations/20260423000000_gsc_integration.sql src/lib/supabase/types.ts
git commit -m "feat(db): add gsc_connections, gsc_daily_query_page, gsc_sync_runs"
```

---

## Task 2: OAuth state signing helper

A tiny HMAC-signed-state helper. Used by Tasks 3 and 4 to CSRF-protect the callback.

**Files:**
- Create: `src/lib/gsc/state.ts`
- Test: `src/lib/gsc/state.test.ts`

**Step 1: Write failing test**

```ts
// src/lib/gsc/state.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  process.env.OAUTH_STATE_SECRET = Buffer.from('x'.repeat(32)).toString('base64')
})

describe('gsc state', () => {
  it('round-trips a projectId', async () => {
    const { signState, verifyState } = await import('./state')
    const state = signState('proj-123')
    expect(verifyState(state)).toEqual({ projectId: 'proj-123' })
  })

  it('rejects tampered state', async () => {
    const { signState, verifyState } = await import('./state')
    const state = signState('proj-123')
    const [payload, sig] = state.split('.')
    const tampered = `${payload}X.${sig}`
    expect(() => verifyState(tampered)).toThrow()
  })

  it('rejects expired state (>10 min)', async () => {
    vi.useFakeTimers()
    const { signState, verifyState } = await import('./state')
    const state = signState('proj-123')
    vi.advanceTimersByTime(11 * 60 * 1000)
    expect(() => verifyState(state)).toThrow()
    vi.useRealTimers()
  })
})
```

Run: `pnpm test:run src/lib/gsc/state.test.ts`
Expected: FAIL (module missing).

**Step 2: Implement**

```ts
// src/lib/gsc/state.ts
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

const MAX_AGE_MS = 10 * 60 * 1000

function getKey(): Buffer {
  const raw = process.env.OAUTH_STATE_SECRET
  if (!raw) throw new Error('OAUTH_STATE_SECRET not set')
  return Buffer.from(raw, 'base64')
}

export function signState(projectId: string): string {
  const payload = JSON.stringify({ projectId, issuedAt: Date.now() })
  const b64 = Buffer.from(payload, 'utf-8').toString('base64url')
  const sig = createHmac('sha256', getKey()).update(b64).digest('base64url')
  return `${b64}.${sig}`
}

export function verifyState(state: string): { projectId: string } {
  const [b64, sig] = state.split('.')
  if (!b64 || !sig) throw new Error('invalid state')
  const expected = createHmac('sha256', getKey()).update(b64).digest('base64url')
  const a = Buffer.from(sig, 'base64url')
  const b = Buffer.from(expected, 'base64url')
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('bad signature')
  const { projectId, issuedAt } = JSON.parse(Buffer.from(b64, 'base64url').toString('utf-8')) as {
    projectId: string
    issuedAt: number
  }
  if (Date.now() - issuedAt > MAX_AGE_MS) throw new Error('state expired')
  return { projectId }
}
```

**Step 3: Pass tests**

Run: `pnpm test:run src/lib/gsc/state.test.ts`
Expected: 3/3 PASS.

**Step 4: Commit**

```bash
git add src/lib/gsc/state.ts src/lib/gsc/state.test.ts
git commit -m "feat(gsc): signed-state helper for OAuth CSRF guard"
```

---

## Task 3: Google OAuth + Search Console HTTP client

A single `src/lib/gsc/client.ts` that encapsulates every HTTP call we make: OAuth code-exchange, refresh-token, `sites.list`, `searchanalytics.query`. Raw `fetch()` — no SDK.

**Files:**
- Create: `src/lib/gsc/client.ts`
- Test: `src/lib/gsc/client.test.ts`

**Step 1: Write failing tests**

```ts
// src/lib/gsc/client.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  buildAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  listSites,
  querySearchAnalytics,
  InvalidGrantError,
} from './client'

beforeEach(() => {
  vi.restoreAllMocks()
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'cid'
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'csecret'
  process.env.GOOGLE_OAUTH_REDIRECT_URL = 'https://app/cb'
})

describe('buildAuthUrl', () => {
  it('includes scope, redirect, state, prompt=consent (for refresh_token), access_type=offline', () => {
    const url = new URL(buildAuthUrl('state-xyz'))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('client_id')).toBe('cid')
    expect(url.searchParams.get('redirect_uri')).toBe('https://app/cb')
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/webmasters.readonly')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('state')).toBe('state-xyz')
    expect(url.searchParams.get('response_type')).toBe('code')
  })
})

describe('exchangeCodeForTokens', () => {
  it('posts form body to token endpoint and returns tokens', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      access_token: 'at', refresh_token: 'rt', expires_in: 3600, token_type: 'Bearer',
    }), { status: 200 }))
    const result = await exchangeCodeForTokens('code-abc')
    expect(result.accessToken).toBe('at')
    expect(result.refreshToken).toBe('rt')
    expect(result.expiresInSeconds).toBe(3600)
    const call = fetchMock.mock.calls[0]
    expect(call[0]).toBe('https://oauth2.googleapis.com/token')
    expect(call[1]?.method).toBe('POST')
  })

  it('throws on non-200', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('bad', { status: 400 }))
    await expect(exchangeCodeForTokens('code')).rejects.toThrow()
  })
})

describe('refreshAccessToken', () => {
  it('returns a new access token', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      access_token: 'at2', expires_in: 3599, token_type: 'Bearer',
    }), { status: 200 }))
    const result = await refreshAccessToken('rt')
    expect(result.accessToken).toBe('at2')
  })

  it('throws InvalidGrantError on invalid_grant response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: 'invalid_grant',
    }), { status: 400 }))
    await expect(refreshAccessToken('rt')).rejects.toBeInstanceOf(InvalidGrantError)
  })
})

describe('listSites', () => {
  it('returns the siteEntry array with siteUrl + permissionLevel', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      siteEntry: [
        { siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' },
        { siteUrl: 'https://blog.example.com/', permissionLevel: 'siteFullUser' },
      ],
    }), { status: 200 }))
    const sites = await listSites('at')
    expect(sites).toHaveLength(2)
    expect(sites[0].siteUrl).toBe('sc-domain:example.com')
  })
})

describe('querySearchAnalytics', () => {
  it('POSTs dimensions + dates + rowLimit, returns rows with keys split back out', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      rows: [
        { keys: ['2026-04-20', 'seo tool', 'https://site/a'], clicks: 5, impressions: 100, ctr: 0.05, position: 8.2 },
      ],
    }), { status: 200 }))
    const res = await querySearchAnalytics('at', 'sc-domain:example.com', {
      startDate: '2026-04-01', endDate: '2026-04-20', rowLimit: 25000, startRow: 0,
    })
    expect(res.rows[0]).toEqual({
      date: '2026-04-20', query: 'seo tool', page: 'https://site/a',
      clicks: 5, impressions: 100, ctr: 0.05, position: 8.2,
    })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain(encodeURIComponent('sc-domain:example.com'))
    expect(url).toContain('/searchAnalytics/query')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.dimensions).toEqual(['date', 'query', 'page'])
    expect(body.rowLimit).toBe(25000)
  })
})
```

Run: `pnpm test:run src/lib/gsc/client.test.ts`
Expected: FAIL (module missing).

**Step 2: Implement**

```ts
// src/lib/gsc/client.ts
import 'server-only'

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SC_BASE = 'https://searchconsole.googleapis.com/webmasters/v3'

export class InvalidGrantError extends Error {
  constructor() { super('invalid_grant'); this.name = 'InvalidGrantError' }
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} not set`)
  return v
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv('GOOGLE_OAUTH_CLIENT_ID'),
    redirect_uri: requireEnv('GOOGLE_OAUTH_REDIRECT_URL'),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent', // force refresh_token on every connect
    state,
  })
  return `${AUTH_URL}?${params.toString()}`
}

async function postForm(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  })
  const text = await res.text()
  const json = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  return { ok: res.ok, status: res.status, json }
}

export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string; refreshToken: string; expiresInSeconds: number
}> {
  const { ok, status, json } = await postForm(TOKEN_URL, {
    code,
    client_id: requireEnv('GOOGLE_OAUTH_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
    redirect_uri: requireEnv('GOOGLE_OAUTH_REDIRECT_URL'),
    grant_type: 'authorization_code',
  })
  if (!ok) throw new Error(`token exchange failed: ${status} ${JSON.stringify(json)}`)
  return {
    accessToken: json.access_token as string,
    refreshToken: json.refresh_token as string,
    expiresInSeconds: json.expires_in as number,
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string; expiresInSeconds: number
}> {
  const { ok, status, json } = await postForm(TOKEN_URL, {
    refresh_token: refreshToken,
    client_id: requireEnv('GOOGLE_OAUTH_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
    grant_type: 'refresh_token',
  })
  if (!ok) {
    if (json.error === 'invalid_grant') throw new InvalidGrantError()
    throw new Error(`token refresh failed: ${status} ${JSON.stringify(json)}`)
  }
  return {
    accessToken: json.access_token as string,
    expiresInSeconds: json.expires_in as number,
  }
}

export type SiteEntry = { siteUrl: string; permissionLevel: string }

export async function listSites(accessToken: string): Promise<SiteEntry[]> {
  const res = await fetch(`${SC_BASE}/sites`, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`sites.list failed: ${res.status}`)
  const json = (await res.json()) as { siteEntry?: SiteEntry[] }
  return json.siteEntry ?? []
}

export type SearchAnalyticsParams = {
  startDate: string
  endDate: string
  rowLimit: number
  startRow: number
}

export type SearchAnalyticsRow = {
  date: string; query: string; page: string
  clicks: number; impressions: number; ctr: number; position: number
}

export async function querySearchAnalytics(
  accessToken: string,
  propertyUrl: string,
  params: SearchAnalyticsParams,
): Promise<{ rows: SearchAnalyticsRow[] }> {
  const url = `${SC_BASE}/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: ['date', 'query', 'page'],
      rowLimit: params.rowLimit,
      startRow: params.startRow,
      dataState: 'final',
    }),
  })
  if (!res.ok) throw new Error(`searchAnalytics.query failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as { rows?: Array<{
    keys: [string, string, string]; clicks: number; impressions: number; ctr: number; position: number
  }> }
  const rows = (json.rows ?? []).map((r) => ({
    date: r.keys[0], query: r.keys[1], page: r.keys[2],
    clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position,
  }))
  return { rows }
}
```

**Step 3: Pass tests**

Run: `pnpm test:run src/lib/gsc/client.test.ts`
Expected: all tests PASS.

**Step 4: Commit**

```bash
git add src/lib/gsc/client.ts src/lib/gsc/client.test.ts
git commit -m "feat(gsc): raw-fetch client for OAuth + Search Analytics"
```

---

## Task 4: Token refresh + authenticated-client helper

Wraps `gsc_connections` row + `refreshAccessToken` so downstream code calls a single `getGscAccessToken(projectId)`.

**Files:**
- Create: `src/lib/gsc/auth.ts`
- Test: `src/lib/gsc/auth.test.ts`

**Step 1: Write failing test**

```ts
// src/lib/gsc/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  refreshAccessToken: vi.fn(),
  InvalidGrantError: class InvalidGrantError extends Error { constructor() { super('invalid_grant') } },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/crypto/encrypt', () => ({
  encryptJson: (v: unknown) => Buffer.from(`enc:${JSON.stringify(v)}`),
  decryptJson: (b: Buffer) => JSON.parse(b.toString().replace(/^enc:/, '')),
  toBytea: (b: Buffer) => `\\x${b.toString('hex')}`,
  fromBytea: (v: unknown) => Buffer.from(String(v).replace(/^\\x/, ''), 'hex'),
}))

beforeEach(() => vi.clearAllMocks())

describe('getGscAccessToken', () => {
  it('returns cached access token when not expired', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    const mock = vi.mocked(createClient)
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    mock.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: {
                id: 'c1',
                refresh_token_encrypted: Buffer.from('enc:"rt"'),
                access_token_encrypted: Buffer.from('enc:"at-valid"'),
                access_token_expires_at: future,
              },
              error: null,
            }),
          }),
        }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
    } as never)
    const { getGscAccessToken } = await import('./auth')
    const at = await getGscAccessToken('proj-1')
    expect(at).toBe('at-valid')
  })

  it('refreshes and persists when expired', async () => {
    const { refreshAccessToken } = await import('./client')
    vi.mocked(refreshAccessToken).mockResolvedValue({ accessToken: 'at-new', expiresInSeconds: 3600 })
    const { createClient } = await import('@/lib/supabase/server')
    const past = new Date(Date.now() - 1000).toISOString()
    const updateMock = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }))
    vi.mocked(createClient).mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: {
                id: 'c1',
                refresh_token_encrypted: Buffer.from('enc:"rt"'),
                access_token_encrypted: Buffer.from('enc:"at-old"'),
                access_token_expires_at: past,
              },
              error: null,
            }),
          }),
        }),
        update: updateMock,
      }),
    } as never)
    const { getGscAccessToken } = await import('./auth')
    const at = await getGscAccessToken('proj-1')
    expect(at).toBe('at-new')
    expect(refreshAccessToken).toHaveBeenCalledWith('rt')
    expect(updateMock).toHaveBeenCalled()
  })
})
```

Run: `pnpm test:run src/lib/gsc/auth.test.ts`
Expected: FAIL (module missing).

**Step 2: Implement**

```ts
// src/lib/gsc/auth.ts
import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { encryptJson, decryptJson, toBytea, fromBytea } from '@/lib/crypto/encrypt'
import { refreshAccessToken, InvalidGrantError } from './client'

const REFRESH_BUFFER_MS = 5 * 60 * 1000

/**
 * Returns a valid access token for the given project, refreshing if needed.
 * On refresh_token_revoked, updates the connection row's last_sync_error and rethrows.
 */
export async function getGscAccessToken(projectId: string): Promise<string> {
  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('gsc_connections')
    .select('id,refresh_token_encrypted,access_token_encrypted,access_token_expires_at')
    .eq('project_id', projectId)
    .single()
  if (error || !row) throw new Error('no gsc connection for project')

  const expiresAt = row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : 0
  if (row.access_token_encrypted && expiresAt - Date.now() > REFRESH_BUFFER_MS) {
    return decryptJson<string>(fromBytea(row.access_token_encrypted))
  }

  const refreshToken = decryptJson<string>(fromBytea(row.refresh_token_encrypted))
  try {
    const refreshed = await refreshAccessToken(refreshToken)
    const newExpiry = new Date(Date.now() + refreshed.expiresInSeconds * 1000).toISOString()
    const ciphertext = toBytea(encryptJson(refreshed.accessToken))
    await supabase
      .from('gsc_connections')
      .update({
        access_token_encrypted: ciphertext,
        access_token_expires_at: newExpiry,
        last_sync_error: null,
      })
      .eq('id', row.id)
    return refreshed.accessToken
  } catch (err) {
    if (err instanceof InvalidGrantError) {
      await supabase
        .from('gsc_connections')
        .update({ last_sync_error: 'refresh_token_revoked', last_sync_status: 'error' })
        .eq('id', row.id)
    }
    throw err
  }
}
```

**Step 3: Pass tests**

Run: `pnpm test:run src/lib/gsc/auth.test.ts`
Expected: 2/2 PASS.

**Step 4: Commit**

```bash
git add src/lib/gsc/auth.ts src/lib/gsc/auth.test.ts
git commit -m "feat(gsc): token refresh helper with revoke detection"
```

---

## Task 5: OAuth start route

Route that begins the OAuth flow. Sets signed state with `projectId`, redirects to Google.

**Files:**
- Create: `src/app/api/gsc/oauth/start/route.ts`

**Step 1: Implement**

```ts
// src/app/api/gsc/oauth/start/route.ts
import { createClient } from '@/lib/supabase/server'
import { signState } from '@/lib/gsc/state'
import { buildAuthUrl } from '@/lib/gsc/client'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const projectId = url.searchParams.get('projectId')
  if (!projectId) return new Response('projectId required', { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Verify the user has access to the project. RLS will enforce on actual writes,
  // but an early check avoids leaking OAuth flows for projects the user can't touch.
  const { data: project } = await supabase
    .from('projects').select('id').eq('id', projectId).maybeSingle()
  if (!project) return new Response('Not found', { status: 404 })

  const state = signState(projectId)
  return Response.redirect(buildAuthUrl(state), 302)
}
```

**Step 2: Manual smoke (deferred until Task 7 wires the Settings card)**

Note: No automated test. Manual verification happens after Task 7 — trying to craft a unit test for "it redirects to Google" is low value.

**Step 3: Commit**

```bash
git add src/app/api/gsc/oauth/start/route.ts
git commit -m "feat(gsc): OAuth start route"
```

---

## Task 6: OAuth callback route

Exchanges code for tokens, lists properties, stores pending connection, shows a property picker page.

**Design decision:** The picker is server-rendered at `/api/gsc/oauth/callback` as a plain HTML form (no client bundle). Posting the form hits a separate `/api/gsc/oauth/finalize` route that writes the `gsc_connections` row.

**Files:**
- Create: `src/app/api/gsc/oauth/callback/route.ts`
- Create: `src/app/api/gsc/oauth/finalize/route.ts`

**Step 1: Implement callback**

```ts
// src/app/api/gsc/oauth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { verifyState } from '@/lib/gsc/state'
import { exchangeCodeForTokens, listSites } from '@/lib/gsc/client'
import { encryptJson, toBytea } from '@/lib/crypto/encrypt'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateParam = url.searchParams.get('state')
  if (!code || !stateParam) return new Response('bad request', { status: 400 })

  let projectId: string
  try {
    projectId = verifyState(stateParam).projectId
  } catch {
    return new Response('invalid state', { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const tokens = await exchangeCodeForTokens(code)
  const sites = await listSites(tokens.accessToken)
  if (sites.length === 0) {
    return htmlResponse(renderErrorPage('No Search Console properties found for this Google account.', projectId))
  }

  // Fetch user email for display
  const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${tokens.accessToken}` },
  })
  const profile = profileRes.ok ? (await profileRes.json()) as { email?: string } : {}
  const googleEmail = profile.email ?? ''

  // Temporarily stash the tokens in the session cookie — or the simpler route:
  // render the picker with the tokens as hidden inputs. Re-exchange is not possible
  // (Google returns the same refresh token only with prompt=consent), so we take the
  // tradeoff of a short-lived signed envelope in a hidden field.
  const envelope = toBytea(encryptJson({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresInSeconds * 1000,
    googleEmail,
    projectId,
  }))

  return htmlResponse(renderPickerPage(projectId, googleEmail, sites, envelope))
}

function htmlResponse(html: string) {
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function renderPickerPage(projectId: string, email: string, sites: Array<{ siteUrl: string }>, envelope: string) {
  const options = sites.map((s) => `<option value="${escape(s.siteUrl)}">${escape(s.siteUrl)}</option>`).join('')
  return `<!doctype html>
<html><head><title>Connect GSC</title>
<style>body{font-family:system-ui;max-width:480px;margin:40px auto;padding:20px}
label{display:block;margin-top:12px}select,input[type=submit]{padding:8px;margin-top:4px;width:100%}
</style></head><body>
<h1>Pick a Search Console property</h1>
<p>Connected as <strong>${escape(email)}</strong>.</p>
<form method="post" action="/api/gsc/oauth/finalize">
  <input type="hidden" name="envelope" value="${envelope}" />
  <label>Property<select name="propertyUrl">${options}</select></label>
  <input type="submit" value="Connect" />
</form>
<p><a href="/projects/${escape(projectId)}/settings">Cancel</a></p>
</body></html>`
}

function renderErrorPage(message: string, projectId: string) {
  return `<!doctype html><html><body style="font-family:system-ui;max-width:480px;margin:40px auto;padding:20px">
<h1>Connection failed</h1><p>${escape(message)}</p>
<p><a href="/projects/${escape(projectId)}/settings">Back to settings</a></p>
</body></html>`
}
```

**Step 2: Implement finalize**

```ts
// src/app/api/gsc/oauth/finalize/route.ts
import { createClient } from '@/lib/supabase/server'
import { decryptJson, encryptJson, toBytea, fromBytea } from '@/lib/crypto/encrypt'

export const runtime = 'nodejs'

type Envelope = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  googleEmail: string
  projectId: string
}

export async function POST(req: Request) {
  const form = await req.formData()
  const envelopeRaw = form.get('envelope')
  const propertyUrl = form.get('propertyUrl')
  if (typeof envelopeRaw !== 'string' || typeof propertyUrl !== 'string') {
    return new Response('bad request', { status: 400 })
  }

  let envelope: Envelope
  try {
    envelope = decryptJson<Envelope>(fromBytea(envelopeRaw))
  } catch {
    return new Response('invalid envelope', { status: 400 })
  }

  if (Date.now() > envelope.expiresAt - 60_000) {
    return new Response('envelope expired, reconnect', { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: membership } = await supabase
    .from('tenant_members').select('tenant_id').eq('user_id', user.id).single()
  if (!membership) return new Response('No tenant', { status: 400 })

  const refreshCt = toBytea(encryptJson(envelope.refreshToken))
  const accessCt = toBytea(encryptJson(envelope.accessToken))
  const expiresAtIso = new Date(envelope.expiresAt).toISOString()

  const { error } = await supabase.from('gsc_connections').upsert({
    project_id: envelope.projectId,
    tenant_id: membership.tenant_id,
    google_user_email: envelope.googleEmail,
    property_url: propertyUrl,
    refresh_token_encrypted: refreshCt,
    access_token_encrypted: accessCt,
    access_token_expires_at: expiresAtIso,
    last_sync_status: null,
    last_sync_error: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'project_id' })
  if (error) return new Response(`db error: ${error.message}`, { status: 500 })

  return Response.redirect(new URL(`/zh-TW/projects/${envelope.projectId}/settings?gsc=connected`, req.url), 303)
}
```

**Step 3: Manual smoke**

Deferred until Task 7 wires the Settings card. Document in the Task 7 commit.

**Step 4: Commit**

```bash
git add src/app/api/gsc/oauth/callback/route.ts src/app/api/gsc/oauth/finalize/route.ts
git commit -m "feat(gsc): OAuth callback + property-picker finalize"
```

---

## Task 7: Settings page GSC card

Reuses the `_connection-ui.tsx` helpers (`LastTestBadge`, `StatusLines`). A minimal card that shows "Not connected → Connect button" OR "Connected as X → Property, last synced, Disconnect, Sync now".

**Files:**
- Create: `src/app/[locale]/(app)/projects/[projectId]/settings/_gsc-connection-card.tsx`
- Modify: `src/app/[locale]/(app)/projects/[projectId]/settings/page.tsx` — load `gsc_connections`, render the card below the Shopify form.
- Create: `src/app/[locale]/(app)/projects/[projectId]/settings/gsc-actions.ts` — `disconnectGscAction`, `syncGscNowAction` server actions (sync delegated to the sync function from Task 8).
- Modify: `messages/en/publish.json`, `messages/zh-TW/publish.json` — new keys under a `gsc_*` prefix.

**Step 1: Add i18n keys**

Append to both locales' `publish.json` (en):
```json
"gsc_title": "Google Search Console",
"gsc_connect": "Connect Google Search Console",
"gsc_connected_as": "Connected as {email}",
"gsc_property": "Property: {url}",
"gsc_last_synced": "Last synced {when}",
"gsc_never_synced": "Not synced yet",
"gsc_sync_now": "Sync now",
"gsc_syncing": "Syncing…",
"gsc_sync_done": "Synced {rows} rows",
"gsc_disconnect": "Disconnect",
"gsc_reconnect_needed": "Google access was revoked. Reconnect to resume syncing.",
"gsc_connected_banner": "Connected. First sync started."
```

zh-TW mirrors with translated strings.

**Step 2: Add server actions**

```ts
// src/app/[locale]/(app)/projects/[projectId]/settings/gsc-actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { runGscSync } from '@/lib/gsc/sync' // from Task 8

export async function disconnectGscAction(projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('gsc_connections').delete().eq('project_id', projectId)
  if (error) throw error
  revalidatePath(`/projects/${projectId}/settings`)
}

export async function syncGscNowAction(projectId: string): Promise<{ rowsInserted: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Rate limit: 1 run/hour per project
  const { data: lastRun } = await supabase
    .from('gsc_sync_runs')
    .select('started_at')
    .eq('project_id', projectId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastRun && Date.now() - new Date(lastRun.started_at).getTime() < 60 * 60 * 1000) {
    throw new Error('Please wait an hour between manual syncs.')
  }

  const result = await runGscSync(projectId)
  revalidatePath(`/projects/${projectId}/settings`)
  return { rowsInserted: result.rowsInserted }
}
```

**Step 3: Build the card**

See implementation pattern in `_shopify-connection-form.tsx`. Keep it ~100 LOC: buttons (`Connect`/`Sync now`/`Disconnect`), status line, `LastTestBadge`-style indicators.

Key points:
- "Connect" is an anchor pointing to `/api/gsc/oauth/start?projectId=...`.
- "Sync now" calls `syncGscNowAction`, then `router.refresh()`.
- If `last_sync_error === 'refresh_token_revoked'` render a reconnect banner and disable Sync now.

**Step 4: Wire into page.tsx**

Add one query for `gsc_connections` alongside the existing Ghost/Shopify queries. Render `<GscConnectionCard projectId={projectId} initial={gscRow} />` below `<ShopifyConnectionForm>`.

**Step 5: Manual smoke (no automated test — browser flow)**

1. Create a Google Cloud OAuth 2.0 client with `webmasters.readonly` scope and the redirect URL in `.env.local`.
2. `pnpm dev`
3. Go to `/zh-TW/projects/<id>/settings` → click "Connect Google Search Console".
4. Complete consent, pick a property, confirm redirect back with `?gsc=connected` banner.
5. Verify `gsc_connections` row in DB with encrypted tokens, correct email/property.
6. Click "Disconnect" → row deleted; "Connect" button reappears.

Document these steps in the commit body.

**Step 6: Commit**

```bash
git add src/app/[locale]/(app)/projects/[projectId]/settings/ messages/
git commit -m "feat(gsc): Settings card with Connect / Disconnect / Sync now"
```

---

## Task 8: Sync function

Single entry point `runGscSync(projectId)` — used by both manual action (Task 7) and cron (Task 9).

**Files:**
- Create: `src/lib/gsc/sync.ts`
- Test: `src/lib/gsc/sync.test.ts`

**Step 1: Write failing tests**

Focus tests on three behaviors:
1. Date window calculation (3-day overlap + 16-day cap).
2. Pagination stops when `rows.length < rowLimit`.
3. Upsert is called with correct column shape; run is logged to `gsc_sync_runs`.

```ts
// src/lib/gsc/sync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeSyncWindow } from './sync'

describe('computeSyncWindow', () => {
  const TODAY = '2026-04-23'

  it('uses 16-day cold start when last_synced_at is null', () => {
    const w = computeSyncWindow(null, new Date(TODAY))
    expect(w.startDate).toBe('2026-04-07') // today - 16
    expect(w.endDate).toBe('2026-04-22')   // today - 1
  })

  it('uses last_synced_at - 3 days for warm runs', () => {
    const w = computeSyncWindow('2026-04-18T00:00:00Z', new Date(TODAY))
    expect(w.startDate).toBe('2026-04-15')
    expect(w.endDate).toBe('2026-04-22')
  })

  it('caps start at today-16 even if last_synced_at is much earlier', () => {
    const w = computeSyncWindow('2026-01-01T00:00:00Z', new Date(TODAY))
    expect(w.startDate).toBe('2026-04-07')
  })
})

// Higher-level sync tests with mocked dependencies — verify logging and upsert shape.
// Exercise left as implementation tests; keep them small (one happy path, one error path).
```

Run: `pnpm test:run src/lib/gsc/sync.test.ts`
Expected: FAIL — module missing.

**Step 2: Implement**

```ts
// src/lib/gsc/sync.ts
import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getGscAccessToken } from './auth'
import { querySearchAnalytics, type SearchAnalyticsRow } from './client'

const ROW_LIMIT = 25000
const MAX_ROWS_PER_RUN = 100_000

export function computeSyncWindow(lastSyncedAt: string | null, today: Date): {
  startDate: string; endDate: string
} {
  const end = new Date(today); end.setUTCDate(end.getUTCDate() - 1)
  const coldStart = new Date(today); coldStart.setUTCDate(coldStart.getUTCDate() - 16)
  let start: Date
  if (!lastSyncedAt) {
    start = coldStart
  } else {
    const warm = new Date(lastSyncedAt); warm.setUTCDate(warm.getUTCDate() - 3)
    start = warm < coldStart ? coldStart : warm
  }
  return { startDate: toIsoDate(start), endDate: toIsoDate(end) }
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export async function runGscSync(projectId: string): Promise<{
  rowsInserted: number; status: 'ok' | 'partial' | 'error'
}> {
  const supabase = await createClient()

  const { data: conn, error } = await supabase
    .from('gsc_connections')
    .select('id, tenant_id, property_url, last_synced_at')
    .eq('project_id', projectId)
    .single()
  if (error || !conn) throw new Error('no gsc connection')

  const { data: runStart } = await supabase
    .from('gsc_sync_runs')
    .insert({
      project_id: projectId,
      tenant_id: conn.tenant_id,
      status: 'error', // will be updated on success
    })
    .select('id')
    .single()
  const runId = runStart?.id

  const window = computeSyncWindow(conn.last_synced_at, new Date())

  let rowsInserted = 0
  let status: 'ok' | 'partial' | 'error' = 'ok'
  let errorMsg: string | null = null

  try {
    const accessToken = await getGscAccessToken(projectId)

    let startRow = 0
    while (rowsInserted < MAX_ROWS_PER_RUN) {
      const { rows } = await querySearchAnalytics(accessToken, conn.property_url, {
        startDate: window.startDate, endDate: window.endDate,
        rowLimit: ROW_LIMIT, startRow,
      })
      if (rows.length === 0) break

      const upsertRows = rows.map((r: SearchAnalyticsRow) => ({
        project_id: projectId,
        tenant_id: conn.tenant_id,
        date: r.date,
        query: r.query,
        page_url: r.page,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      }))

      const { error: upsertErr } = await supabase
        .from('gsc_daily_query_page')
        .upsert(upsertRows, { onConflict: 'project_id,date,query,normalized_page_url' })
      if (upsertErr) throw new Error(`upsert failed: ${upsertErr.message}`)

      rowsInserted += rows.length
      if (rows.length < ROW_LIMIT) break
      startRow += ROW_LIMIT
    }

    if (rowsInserted >= MAX_ROWS_PER_RUN) status = 'partial'
  } catch (err) {
    status = 'error'
    errorMsg = err instanceof Error ? err.message : String(err)
  }

  await supabase
    .from('gsc_connections')
    .update({
      last_synced_at: status === 'error' ? undefined : new Date().toISOString(),
      last_sync_status: status,
      last_sync_error: errorMsg,
    })
    .eq('id', conn.id)

  if (runId) {
    await supabase
      .from('gsc_sync_runs')
      .update({
        finished_at: new Date().toISOString(),
        rows_inserted: rowsInserted,
        status,
        error: errorMsg,
      })
      .eq('id', runId)
  }

  if (status === 'error' && errorMsg) throw new Error(errorMsg)
  return { rowsInserted, status }
}
```

**Step 3: Pass tests**

Run: `pnpm test:run src/lib/gsc/sync.test.ts`
Expected: PASS (just the `computeSyncWindow` tests here).

**Step 4: Manual integration test (local Supabase + mocked GSC via env toggle)**

Not strictly necessary — the cron task (Task 9) will exercise this end-to-end. Document the first real-connection smoke run in that task's commit.

**Step 5: Commit**

```bash
git add src/lib/gsc/sync.ts src/lib/gsc/sync.test.ts
git commit -m "feat(gsc): sync function with 3-day overlap + pagination + audit log"
```

---

## Task 9: Cron route + vercel.json

**Files:**
- Create: `src/app/api/cron/gsc-sync/route.ts`
- Create: `vercel.json` (at repo root)

**Step 1: Implement the cron route**

```ts
// src/app/api/cron/gsc-sync/route.ts
import { createClient } from '@/lib/supabase/server'
import { runGscSync } from '@/lib/gsc/sync'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('forbidden', { status: 403 })
  }

  const supabase = await createClient()
  const { data: conns } = await supabase
    .from('gsc_connections')
    .select('project_id')

  const results: Array<{ projectId: string; ok: boolean; rows?: number; error?: string }> = []
  for (const { project_id } of conns ?? []) {
    try {
      const r = await runGscSync(project_id)
      results.push({ projectId: project_id, ok: true, rows: r.rowsInserted })
    } catch (err) {
      results.push({ projectId: project_id, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return Response.json({ ran: results.length, results })
}
```

**Step 2: Add vercel.json**

```json
{
  "crons": [
    { "path": "/api/cron/gsc-sync", "schedule": "0 3 * * *" }
  ]
}
```

**Step 3: Manual test**

Locally: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/gsc-sync` — should sync any connected projects. Inspect `gsc_daily_query_page` for rows and `gsc_sync_runs` for the audit entry.

**Step 4: Commit**

```bash
git add src/app/api/cron/gsc-sync/route.ts vercel.json
git commit -m "feat(gsc): daily cron route for background sync"
```

---

## Task 10: Opportunities inbox queries (SQL helper)

Server-only helper that returns the three opportunity lists. Keep this as plain TypeScript functions against the Supabase client — easier to test than raw SQL blobs.

**Files:**
- Create: `src/lib/gsc/opportunities.ts`
- Test: `src/lib/gsc/opportunities.test.ts`

**Step 1: Write failing tests**

Tests seed a small fixture into the Supabase mock client and assert the shape + ordering of the three result sets. Split the file into three describes; each fixture tailored to the category.

Keep shapes honest:
```ts
export type StrikingDistanceRow = {
  query: string; normalized_page_url: string
  clicks: number; impressions: number; avg_position: number
  matching_article_id: string | null
}
export type RisingQueryRow = {
  query: string
  current_impressions: number; previous_impressions: number
  growth: number  // absolute delta
}
export type DecayingPageRow = {
  normalized_page_url: string
  current_clicks: number; previous_clicks: number
  decline_pct: number  // 0..1
  matching_article_id: string | null
}
```

(Full test bodies can follow the `normalize.test.ts` style — mock Supabase responses, call each function, assert output. Include at least one "handles empty data" case per function.)

**Step 2: Implement**

Each function runs an explicit SQL query using `supabase.rpc()` OR uses the chainable builder. Given the aggregations involved, `rpc()` to a PL/pgSQL function is cleaner. Add the SQL functions to a new migration.

Add to a new migration `supabase/migrations/20260423000100_gsc_rpcs.sql`:

```sql
CREATE OR REPLACE FUNCTION public.gsc_striking_distance(p_project uuid, p_window_days int)
RETURNS TABLE(
  query text, normalized_page_url text,
  clicks bigint, impressions bigint, avg_position numeric,
  matching_article_id uuid
) AS $$
  WITH agg AS (
    SELECT
      gdp.query,
      gdp.normalized_page_url,
      SUM(gdp.clicks)::bigint AS clicks,
      SUM(gdp.impressions)::bigint AS impressions,
      (SUM(gdp.position * gdp.impressions) / NULLIF(SUM(gdp.impressions),0))::numeric AS avg_position
    FROM gsc_daily_query_page gdp
    WHERE gdp.project_id = p_project
      AND gdp.date >= CURRENT_DATE - (p_window_days || ' days')::interval
    GROUP BY gdp.query, gdp.normalized_page_url
  )
  SELECT
    agg.query, agg.normalized_page_url, agg.clicks, agg.impressions, agg.avg_position,
    (SELECT pt.article_id
     FROM publish_targets pt
     WHERE pt.normalized_url = agg.normalized_page_url
     LIMIT 1) AS matching_article_id
  FROM agg
  WHERE agg.avg_position BETWEEN 5 AND 20 AND agg.impressions >= 100
  ORDER BY agg.impressions DESC
  LIMIT 100;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.gsc_rising_queries(p_project uuid, p_window_days int)
RETURNS TABLE(
  query text,
  current_impressions bigint, previous_impressions bigint,
  growth bigint
) AS $$
  WITH cur AS (
    SELECT query, SUM(impressions)::bigint AS impressions
    FROM gsc_daily_query_page
    WHERE project_id = p_project
      AND date >= CURRENT_DATE - (p_window_days || ' days')::interval
    GROUP BY query
  ),
  prev AS (
    SELECT query, SUM(impressions)::bigint AS impressions
    FROM gsc_daily_query_page
    WHERE project_id = p_project
      AND date >= CURRENT_DATE - (2 * p_window_days || ' days')::interval
      AND date <  CURRENT_DATE - (p_window_days || ' days')::interval
    GROUP BY query
  )
  SELECT
    cur.query,
    cur.impressions AS current_impressions,
    COALESCE(prev.impressions, 0) AS previous_impressions,
    (cur.impressions - COALESCE(prev.impressions, 0)) AS growth
  FROM cur
  LEFT JOIN prev USING (query)
  WHERE cur.impressions >= 50
    AND (COALESCE(prev.impressions, 0) = 0 OR cur.impressions::numeric / NULLIF(prev.impressions, 0) >= 1.5)
  ORDER BY growth DESC
  LIMIT 100;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.gsc_decaying_pages(p_project uuid, p_window_days int)
RETURNS TABLE(
  normalized_page_url text,
  current_clicks bigint, previous_clicks bigint,
  decline_pct numeric,
  matching_article_id uuid
) AS $$
  WITH cur AS (
    SELECT normalized_page_url, SUM(clicks)::bigint AS clicks
    FROM gsc_daily_query_page
    WHERE project_id = p_project
      AND date >= CURRENT_DATE - (p_window_days || ' days')::interval
    GROUP BY normalized_page_url
  ),
  prev AS (
    SELECT normalized_page_url, SUM(clicks)::bigint AS clicks
    FROM gsc_daily_query_page
    WHERE project_id = p_project
      AND date >= CURRENT_DATE - (2 * p_window_days || ' days')::interval
      AND date <  CURRENT_DATE - (p_window_days || ' days')::interval
    GROUP BY normalized_page_url
  )
  SELECT
    cur.normalized_page_url,
    cur.clicks AS current_clicks,
    COALESCE(prev.clicks, 0) AS previous_clicks,
    1 - (cur.clicks::numeric / NULLIF(prev.clicks, 0)) AS decline_pct,
    (SELECT pt.article_id FROM publish_targets pt
     WHERE pt.normalized_url = cur.normalized_page_url LIMIT 1) AS matching_article_id
  FROM cur
  JOIN prev USING (normalized_page_url)
  WHERE prev.clicks >= 50
    AND cur.clicks::numeric / NULLIF(prev.clicks, 0) <= 0.7
  ORDER BY (prev.clicks - cur.clicks) DESC
  LIMIT 100;
$$ LANGUAGE sql STABLE;
```

Then the TS wrapper:

```ts
// src/lib/gsc/opportunities.ts
import 'server-only'
import { createClient } from '@/lib/supabase/server'

export const DEFAULT_WINDOW = 28

export async function getStrikingDistance(projectId: string, windowDays = DEFAULT_WINDOW) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('gsc_striking_distance', {
    p_project: projectId, p_window_days: windowDays,
  })
  if (error) throw error
  return data ?? []
}

export async function getRisingQueries(projectId: string, windowDays = DEFAULT_WINDOW) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('gsc_rising_queries', {
    p_project: projectId, p_window_days: windowDays,
  })
  if (error) throw error
  return data ?? []
}

export async function getDecayingPages(projectId: string, windowDays = DEFAULT_WINDOW) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('gsc_decaying_pages', {
    p_project: projectId, p_window_days: windowDays,
  })
  if (error) throw error
  return data ?? []
}
```

**Step 3: Apply migration**

```bash
npx supabase migration up --local
pnpm db:types
```

**Step 4: Test with real fixture data**

Write an integration-style test that populates `gsc_daily_query_page` via a test Supabase client and calls each helper. If the test harness doesn't support this, fall back to manual: seed 5-10 rows in the local DB, call each RPC with `supabase sql`, verify output.

**Step 5: Commit**

```bash
git add supabase/migrations/20260423000100_gsc_rpcs.sql src/lib/gsc/opportunities.ts src/lib/gsc/opportunities.test.ts src/lib/supabase/types.ts
git commit -m "feat(gsc): opportunity RPCs for striking/rising/decaying"
```

---

## Task 11: Opportunities page + nav link

**Files:**
- Create: `src/app/[locale]/(app)/projects/[projectId]/opportunities/page.tsx`
- Create: `src/app/[locale]/(app)/projects/[projectId]/opportunities/_tabs.tsx` (client component — tab state via `view` search param, server-rendered content per tab)
- Modify: `src/components/projects-sidebar.tsx` — add `nav_opportunities` nav item between Articles and Brand.
- Modify: `messages/en/projects.json`, `messages/zh-TW/projects.json` — add `nav_opportunities` key.
- Modify: `messages/en/planning.json`, `messages/zh-TW/planning.json` (or create `opportunities.json`) — add all strings for the page.

**Design:** Three server components, one per opportunity category. Each takes the RPC result and renders a table. Use existing Tailwind patterns (`bg-white`, `rounded-xl`, `text-ink`, `text-ink-3`) from Settings page for consistency.

**Step 1: i18n keys**

Add to both locales (example in en):
```json
"nav_opportunities": "Opportunities"   // in projects.json
```

Create `messages/en/opportunities.json`:
```json
{
  "title": "Content opportunities",
  "empty_data": "Sync needs at least 2 weeks of data for most insights.",
  "striking_title": "Striking distance",
  "striking_help": "Queries ranking position 5–20 with ≥100 impressions. Push these up with a refresh or internal links.",
  "rising_title": "Rising queries",
  "rising_help": "Queries whose impressions grew ≥50% this 28-day window vs the previous one.",
  "decaying_title": "Decaying pages",
  "decaying_help": "Pages whose clicks dropped ≥30% this 28-day window vs the previous one.",
  "col_query": "Query",
  "col_page": "Page",
  "col_clicks": "Clicks",
  "col_impressions": "Impressions",
  "col_position": "Position",
  "col_current": "Current",
  "col_previous": "Previous",
  "col_growth": "Growth",
  "col_decline": "Decline",
  "open_article": "Open article",
  "refresh_article": "Refresh article"
}
```

Register the new namespace in `src/i18n/request.ts` (add `opportunities` to the merged messages object — check existing pattern; if current setup wildcards the dir it's automatic).

**Step 2: Page**

Server component that calls the three helpers in parallel and passes results to three sub-tables. If the project has no `gsc_connections` row, render an empty state linking to Settings. If the sum of rows across all three is zero AND the connection is < 14 days old, render "need more data" empty state.

Each table row with a `matching_article_id` renders an "Open article" / "Refresh article" button that links to `/projects/<pid>/articles/<aid>/editor`.

**Step 3: Nav link**

Add to `navItems` in `src/components/projects-sidebar.tsx`:
```ts
{ href: `/projects/${currentId}/opportunities`, label: t('nav_opportunities') },
```
Position: after Articles, before Brand.

**Step 4: Manual smoke**

1. Seed some GSC data (either via real sync or SQL inserts).
2. Navigate to `/projects/<id>/opportunities`.
3. Confirm all three sections render, empty states work, and "Open article" links deep-link correctly.

**Step 5: Commit**

```bash
git add src/app/[locale]/\(app\)/projects/\[projectId\]/opportunities/ src/components/projects-sidebar.tsx messages/
git commit -m "feat(gsc): Opportunities inbox with striking/rising/decaying"
```

---

## Task 12: Per-article Performance tab

**Files:**
- Create: `src/app/[locale]/(focus)/projects/[projectId]/articles/[articleId]/performance/_performance-tab.tsx`
- Modify: `src/app/[locale]/(focus)/projects/[projectId]/articles/[articleId]/page.tsx` — render the tab when `view === 'performance'`.
- Modify: `src/app/[locale]/(focus)/projects/[projectId]/articles/[articleId]/_article-screen.tsx` — add a "Performance" tab next to existing tabs.
- Modify: `messages/en/articles.json`, `messages/zh-TW/articles.json` — add `nav_performance` and any needed labels.

**Step 1: Data loader**

In `page.tsx`, when `view === 'performance'`:

1. Look up the most-recent successful `publish_targets` row for this article: `SELECT normalized_url FROM publish_targets WHERE article_id = :id AND remote_url IS NOT NULL ORDER BY published_at DESC LIMIT 1`.
2. If no row → render `<PerformanceTab mode="not-published" />`.
3. Else query `gsc_daily_query_page` for the last 28 days filtered by `project_id` + `normalized_page_url`. Also query previous 28-day period for delta calculations.
4. Aggregate summary tiles (clicks, impressions, CTR as `clicks / impressions`, weighted-average position).
5. Aggregate per-day rollup for the chart (`date, clicks, impressions`).
6. Aggregate per-query top 20 by clicks.
7. Pass all three into `<PerformanceTab>`.

**Step 2: UI component**

A client component (only needed because the chart is easiest as SVG via a small self-built renderer — no external chart lib; draw two polylines by mapping daily clicks + impressions to SVG coordinates). Keep it simple: 400×120 SVG, axis labels optional.

**Step 3: Range selector**

Add 7d / 28d / 90d toggle that updates a local state, refetches via a small `/api/gsc/performance?articleId=...&range=...` GET endpoint (server route that returns the same data shape). Alternatively: re-route via `?view=performance&range=90` search param and let the server re-fetch. The latter is simpler — use that.

**Step 4: Manual smoke**

1. Pick a published article that has real GSC data.
2. Open Performance tab.
3. Verify summary tiles, chart, top-queries table.
4. Toggle to 7d / 90d — verify numbers change sensibly.
5. Open an unpublished article → verify "publish first" empty state.
6. Open a published article whose URL doesn't match any GSC row (e.g. typo) → verify "no data for this URL" empty state showing the `normalized_url` we looked up.

**Step 5: Commit**

```bash
git add src/app/[locale]/\(focus\)/ messages/
git commit -m "feat(gsc): per-article Performance tab"
```

---

## Task 13: Planning wizard Step 1 GSC injection

**Files:**
- Modify: `src/app/api/ai/plan/step1/route.ts` — accept optional `search_data` in body, inject into prompt.
- Modify: `src/lib/ai/prompts.ts` — `planStep1System` gets new paragraph about `<search_data>`.
- Create: `src/lib/gsc/topic-match.ts` — tokenise topic and pull matching queries from Postgres.
- Create: `src/lib/gsc/topic-match.test.ts`.
- Modify: `src/app/[locale]/(app)/projects/[projectId]/planning/new/_wizard.tsx` — before calling `/api/ai/plan/step1`, call a new `fetchGscSearchData` server action that returns the matched rows.
- Create: `src/app/[locale]/(app)/projects/[projectId]/planning/new/gsc-search-data-action.ts`.

**Step 1: Tokeniser test**

```ts
// src/lib/gsc/topic-match.test.ts
import { describe, it, expect } from 'vitest'
import { tokenizeTopic } from './topic-match'

describe('tokenizeTopic', () => {
  it('lowercases, splits whitespace, drops short tokens', () => {
    expect(tokenizeTopic('SEO Tool for Shopify')).toEqual(['seo', 'tool', 'for', 'shopify'])
  })
  it('keeps CJK ideographs as individual tokens (bigrams optional later)', () => {
    expect(tokenizeTopic('電商 SEO 策略')).toEqual(['電商', 'seo', '策略'])
  })
  it('dedupes', () => {
    expect(tokenizeTopic('seo seo tools')).toEqual(['seo', 'tools'])
  })
  it('strips punctuation', () => {
    expect(tokenizeTopic('seo: tools, for startups.')).toEqual(['seo', 'tools', 'for', 'startups'])
  })
})
```

Run: `pnpm test:run src/lib/gsc/topic-match.test.ts`
Expected: FAIL.

**Step 2: Implement tokeniser + matcher**

```ts
// src/lib/gsc/topic-match.ts
import 'server-only'
import { createClient } from '@/lib/supabase/server'

export function tokenizeTopic(topic: string): string[] {
  const normalized = topic.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ')
  const tokens = normalized.split(/\s+/).filter((t) => t.length > 0)
  return Array.from(new Set(tokens))
}

export type SearchDataRow = {
  query: string
  impressions: number
  clicks: number
  avg_position: number
}

export async function getSearchDataForTopic(
  projectId: string,
  topic: string,
): Promise<SearchDataRow[]> {
  const tokens = tokenizeTopic(topic)
  if (tokens.length === 0) return []

  const supabase = await createClient()
  // Build an OR filter: query ILIKE %t1% OR query ILIKE %t2% ...
  const orClauses = tokens.map((t) => `query.ilike.%${t.replace(/[%_\\]/g, '\\$&')}%`).join(',')

  const since = new Date(); since.setUTCDate(since.getUTCDate() - 90)
  const { data, error } = await supabase
    .from('gsc_daily_query_page')
    .select('query,impressions,clicks,position')
    .eq('project_id', projectId)
    .gte('date', since.toISOString().slice(0, 10))
    .or(orClauses)

  if (error) throw error

  // Aggregate by query
  const agg = new Map<string, { impressions: number; clicks: number; positionSum: number }>()
  for (const r of data ?? []) {
    const prev = agg.get(r.query) ?? { impressions: 0, clicks: 0, positionSum: 0 }
    prev.impressions += r.impressions
    prev.clicks += r.clicks
    prev.positionSum += r.position * r.impressions
    agg.set(r.query, prev)
  }

  return Array.from(agg.entries())
    .map(([query, v]) => ({
      query,
      impressions: v.impressions,
      clicks: v.clicks,
      avg_position: v.impressions > 0 ? v.positionSum / v.impressions : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 40)
}
```

**Step 3: Pass tokeniser tests**

Run: `pnpm test:run src/lib/gsc/topic-match.test.ts`
Expected: 4/4 PASS.

**Step 4: Update Step 1 prompt**

In `src/lib/ai/prompts.ts`:
```ts
export function planStep1System(pillarCount: number): string {
  return `You are an experienced SEO content strategist.
Given a topic, propose exactly ${pillarCount} core aspects the content hub should cover, plus a short overall strategy.
If <search_data> is provided, ground the proposed core aspects in queries that show real demand. Prefer aspects where users are already searching but the site has weak coverage (avg_position > 10).
Respond in the project's content_locale. Output plain text with short headings; no JSON, no markdown code fences.`
}
```

**Step 5: Extend Step 1 route**

`src/app/api/ai/plan/step1/route.ts`:
```ts
const bodySchema = z.object({
  projectId: z.string().uuid(),
  topic: z.string().min(1).max(500),
  audience_supplement: z.string().max(1000).optional(),
  pillarCount: z.number().int().min(3).max(6).default(3),
  search_data: z.array(z.object({
    query: z.string(),
    impressions: z.number(),
    clicks: z.number(),
    avg_position: z.number(),
  })).optional(),
})
```

And in the handler body, after building the system prompt:
```ts
const searchDataBlock = parsed.data.search_data && parsed.data.search_data.length > 0
  ? `\n\n<search_data>\n${parsed.data.search_data
      .map((q) => `<query><text>${q.query}</text><impressions>${q.impressions}</impressions><clicks>${q.clicks}</clicks><avg_position>${q.avg_position.toFixed(1)}</avg_position></query>`)
      .join('\n')}\n</search_data>`
  : ''
```
Append `searchDataBlock` to the `prompt` parameter passed to `streamText`.

**Step 6: Wizard integration**

Add server action:
```ts
// src/app/[locale]/(app)/projects/[projectId]/planning/new/gsc-search-data-action.ts
'use server'
import { getSearchDataForTopic } from '@/lib/gsc/topic-match'
import { createClient } from '@/lib/supabase/server'

export async function fetchGscSearchDataAction(projectId: string, topic: string) {
  const supabase = await createClient()
  const { data: conn } = await supabase
    .from('gsc_connections')
    .select('last_synced_at')
    .eq('project_id', projectId)
    .maybeSingle()
  if (!conn || !conn.last_synced_at) return []
  return getSearchDataForTopic(projectId, topic)
}
```

In `_wizard.tsx`'s `runStep1()`:
```ts
const searchData = await fetchGscSearchDataAction(projectId, topic).catch(() => [])
// ...
body: JSON.stringify({
  projectId, topic, audience_supplement: audience || undefined, pillarCount,
  search_data: searchData.length > 0 ? searchData : undefined,
}),
```

**Step 7: Manual smoke**

1. Project with GSC connected + synced data.
2. Run the wizard with a topic that overlaps GSC queries → inspect the network request to `/api/ai/plan/step1`; confirm `search_data` is present in the body.
3. Check the generated direction heuristically — does it reference language close to what's in the GSC data? (Subjective but useful.)
4. Run on a project without a connection → no `search_data` in body; wizard works exactly as before.

**Step 8: Commit**

```bash
git add src/lib/gsc/topic-match.ts src/lib/gsc/topic-match.test.ts src/lib/ai/prompts.ts src/app/api/ai/plan/step1/route.ts src/app/\[locale\]/\(app\)/projects/\[projectId\]/planning/new/
git commit -m "feat(gsc): inject topic-matched queries into Step 1 planning prompt"
```

---

## Task 14: Polish — error surfaces + reconnect banner

**Files:**
- Modify: the GSC connection card from Task 7 — render the "reconnect required" banner when `last_sync_error === 'refresh_token_revoked'`.
- Modify: the Performance tab from Task 12 — render a "stale data" banner when `last_synced_at` is > 48 hours ago.
- Modify: the Opportunities page from Task 11 — same stale-data banner.

**Step 1: Add a reusable banner component**

```tsx
// src/app/[locale]/(app)/projects/[projectId]/_gsc-status-banner.tsx
export function GscStatusBanner({ kind, lastSyncedAt, projectId }: {
  kind: 'revoked' | 'stale' | 'never-synced'
  lastSyncedAt: string | null
  projectId: string
}) {
  // … bg-wheat for stale, bg-rust/10 for revoked …
}
```

**Step 2: Wire it into the three surfaces**

Performance + Opportunities pages check the `gsc_connections` row server-side and render the banner at top when applicable.

**Step 3: Manual smoke**

- Revoke Google access in your Google account → next manual sync should surface the revoked state → banner appears.
- Skip a sync for > 48h (fudge `last_synced_at` via SQL) → banner appears on Performance + Opportunities.
- Just-connected with no sync yet → "Never synced. Click Sync now in Settings." banner.

**Step 4: Commit**

```bash
git add src/app/\[locale\]/\(app\)/projects/\[projectId\]/_gsc-status-banner.tsx
git commit -m "feat(gsc): status banners for revoked / stale / never-synced"
```

---

## Task 15: Enable cron in production + final checks

**Not code — configuration.**

1. Set all env vars (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URL`, `OAUTH_STATE_SECRET`, `CRON_SECRET`) in Vercel project settings.
2. Register the production redirect URL (`https://app.quillo.dev/api/gsc/oauth/callback`) in the Google Cloud OAuth client.
3. Push to main. Vercel picks up `vercel.json` and registers the cron.
4. After first deploy: visit `/api/cron/gsc-sync` with `Authorization: Bearer <CRON_SECRET>` via curl to manually trigger once; confirm data lands.
5. Wait 24h → confirm the scheduled run fires via Vercel's cron logs.

No commit — this is a deploy-only step.

---

## Execution order recap

1. **DB foundation** (Task 1): tables + types.
2. **Core libs** (Tasks 2–4): state, GSC HTTP client, token refresh.
3. **OAuth flow** (Tasks 5–6): start + callback + finalize.
4. **Settings UI** (Task 7): connect/disconnect/sync buttons. Validates OAuth end-to-end.
5. **Sync engine** (Task 8): the reusable function.
6. **Cron** (Task 9): schedule the sync. First real data flows.
7. **Opportunities** (Tasks 10–11): the highest-value feature, once data is real.
8. **Performance tab** (Task 12).
9. **Planning injection** (Task 13) — last, because it's the most prompt-engineering-heavy.
10. **Polish** (Task 14): banners for every known bad state.
11. **Ship** (Task 15): production wiring.

This sequence lets each task provide end-to-end value before the next one starts — you could stop after Task 11 and already ship real user value.
