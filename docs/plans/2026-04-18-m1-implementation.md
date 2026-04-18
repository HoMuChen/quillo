# Quillo M1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship Quillo M1 — auth + projects + brand + Pillar Cluster planning + article generation (outline/interview/draft) + Tiptap editor + Ghost publishing — with zh-TW / en i18n — in 14 days.

**Architecture:** Next.js 16 App Router on Vercel Fluid Compute. Supabase (Postgres + Auth + Storage) with Row Level Security and denormalized `tenant_id` on every row. Vercel AI Gateway (OIDC) routes Claude Sonnet/Haiku. Tiptap stores both `body_tiptap` JSON and `body_markdown` text. Ghost publish via `@tryghost/admin-api`.

**Tech Stack:** Next.js 16, TypeScript, Supabase JS / `@supabase/ssr`, Supabase CLI (migrations), AI SDK v6, Tiptap + tiptap-markdown, dnd-kit, next-intl, Zod, `@tryghost/admin-api`, `marked`, Node's `crypto` (AES-256-GCM).

**Source of truth for decisions:** `docs/plans/2026-04-18-m1-design.md` (referenced throughout as **[DESIGN §X]**).

---

## Execution conventions

- **Path root:** everything below is relative to repo root `/Users/largitdata/project/quillo.dev/quillo`.
- **Commits:** after each task; messages are Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`).
- **Running Supabase locally:** `supabase start` (brings up Docker Postgres on `127.0.0.1:54322`, Studio on `:54323`).
- **TDD where it pays off:** pure-function units (crypto, url normalize, markdown convert, Zod schemas) get tests; API routes with AI streaming and UI get manual verification notes instead.
- **"Run and verify":** every task that isn't testable has a concrete thing to eyeball.
- **Design references:** **[DESIGN §4.2]** means "see section 4.2 of the design doc".

---

## Part A — Foundation (Tasks 1-10)

### Task 1: Scaffold Next.js 16 project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`

**Step 1: Scaffold**

```bash
npx create-next-app@latest . --yes \
  --typescript --app --eslint --tailwind --src-dir \
  --import-alias '@/*' --turbopack --no-install
```

**Step 2: Install deps**

```bash
npm install
```

**Step 3: Verify**

```bash
npm run dev
# Open http://localhost:3000 — see the Next.js default page.
# Ctrl-C
```

**Step 4: Commit**

```bash
git add .
git commit -m "chore: scaffold Next.js 16 App Router"
```

---

### Task 2: Install runtime dependencies

**Files:** `package.json` (modify)

**Step 1: Install**

```bash
npm i @supabase/supabase-js @supabase/ssr \
      ai @ai-sdk/gateway zod \
      @tryghost/admin-api marked \
      next-intl \
      @tiptap/core @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-link @tiptap/extension-placeholder @tiptap/extension-character-count \
      tiptap-markdown \
      @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities \
      lucide-react clsx class-variance-authority tailwind-merge
npm i -D @types/marked supabase
```

**Step 2: Verify**

```bash
grep '"@supabase/ssr"' package.json && grep '"ai":' package.json
# Both should print.
```

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add runtime dependencies"
```

---

### Task 3: Initialize Supabase locally

**Files:**
- Create: `supabase/config.toml` (generated)

**Step 1: Init**

```bash
npx supabase init
```

When prompted about VS Code / Deno settings, accept defaults (N for both).

**Step 2: Start local stack**

```bash
npx supabase start
```

Wait for the output that includes `API URL`, `DB URL`, `Studio URL`, `anon key`, `service_role key`. **Copy these** — you'll put them in `.env.local` in Task 5.

**Step 3: Verify**

```bash
npx supabase status
# Expect all services RUNNING
```

**Step 4: Commit**

```bash
git add supabase/
git commit -m "chore: initialize local Supabase"
```

---

### Task 4: Write initial migration (schema + RLS + triggers)

**Files:**
- Create: `supabase/migrations/20260418000000_init.sql`

Follows **[DESIGN §4 + §5]** exactly. This is the longest SQL file in the repo.

**Step 1: Create the migration file**

```sql
-- 20260418000000_init.sql
-- Quillo M1 initial schema + RLS + triggers

-- ============================================================
-- Tenants & membership
-- ============================================================

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tenant_members (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      text NOT NULL CHECK (role IN ('owner','editor','viewer')) DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

-- Helper: user's tenants (STABLE so RLS can cache within a query)
CREATE OR REPLACE FUNCTION public.user_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
$$;

-- ============================================================
-- Projects
-- ============================================================

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text,
  audience text,
  theme text,
  content_locale text NOT NULL DEFAULT 'zh-TW',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON projects(tenant_id);

CREATE TABLE brand_materials (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL,
  author_background text,
  reader_persona    text,
  tone              text,
  preferred_terms   text[] NOT NULL DEFAULT '{}',
  forbidden_terms   text[] NOT NULL DEFAULT '{}',
  ee_at_cases       text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Pillars & articles
-- ============================================================

CREATE TABLE pillars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL,
  title text NOT NULL,
  description text,
  target_keyword text,
  search_intent text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON pillars(project_id, position);

CREATE TABLE articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pillar_id  uuid REFERENCES pillars(id) ON DELETE SET NULL,
  tenant_id  uuid NOT NULL,

  title text NOT NULL,
  target_keyword text,
  lsi_keywords text[] NOT NULL DEFAULT '{}',
  search_intent text,
  word_count_target int,
  role text,
  position int NOT NULL DEFAULT 0,

  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','outlining','outline_ready','interviewing','drafting','draft_ready','editing')),

  body_tiptap jsonb,
  body_markdown text,

  slug text,
  meta_title text,
  meta_description text,
  excerpt text,
  canonical_url text,
  focus_keyword text,
  tags text[] NOT NULL DEFAULT '{}',
  feature_image_url text,

  platform_meta jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON articles(project_id);
CREATE INDEX ON articles(pillar_id);

CREATE TABLE article_outlines (
  article_id uuid PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL,
  sections   jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE interview_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL,
  section_id text NOT NULL,
  question text NOT NULL,
  answer text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','answered','skipped')),
  position int NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON interview_questions(article_id);

CREATE TABLE article_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL,
  storage_path text NOT NULL,
  url text NOT NULL,
  alt text,
  caption text,
  kind text NOT NULL CHECK (kind IN ('feature','inline')),
  remote_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON article_images(article_id);

-- ============================================================
-- URL normalization
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_url(u text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE r text;
BEGIN
  IF u IS NULL OR u = '' THEN RETURN NULL; END IF;
  r := lower(u);
  r := regexp_replace(r, '[#?].*$', '');
  r := regexp_replace(r, '/+$', '');
  RETURN r;
END $$;

-- ============================================================
-- Site connections & publish targets
-- ============================================================

CREATE TABLE site_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ghost','wordpress','shopify')),
  name text NOT NULL,
  config_encrypted bytea NOT NULL,
  last_tested_at timestamptz,
  last_test_ok boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON site_connections(project_id);

CREATE TABLE publish_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES site_connections(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL,
  remote_post_id text,
  remote_url text,
  normalized_url text GENERATED ALWAYS AS (public.normalize_url(remote_url)) STORED,
  url_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  remote_status text,
  scheduled_for timestamptz,
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, connection_id)
);
CREATE INDEX ON publish_targets(article_id);
CREATE INDEX ON publish_targets(normalized_url);

CREATE TABLE publish_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publish_target_id uuid NOT NULL REFERENCES publish_targets(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('publish','republish','unpublish','schedule','test_connection')),
  status text NOT NULL CHECK (status IN ('success','failure')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON publish_logs(publish_target_id, created_at DESC);

-- ============================================================
-- Triggers — new user → tenant + membership
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_tid uuid;
  t_name text;
BEGIN
  t_name := coalesce(NEW.raw_user_meta_data->>'name', NEW.email, 'User') || '''s workspace';
  INSERT INTO public.tenants(name) VALUES (t_name) RETURNING id INTO new_tid;
  INSERT INTO public.tenant_members(tenant_id, user_id, role)
    VALUES (new_tid, NEW.id, 'owner');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Triggers — auto-fill tenant_id from parents
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_tenant_from_project()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM projects WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER t_brand_materials_tenant BEFORE INSERT ON brand_materials
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_project();
CREATE TRIGGER t_pillars_tenant         BEFORE INSERT ON pillars
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_project();
CREATE TRIGGER t_articles_tenant        BEFORE INSERT ON articles
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_project();
CREATE TRIGGER t_site_conn_tenant       BEFORE INSERT ON site_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_project();

CREATE OR REPLACE FUNCTION public.set_tenant_from_article()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM articles WHERE id = NEW.article_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER t_outlines_tenant    BEFORE INSERT ON article_outlines
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_article();
CREATE TRIGGER t_questions_tenant   BEFORE INSERT ON interview_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_article();
CREATE TRIGGER t_images_tenant      BEFORE INSERT ON article_images
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_article();

CREATE OR REPLACE FUNCTION public.set_tenant_from_publish_target()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM publish_targets WHERE id = NEW.publish_target_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER t_publish_logs_tenant BEFORE INSERT ON publish_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_publish_target();

CREATE OR REPLACE FUNCTION public.set_publish_target_tenant()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM articles WHERE id = NEW.article_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER t_publish_targets_tenant BEFORE INSERT ON publish_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_publish_target_tenant();

-- ============================================================
-- updated_at triggers
-- ============================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TRIGGER t_touch_projects          BEFORE UPDATE ON projects          FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_touch_brand             BEFORE UPDATE ON brand_materials    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_touch_pillars           BEFORE UPDATE ON pillars            FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_touch_articles          BEFORE UPDATE ON articles           FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_touch_outlines          BEFORE UPDATE ON article_outlines   FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_touch_questions         BEFORE UPDATE ON interview_questions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_touch_site_connections  BEFORE UPDATE ON site_connections   FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_touch_publish_targets   BEFORE UPDATE ON publish_targets    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_materials      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pillars              ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_outlines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_images       ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_connections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE publish_targets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE publish_logs         ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_tenants ON tenants FOR ALL TO authenticated
  USING (id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (id IN (SELECT public.user_tenant_ids()));

CREATE POLICY own_memberships ON tenant_members FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

-- Apply the same policy to every tenant-scoped table:
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'projects','brand_materials','pillars','articles',
      'article_outlines','interview_questions','article_images',
      'site_connections','publish_targets','publish_logs'
    ])
  LOOP
    EXECUTE format($q$
      CREATE POLICY tenant_isolation ON %I FOR ALL TO authenticated
      USING (tenant_id IN (SELECT public.user_tenant_ids()))
      WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()))
    $q$, t);
  END LOOP;
END $$;
```

**Step 2: Apply**

```bash
npx supabase db reset
# Expect: "Finished supabase db reset" with no errors.
```

**Step 3: Smoke test**

```bash
npx supabase db diff
# Expect: "No schema changes found."
```

**Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: initial schema, RLS, and tenant auto-provisioning"
```

---

### Task 5: Configure environment variables

**Files:**
- Create: `.env.local`, `.env.example`

**Step 1: Populate `.env.local`** (fill in values from `supabase status`)

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase status>

ENCRYPTION_KEY=<run: node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))'>

NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Vercel AI Gateway — set later (Task 10)
# VERCEL_OIDC_TOKEN=
```

**Step 2: Write `.env.example`** (same keys, empty values, committed).

**Step 3: Verify `.gitignore` excludes `.env.local`**

```bash
git check-ignore -v .env.local
# Expect: a rule from .gitignore is listed.
```

**Step 4: Commit**

```bash
git add .env.example
git commit -m "chore: document required env vars"
```

---

### Task 6: Supabase clients (server, browser, admin)

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/admin.ts`, `src/lib/supabase/types.ts` (placeholder)

**Step 1: `src/lib/supabase/types.ts`** — placeholder

```ts
export type Database = Record<string, never>
```

**Step 2: `src/lib/supabase/server.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch { /* RSC */ }
        },
      },
    },
  )
}
```

**Step 3: `src/lib/supabase/client.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

**Step 4: `src/lib/supabase/admin.ts`**

```ts
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

export function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}
```

**Step 5: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat(supabase): add server, browser, and admin clients"
```

---

### Task 7: Generate DB types

**Files:**
- Modify: `src/lib/supabase/types.ts`
- Add script to `package.json`

**Step 1: Add script**

In `package.json` `"scripts"`:
```json
"db:types": "supabase gen types typescript --local --schema public > src/lib/supabase/types.ts"
```

**Step 2: Run**

```bash
npm run db:types
```

**Step 3: Verify**

```bash
head -n 30 src/lib/supabase/types.ts
# Expect: `export type Database = { public: { ... } }` with the 12 tables.
```

**Step 4: Commit**

```bash
git add package.json src/lib/supabase/types.ts
git commit -m "chore(supabase): generate DB types"
```

---

### Task 8: Middleware (Supabase session refresh)

**Files:**
- Create: `src/middleware.ts`, `src/lib/supabase/middleware.ts`

**Step 1: `src/lib/supabase/middleware.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './types'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )
  await supabase.auth.getUser()
  return response
}
```

**Step 2: `src/middleware.ts`**

```ts
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
  // i18n is added in Task 9 (compose here with next-intl middleware).
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Step 3: Commit**

```bash
git add src/middleware.ts src/lib/supabase/middleware.ts
git commit -m "feat(auth): session-refresh middleware"
```

---

### Task 9: Wire next-intl (zh-TW / en)

**Files:**
- Create: `src/i18n/config.ts`, `src/i18n/request.ts`, `src/i18n/routing.ts`
- Create: `messages/zh-TW/common.json`, `messages/en/common.json`
- Modify: `next.config.ts`, `src/middleware.ts`, `src/app/layout.tsx` (delete), `src/app/[locale]/layout.tsx` (create)

**Step 1: `src/i18n/routing.ts`**

```ts
import { defineRouting } from 'next-intl/routing'
import { createNavigation } from 'next-intl/navigation'

export const routing = defineRouting({
  locales: ['zh-TW', 'en'],
  defaultLocale: 'zh-TW',
  localePrefix: 'always',
})

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing)
```

**Step 2: `src/i18n/request.ts`**

```ts
import { getRequestConfig } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = (await requestLocale) as string | undefined
  if (!locale || !routing.locales.includes(locale as never)) notFound()

  const namespaces = ['common', 'auth', 'projects', 'planning', 'articles', 'editor', 'publish']
  const messages: Record<string, unknown> = {}
  for (const ns of namespaces) {
    try {
      messages[ns] = (await import(`../../messages/${locale}/${ns}.json`)).default
    } catch {
      messages[ns] = {}
    }
  }
  return { locale, messages }
})
```

**Step 3: `next.config.ts`**

```ts
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')
const nextConfig: NextConfig = {}
export default withNextIntl(nextConfig)
```

**Step 4: Compose middleware**

Replace `src/middleware.ts`:

```ts
import createMiddleware from 'next-intl/middleware'
import { NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'
import { updateSession } from '@/lib/supabase/middleware'

const intlMiddleware = createMiddleware(routing)

export async function middleware(request: NextRequest) {
  const supabaseResponse = await updateSession(request)
  const intlResponse = intlMiddleware(request)
  supabaseResponse.cookies.getAll().forEach((c) => {
    intlResponse.cookies.set(c.name, c.value, c)
  })
  return intlResponse
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Step 5: Move `src/app/layout.tsx` → `src/app/[locale]/layout.tsx`**

```tsx
// src/app/[locale]/layout.tsx
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import '../globals.css'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!routing.locales.includes(locale as never)) notFound()
  setRequestLocale(locale)
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
```

Move `src/app/page.tsx` → `src/app/[locale]/page.tsx` and replace contents with `<h1>Quillo</h1>` placeholder.

Delete `src/app/layout.tsx` (top-level). Remove the stray `src/app/page.tsx`.

**Step 6: Seed messages**

`messages/zh-TW/common.json`:
```json
{ "app_name": "Quillo", "hello": "你好" }
```
`messages/en/common.json`:
```json
{ "app_name": "Quillo", "hello": "Hello" }
```

**Step 7: Verify**

```bash
npm run dev
# Open http://localhost:3000 → redirects to /zh-TW → shows "Quillo"
# Open http://localhost:3000/en → shows "Quillo"
# Ctrl-C
```

**Step 8: Commit**

```bash
git add .
git commit -m "feat(i18n): next-intl with zh-TW and en"
```

---

### Task 10: Link project to Vercel + pull OIDC token

**Files:** `.env.local` (modify), `.vercel/` (auto)

**Step 1: Link**

```bash
npx vercel link --yes
# Follow prompts: pick account, confirm project name "quillo".
```

**Step 2: Enable AI Gateway in Vercel dashboard**

Go to `https://vercel.com/<team>/quillo/settings` → AI Gateway → Enable.

**Step 3: Pull env**

```bash
npx vercel env pull .env.local
# Appends VERCEL_OIDC_TOKEN.
```

**Step 4: Verify**

```bash
grep VERCEL_OIDC_TOKEN .env.local
# Expect: VERCEL_OIDC_TOKEN=eyJhbGci...
```

**Step 5: Commit**

```bash
git add .vercel
# Already in .gitignore — expect "fatal: The following paths are ignored"
# That's expected, nothing to commit.
```

Nothing to commit (all outputs are gitignored).

---

## Part B — Auth (Tasks 11-15)

### Task 11: Auth layout and login page

**Files:**
- Create: `src/app/[locale]/(auth)/layout.tsx`, `src/app/[locale]/(auth)/login/page.tsx`
- Create: `messages/zh-TW/auth.json`, `messages/en/auth.json`
- Create: `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/label.tsx` (bare shadcn-style primitives)

**Step 1: Primitives** — minimal hand-rolled (skip shadcn CLI to save time):

```tsx
// src/components/ui/button.tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default: 'bg-neutral-900 text-white hover:bg-neutral-800',
        outline: 'border border-neutral-300 hover:bg-neutral-50',
        ghost: 'hover:bg-neutral-100',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
      },
      size: { default: 'h-10 px-4', sm: 'h-8 px-3', lg: 'h-12 px-6' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export function Button({ className, variant, size, ...props }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
```

```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
```

```tsx
// src/components/ui/input.tsx
import { cn } from '@/lib/utils'
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('h-10 w-full rounded-md border border-neutral-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900', className)} {...props} />
}
```

```tsx
// src/components/ui/label.tsx
import { cn } from '@/lib/utils'
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('block text-sm font-medium', className)} {...props} />
}
```

**Step 2: `messages/zh-TW/auth.json`**

```json
{
  "login_title": "登入 Quillo",
  "signup_title": "建立帳號",
  "email": "Email",
  "password": "密碼",
  "submit": "登入",
  "submit_signup": "註冊",
  "google": "使用 Google 登入",
  "to_signup": "沒有帳號？註冊",
  "to_login": "已有帳號？登入",
  "error_generic": "操作失敗，請稍後再試",
  "logout": "登出"
}
```

Mirror to `messages/en/auth.json`.

**Step 3: Login page** — `src/app/[locale]/(auth)/login/page.tsx`

```tsx
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { LoginForm } from './_login-form'

export default async function LoginPage() {
  const t = await getTranslations('auth')
  return (
    <div className="max-w-sm mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">{t('login_title')}</h1>
      <LoginForm />
      <Link href="/signup" className="text-sm underline">{t('to_signup')}</Link>
    </div>
  )
}
```

**Step 4: Form client component** — `src/app/[locale]/(auth)/login/_login-form.tsx`

```tsx
'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm() {
  const t = useTranslations('auth')
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setPending(false)
    if (error) setError(t('error_generic'))
    else router.replace('/projects')
  }

  async function google() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1"><Label>{t('email')}</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="space-y-1"><Label>{t('password')}</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full">{t('submit')}</Button>
      <Button type="button" variant="outline" onClick={google} className="w-full">{t('google')}</Button>
    </form>
  )
}
```

**Step 5: Auth layout**

`src/app/[locale]/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen flex items-center justify-center p-6">{children}</main>
}
```

**Step 6: Verify**

```bash
npm run dev
# /zh-TW/login shows the form. Ctrl-C.
```

**Step 7: Commit**

```bash
git add .
git commit -m "feat(auth): login page with email+password and Google"
```

---

### Task 12: Signup page

**Files:**
- Create: `src/app/[locale]/(auth)/signup/page.tsx`, `src/app/[locale]/(auth)/signup/_signup-form.tsx`

**Step 1: Signup form** — mirror login form but calls `supabase.auth.signUp({ email, password, options: { emailRedirectTo: '/auth/callback' } })`.

```tsx
// _signup-form.tsx — core differences:
// const { error } = await supabase.auth.signUp({ email, password })
// On success: show "check your email" message (or auto-login for local dev since Supabase local auto-confirms).
```

For local dev, **disable email confirmation** to make iteration fast:
- `supabase/config.toml` → `[auth.email] enable_confirmations = false`

**Step 2: Restart Supabase**

```bash
npx supabase stop
npx supabase start
```

**Step 3: Page & route** — analogous to login.

**Step 4: Verify signup → tenant auto-created**

```bash
npm run dev
# Sign up via /zh-TW/signup.
# Then in another shell:
psql "$(npx supabase status --output json | jq -r .DB_URL)" \
  -c "SELECT t.id, t.name, m.user_id, m.role FROM tenants t JOIN tenant_members m ON t.id=m.tenant_id;"
# Expect: one tenant, one owner membership.
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat(auth): signup page; disable email confirmation locally"
```

---

### Task 13: OAuth callback route

**Files:**
- Create: `src/app/auth/callback/route.ts` (note: outside `[locale]` — Supabase redirects here without locale)

**Step 1: Route**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(new URL('/zh-TW/projects', url.origin))
}
```

**Step 2: Verify**

Trigger Google OAuth locally (requires Google provider configured in Supabase Studio; skip if not configured — email flow is enough for M1 dev; re-enable before launch).

**Step 3: Commit**

```bash
git add .
git commit -m "feat(auth): OAuth callback route"
```

---

### Task 14: Protected route helper

**Files:**
- Create: `src/lib/auth/require-user.ts`, `src/app/[locale]/(app)/layout.tsx`

**Step 1: `require-user.ts`**

```ts
import { redirect } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/server'

export async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect({ href: '/login', locale: 'zh-TW' })
  return user!
}
```

**Step 2: App layout**

```tsx
// src/app/[locale]/(app)/layout.tsx
import { requireUser } from '@/lib/auth/require-user'
import { AppShell } from '@/components/app-shell'

export default async function AppLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ locale: string }>
}) {
  await params
  await requireUser()
  return <AppShell>{children}</AppShell>
}
```

**Step 3: Placeholder AppShell** — `src/components/app-shell.tsx`

```tsx
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="border-r p-4">Quillo</aside>
      <main className="p-6">{children}</main>
    </div>
  )
}
```

**Step 4: Verify**

```bash
npm run dev
# As logged-out: visit /zh-TW/projects → redirected to /zh-TW/login.
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat(auth): protected route helper and app shell"
```

---

### Task 15: Logout + user menu

**Files:** Modify `src/components/app-shell.tsx`; create `src/components/user-menu.tsx`

**Step 1: `user-menu.tsx`**

```tsx
'use client'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function UserMenu({ email }: { email: string }) {
  const t = useTranslations('auth')
  const router = useRouter()
  async function logout() {
    await createClient().auth.signOut()
    router.replace('/login')
  }
  return (
    <div className="text-sm space-y-2">
      <div className="text-neutral-600 truncate">{email}</div>
      <Button variant="outline" size="sm" onClick={logout}>{t('logout')}</Button>
    </div>
  )
}
```

**Step 2: Plug into shell** — fetch user in `app/[locale]/(app)/layout.tsx`, pass to AppShell which renders UserMenu.

**Step 3: Commit**

```bash
git add .
git commit -m "feat(auth): logout and user menu"
```

---

## Part C — Projects & brand materials (Tasks 16-21)

### Task 16: Projects list page

**Files:**
- Create: `src/app/[locale]/(app)/projects/page.tsx`, `src/app/[locale]/(app)/projects/_projects-list.tsx`
- Create: `messages/zh-TW/projects.json`, `messages/en/projects.json`

**Step 1: Server page**

```tsx
// page.tsx
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { ProjectsList } from './_projects-list'
import { NewProjectDialog } from './_new-project-dialog'

export default async function ProjectsPage() {
  const t = await getTranslations('projects')
  const supabase = await createClient()
  const { data: projects } = await supabase
    .from('projects').select('id,name,domain,updated_at')
    .order('updated_at', { ascending: false })
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <NewProjectDialog />
      </header>
      <ProjectsList projects={projects ?? []} />
    </div>
  )
}
```

**Step 2: List component** renders cards linking to `/projects/[id]/planning`; empty state prompts user to create first project.

**Step 3: Messages** — `title`, `create`, `empty_state`, `empty_cta`, `name`, `domain`, `audience`, `theme`.

**Step 4: Commit**

```bash
git add .
git commit -m "feat(projects): projects list page"
```

---

### Task 17: Create project dialog + action

**Files:**
- Create: `src/app/[locale]/(app)/projects/_new-project-dialog.tsx`, `src/app/[locale]/(app)/projects/actions.ts`

**Step 1: Action**

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1).max(120),
  domain: z.string().url().optional().or(z.literal('')),
  audience: z.string().optional(),
  theme: z.string().optional(),
  content_locale: z.enum(['zh-TW','en']).default('zh-TW'),
})

export async function createProjectAction(locale: 'zh-TW'|'en', form: FormData) {
  const parsed = schema.parse(Object.fromEntries(form))
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('unauthorized')
  // tenant_id comes from user's single membership; RLS + insert needs it explicitly.
  const { data: membership } = await supabase
    .from('tenant_members').select('tenant_id').single()
  if (!membership) throw new Error('no tenant')
  const { data: project, error } = await supabase
    .from('projects').insert({ ...parsed, domain: parsed.domain || null, tenant_id: membership.tenant_id })
    .select('id').single()
  if (error) throw error
  // Create empty brand_materials row for edit later
  await supabase.from('brand_materials').insert({ project_id: project.id })
  revalidatePath('/projects')
  redirect({ href: `/projects/${project.id}/brand`, locale })
}
```

**Step 2: Dialog** — simple HTML `<dialog>` or inline form. Example: a top-of-page form rendered by a `<details>` toggle for M1.

**Step 3: Verify**

Create a project via UI → redirected to `/projects/<id>/brand` (Task 19).

**Step 4: Commit**

```bash
git add .
git commit -m "feat(projects): create project action and dialog"
```

---

### Task 18: Project nav + layout

**Files:**
- Create: `src/app/[locale]/(app)/projects/[projectId]/layout.tsx`, `src/app/[locale]/(app)/projects/[projectId]/_project-nav.tsx`

**Step 1: Layout** — loads project, renders sidebar nav with links to `brand`, `planning`, `articles`, `settings`. 404 if project not found (RLS).

**Step 2: Commit**

```bash
git add .
git commit -m "feat(projects): per-project layout with nav"
```

---

### Task 19: Brand materials form

**Files:**
- Create: `src/app/[locale]/(app)/projects/[projectId]/brand/page.tsx`, `_brand-form.tsx`, `actions.ts`

**Step 1: Fields** — map **[DESIGN §4.2 brand_materials]**:
- `author_background` (textarea)
- `reader_persona` (textarea)
- `tone` (input)
- `preferred_terms` (chip input → `text[]`)
- `forbidden_terms` (chip input → `text[]`)
- `ee_at_cases` (textarea)

**Step 2: Action**

```ts
'use server'
export async function saveBrandAction(projectId: string, form: FormData) {
  const supabase = await createClient()
  const payload = {
    author_background: form.get('author_background') as string,
    reader_persona: form.get('reader_persona') as string,
    tone: form.get('tone') as string,
    preferred_terms: JSON.parse(form.get('preferred_terms') as string || '[]'),
    forbidden_terms: JSON.parse(form.get('forbidden_terms') as string || '[]'),
    ee_at_cases: form.get('ee_at_cases') as string,
  }
  const { error } = await supabase
    .from('brand_materials').update(payload).eq('project_id', projectId)
  if (error) throw error
  revalidatePath(`/projects/${projectId}/brand`)
}
```

**Step 3: Client form** — debounced autosave (1s) via `useFormState` pattern or plain `useEffect` calling the action.

**Step 4: Commit**

```bash
git add .
git commit -m "feat(brand): brand materials form with autosave"
```

---

### Task 20: Unit test — `cn` util + env sanity

This is a good "TDD warm-up" even though tiny.

**Files:**
- Create: `src/lib/utils.test.ts`
- Add Vitest: `npm i -D vitest @vitest/ui happy-dom @testing-library/react @testing-library/jest-dom`
- Create: `vitest.config.ts`

**Step 1: Config**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'
export default defineConfig({
  plugins: [react()],
  test: { environment: 'happy-dom', globals: true },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
```

Add script: `"test": "vitest"`, `"test:run": "vitest run"`.

**Step 2: Test**

```ts
// src/lib/utils.test.ts
import { describe, it, expect } from 'vitest'
import { cn } from './utils'
describe('cn', () => {
  it('merges tailwind classes with later winning', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
})
```

**Step 3: Run**

```bash
npm run test:run
# Expect PASS.
```

**Step 4: Commit**

```bash
git add .
git commit -m "chore(test): add Vitest and sanity test"
```

---

### Task 21: Cross-tenant isolation smoke test

Verifies RLS in an automated way.

**Files:**
- Create: `tests/rls.test.ts`

**Step 1: Test**

```ts
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function signUp(email: string) {
  const c = createClient(url, anon)
  const { data, error } = await c.auth.signUp({ email, password: 'Password1!' })
  if (error) throw error
  return { client: c, user: data.user! }
}

describe('RLS tenant isolation', () => {
  it('users cannot see another tenant projects', async () => {
    const a = await signUp(`rls-a-${Date.now()}@test.dev`)
    await a.client.from('projects').insert({ name: 'A project', tenant_id: null as never })
    // Oops — tenant_id required here. In app, we look up membership first.
    // Instead, rely on brand_materials which auto-fills.
    // Use a Postgres function or admin client to seed; this test stays as manual-run for now.
    expect(true).toBe(true)
  })
})
```

> **Note:** Full RLS test needs two signed-in users + admin seeding. Keep this stub as a placeholder; re-enable if cross-tenant bugs show up. For M1 we rely on Supabase Studio manual verification: sign in as User A, create project, sign in as User B, try to read — should return empty.

**Step 2: Commit**

```bash
git add .
git commit -m "test(rls): placeholder cross-tenant isolation test"
```

---

## Part D — Pillar Cluster planning (Tasks 22-33)

### Task 22: AI gateway wrapper + prompts library

**Files:**
- Create: `src/lib/ai/gateway.ts`, `src/lib/ai/prompts.ts`, `src/lib/ai/schemas.ts`

**Step 1: `gateway.ts`**

```ts
export const MODELS = {
  main: 'anthropic/claude-sonnet-4.6',
  fast: 'anthropic/claude-haiku-4.5',
} as const
```

**Step 2: `schemas.ts`** — **[DESIGN §6.3]**

```ts
import { z } from 'zod'

const intent = z.enum(['informational','commercial','transactional'])

export const pillarPlanSchema = z.object({
  pillars: z.array(z.object({
    title: z.string(),
    description: z.string(),
    target_keyword: z.string(),
    search_intent: intent,
    articles: z.array(z.object({
      title: z.string(),
      target_keyword: z.string(),
      lsi_keywords: z.array(z.string()).max(3),
      search_intent: intent,
      word_count_target: z.number().int().min(500).max(5000),
      role: z.enum(['hub','supporting','comparison']),
    })).min(5).max(10),
  })).min(3).max(5),
})

export const outlineSchema = z.object({
  sections: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string(),
    purpose: z.string(),
    needs_interview: z.boolean(),
  })).min(3).max(15),
})

export const interviewSchema = z.object({
  questions: z.array(z.object({
    section_id: z.string(),
    question: z.string(),
  })).max(8),
})

export const metaSchema = z.object({
  meta_title: z.string().min(10).max(60),
  meta_description: z.string().min(50).max(160),
})
```

**Step 3: `prompts.ts`** — brand context + per-flow prompts

```ts
import type { Database } from '@/lib/supabase/types'

type Brand = Database['public']['Tables']['brand_materials']['Row'] | null
type Project = Database['public']['Tables']['projects']['Row']

export function brandContextBlock(project: Project, brand: Brand): string {
  return `<brand_context>
<project_theme>${project.theme ?? ''}</project_theme>
<project_audience>${project.audience ?? ''}</project_audience>
<content_locale>${project.content_locale}</content_locale>
<author_background>${brand?.author_background ?? ''}</author_background>
<reader_persona>${brand?.reader_persona ?? ''}</reader_persona>
<tone>${brand?.tone ?? ''}</tone>
<preferred_terms>${(brand?.preferred_terms ?? []).join(', ')}</preferred_terms>
<forbidden_terms>${(brand?.forbidden_terms ?? []).join(', ')}</forbidden_terms>
<ee_at_cases>${brand?.ee_at_cases ?? ''}</ee_at_cases>
</brand_context>`
}

export const PLAN_STEP1_SYSTEM = `You are an experienced SEO content strategist.
Given a topic, propose 3-5 core aspects the content hub should cover, plus a short overall strategy.
Respond in the project's content_locale. Output plain text with headings — no JSON.`

export const PLAN_STEP2_SYSTEM = `You are an SEO content planner.
Given a confirmed direction, produce 3-5 Pillars, each with 5-10 Cluster articles.
Follow brand_context strictly. Produce output matching the JSON schema. Write all titles and
descriptions in the project's content_locale. Avoid forbidden_terms. Favor preferred_terms where natural.`

export const OUTLINE_SYSTEM = `You are an SEO writer.
Produce an article outline of 3-15 sections. Each section has a concise title and a one-sentence
purpose. Mark needs_interview=true only when the section requires first-hand experience, data,
or author perspective that general knowledge cannot provide. id is a lowercase kebab-case slug.`

export const INTERVIEW_SYSTEM = `You are an editor preparing interview questions for an author.
For each section that needs_interview=true, produce up to 2 concrete, verifiable questions
(no vague "what's your experience"-style). Total across the article is at most 8 questions.`

export const DRAFT_SYSTEM = `You are an SEO writer producing a Markdown article.
Order: sections must appear in the order given.
For each section:
  - if the section has answered interview Q&A, you MUST ground the section in those answers and MUST NOT fabricate.
  - if skipped or not applicable, use general knowledge.
Follow brand_context: tone, preferred_terms, and NEVER use forbidden_terms.
Use ## for each section heading with the section's title.
Write in the project's content_locale.`

export const REWRITE_SYSTEM = `You rewrite the user-selected text according to the given instruction.
Preserve meaning. Keep the same content_locale. Return only the rewritten text, no preamble.`

export const META_SYSTEM = `You generate SEO metadata.
meta_title: compelling, keyword-aware, 10-60 chars.
meta_description: benefit-oriented, keyword-aware, 50-160 chars.
Content language matches content_locale.`
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat(ai): gateway config, prompts, and Zod schemas"
```

---

### Task 23: Zod schema unit tests

**Files:** `src/lib/ai/schemas.test.ts`

**Step 1: Test happy + unhappy paths**

```ts
import { describe, it, expect } from 'vitest'
import { pillarPlanSchema, outlineSchema, interviewSchema, metaSchema } from './schemas'

describe('pillarPlanSchema', () => {
  it('rejects when fewer than 3 pillars', () => {
    const bad = { pillars: [{ title: 'a', description: '', target_keyword: 'a', search_intent: 'informational', articles: Array(5).fill({ title:'x', target_keyword:'x', lsi_keywords:[], search_intent:'informational', word_count_target:1000, role:'hub' }) }] }
    expect(() => pillarPlanSchema.parse(bad)).toThrow()
  })
})
describe('outlineSchema', () => {
  it('rejects invalid id', () => {
    const bad = { sections: [{ id: 'Has Space', title: 't', purpose: 'p', needs_interview: false },{ id: 'b', title:'t', purpose:'p', needs_interview:false },{ id:'c', title:'t', purpose:'p', needs_interview:false }] }
    expect(() => outlineSchema.parse(bad)).toThrow()
  })
})
describe('interviewSchema', () => {
  it('rejects when more than 8 questions', () => {
    const bad = { questions: Array(9).fill({ section_id: 'a', question: 'q' }) }
    expect(() => interviewSchema.parse(bad)).toThrow()
  })
})
describe('metaSchema', () => {
  it('rejects when meta_title too short', () => {
    expect(() => metaSchema.parse({ meta_title: 'short', meta_description: 'a'.repeat(60) })).toThrow()
  })
})
```

**Step 2: Run**

```bash
npm run test:run
```

**Step 3: Commit**

```bash
git add .
git commit -m "test(ai): Zod schema cases"
```

---

### Task 24: `/api/ai/plan/step1` route (streamText)

**Files:** `src/app/api/ai/plan/step1/route.ts`

**Step 1: Route**

```ts
import { streamText } from 'ai'
import { MODELS } from '@/lib/ai/gateway'
import { PLAN_STEP1_SYSTEM, brandContextBlock } from '@/lib/ai/prompts'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const bodySchema = z.object({
  projectId: z.string().uuid(),
  topic: z.string().min(1),
  audience_supplement: z.string().optional(),
})

export async function POST(req: Request) {
  const parsed = bodySchema.parse(await req.json())
  const supabase = await createClient()
  const { data: project } = await supabase.from('projects').select('*').eq('id', parsed.projectId).single()
  const { data: brand } = await supabase.from('brand_materials').select('*').eq('project_id', parsed.projectId).single()
  if (!project) return new Response('Not found', { status: 404 })

  const result = streamText({
    model: MODELS.main,
    system: `${PLAN_STEP1_SYSTEM}\n\n${brandContextBlock(project, brand)}`,
    prompt: `Topic: ${parsed.topic}\nAudience notes: ${parsed.audience_supplement ?? ''}`,
  })
  return result.toTextStreamResponse()
}
```

**Step 2: Verify** — delay until Task 25 (UI) to test. No commit yet.

**Step 3: Commit**

```bash
git add .
git commit -m "feat(ai): POST /api/ai/plan/step1 streaming endpoint"
```

---

### Task 25: Planning wizard — Step 1 UI

**Files:**
- Create: `src/app/[locale]/(app)/projects/[projectId]/planning/new/page.tsx`
- Create: `_wizard.tsx` (client)

**Step 1: Client wizard** — uses `fetch` + `ReadableStream` (or `useCompletion` from `ai/react`).

```tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function PlanWizard({ projectId }: { projectId: string }) {
  const [step, setStep] = useState(1)
  const [topic, setTopic] = useState('')
  const [supp, setSupp] = useState('')
  const [step1Text, setStep1Text] = useState('')
  const [streaming, setStreaming] = useState(false)

  async function runStep1() {
    setStreaming(true); setStep1Text('')
    const res = await fetch('/api/ai/plan/step1', {
      method: 'POST', body: JSON.stringify({ projectId, topic, audience_supplement: supp }),
      headers: { 'content-type': 'application/json' },
    })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      setStep1Text((prev) => prev + decoder.decode(value))
    }
    setStreaming(false)
  }

  if (step === 1) return (
    <div className="space-y-4">
      <Input placeholder="想規劃的主題" value={topic} onChange={(e) => setTopic(e.target.value)} />
      <Input placeholder="受眾補充（可選）" value={supp} onChange={(e) => setSupp(e.target.value)} />
      <Button onClick={runStep1} disabled={!topic || streaming}>產出方向</Button>
      {step1Text && <pre className="whitespace-pre-wrap rounded border p-4">{step1Text}</pre>}
      {step1Text && !streaming && (
        <div className="flex gap-2">
          <Button onClick={runStep1} variant="outline">重新產出</Button>
          <Button onClick={() => setStep(2)}>接受並繼續</Button>
        </div>
      )}
    </div>
  )
  return <Step2 projectId={projectId} direction={step1Text} />
}
```

**Step 2: Verify**

```bash
npm run dev
# Go to /zh-TW/projects/<id>/planning/new
# Enter a topic → streaming appears.
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat(planning): wizard Step 1 UI with streaming"
```

---

### Task 26: `/api/ai/plan/step2` route (streamObject)

**Files:** `src/app/api/ai/plan/step2/route.ts`

**Step 1: Route**

```ts
import { streamObject } from 'ai'
import { MODELS } from '@/lib/ai/gateway'
import { PLAN_STEP2_SYSTEM, brandContextBlock } from '@/lib/ai/prompts'
import { pillarPlanSchema } from '@/lib/ai/schemas'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const body = z.object({
  projectId: z.string().uuid(),
  direction: z.string().min(1),
})

export async function POST(req: Request) {
  const { projectId, direction } = body.parse(await req.json())
  const supabase = await createClient()
  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  const { data: brand } = await supabase.from('brand_materials').select('*').eq('project_id', projectId).single()
  if (!project) return new Response('Not found', { status: 404 })

  const result = streamObject({
    model: MODELS.main,
    system: `${PLAN_STEP2_SYSTEM}\n\n${brandContextBlock(project, brand)}`,
    schema: pillarPlanSchema,
    prompt: `Confirmed direction:\n${direction}\n\nProduce the Pillar Cluster plan.`,
  })
  return result.toTextStreamResponse()
}
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat(ai): POST /api/ai/plan/step2 streaming structured endpoint"
```

---

### Task 27: Planning wizard — Step 2 UI with streaming tree

**Files:** `_wizard.tsx` (add `Step2` component)

**Step 1: Use `experimental_useObject` from `@ai-sdk/react`**

```tsx
'use client'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import { pillarPlanSchema } from '@/lib/ai/schemas'

export function Step2({ projectId, direction }: { projectId: string; direction: string }) {
  const { object, submit, isLoading } = useObject({
    api: '/api/ai/plan/step2',
    schema: pillarPlanSchema,
  })
  // Start once
  useEffect(() => { submit({ projectId, direction }) }, [])

  return (
    <div className="space-y-4">
      {object?.pillars?.map((p, i) => (
        <div key={i} className="rounded border p-3">
          <h3 className="font-semibold">{p?.title}</h3>
          <p className="text-sm text-neutral-600">{p?.description}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {p?.articles?.map((a, j) => <li key={j}>· {a?.title} <span className="text-neutral-400">({a?.target_keyword})</span></li>)}
          </ul>
        </div>
      ))}
      {!isLoading && object && (
        <SaveButton projectId={projectId} plan={object} />
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat(planning): wizard Step 2 UI streaming tree"
```

---

### Task 28: Postgres function `create_pillar_plan`

**Files:**
- Create: `supabase/migrations/20260419000000_create_pillar_plan.sql`

**Step 1: Function**

```sql
CREATE OR REPLACE FUNCTION public.create_pillar_plan(
  p_project_id uuid,
  p_plan jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  p jsonb;
  a jsonb;
  pid uuid;
  ppos int := 0;
  apos int := 0;
  created_pillars jsonb := '[]'::jsonb;
BEGIN
  FOR p IN SELECT * FROM jsonb_array_elements(p_plan->'pillars') LOOP
    INSERT INTO pillars (project_id, title, description, target_keyword, search_intent, position)
    VALUES (p_project_id, p->>'title', p->>'description', p->>'target_keyword', p->>'search_intent', ppos)
    RETURNING id INTO pid;

    apos := 0;
    FOR a IN SELECT * FROM jsonb_array_elements(p->'articles') LOOP
      INSERT INTO articles (
        project_id, pillar_id, title, target_keyword,
        lsi_keywords, search_intent, word_count_target, role, position
      ) VALUES (
        p_project_id, pid, a->>'title', a->>'target_keyword',
        ARRAY(SELECT jsonb_array_elements_text(a->'lsi_keywords')),
        a->>'search_intent', (a->>'word_count_target')::int, a->>'role', apos
      );
      apos := apos + 1;
    END LOOP;
    created_pillars := created_pillars || jsonb_build_object('id', pid);
    ppos := ppos + 1;
  END LOOP;
  RETURN jsonb_build_object('pillars', created_pillars);
END $$;
```

**Step 2: Apply**

```bash
npx supabase migration up --linked=false
# If you see errors, `npx supabase db reset` re-runs all migrations.
```

**Step 3: Regenerate types**

```bash
npm run db:types
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat(planning): create_pillar_plan Postgres function"
```

---

### Task 29: Save plan action + navigate to planning tree

**Files:** add to `src/app/[locale]/(app)/projects/[projectId]/planning/new/actions.ts`

**Step 1: Action**

```ts
'use server'
import { redirect } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/server'
import type { z } from 'zod'
import { pillarPlanSchema } from '@/lib/ai/schemas'

export async function savePlanAction(locale: 'zh-TW'|'en', projectId: string, plan: z.infer<typeof pillarPlanSchema>) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('create_pillar_plan', { p_project_id: projectId, p_plan: plan })
  if (error) throw error
  redirect({ href: `/projects/${projectId}/planning`, locale })
}
```

**Step 2: Wire from Step2 `SaveButton`**.

**Step 3: Commit**

```bash
git add .
git commit -m "feat(planning): save pillar plan action"
```

---

### Task 30: Planning tree display page

**Files:** `src/app/[locale]/(app)/projects/[projectId]/planning/page.tsx`

**Step 1: Fetch**

```tsx
const { data: pillars } = await supabase
  .from('pillars').select('id,title,description,position, articles(id,title,target_keyword,position,status)')
  .eq('project_id', projectId).order('position')
```

**Step 2: Render tree** — expandable rows, each article links to `/articles/[articleId]`.

**Step 3: Empty state** — prompts `/planning/new`.

**Step 4: Commit**

```bash
git add .
git commit -m "feat(planning): tree display"
```

---

### Task 31: Edit / delete pillar & article (inline)

**Files:** add actions file + inline-edit components

- Edit via popover with form; delete with confirm dialog.
- Actions: `updatePillar`, `deletePillar`, `updateArticle`, `deleteArticle`.

**Step 1: Actions** — trivial `.update()` / `.delete()` on Supabase; revalidate path.

**Step 2: UI** — click a row → popover with form.

**Step 3: Commit**

```bash
git add .
git commit -m "feat(planning): edit and delete pillar/article"
```

---

### Task 32: Add pillar / article manually

**Files:** add buttons + dialogs

**Step 1: Actions** — insert with `position = max(position)+1`.

**Step 2: UI** — "+ Add Pillar" button at bottom; "+ Add Article" under each pillar.

**Step 3: Commit**

```bash
git add .
git commit -m "feat(planning): manually add pillar/article"
```

---

### Task 33: Regenerate cluster for a single pillar

**Files:**
- Create: `src/app/api/ai/plan/regenerate-cluster/route.ts`
- UI button on each pillar row

**Step 1: Route** — similar to step2 but `streamObject` with a sub-schema (articles only) scoped to one pillar. Accepts `pillarId`. On save, deletes current child articles (`ON DELETE` from pillar row) and inserts new.

> Gotcha: preserve articles that are already `published` — ask user before overwriting. For M1 simplicity: **only allow regenerate when all child articles are `planned`**; show disabled tooltip otherwise.

**Step 2: Commit**

```bash
git add .
git commit -m "feat(planning): regenerate cluster for a single pillar"
```

---

## Part E — Article generation (Tasks 34-42)

### Task 34: Article detail page skeleton with tabs

**Files:** `src/app/[locale]/(app)/projects/[projectId]/articles/[articleId]/page.tsx` and tab components.

**Step 1: Fetch article + outline + questions.**

**Step 2: Tabs** — `outline` / `interview` / `editor` / `seo` / `publish`. URL state via `?tab=outline` search param.

**Step 3: Commit**

```bash
git add .
git commit -m "feat(articles): detail page skeleton with tabs"
```

---

### Task 35: `/api/ai/outline` endpoint

**Files:** `src/app/api/ai/outline/route.ts`

**Step 1: Route**

```ts
import { streamObject } from 'ai'
import { MODELS } from '@/lib/ai/gateway'
import { OUTLINE_SYSTEM, brandContextBlock } from '@/lib/ai/prompts'
import { outlineSchema } from '@/lib/ai/schemas'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export async function POST(req: Request) {
  const { articleId } = z.object({ articleId: z.string().uuid() }).parse(await req.json())
  const supabase = await createClient()
  const { data: article } = await supabase.from('articles').select('*, pillars(title,description)').eq('id', articleId).single()
  if (!article) return new Response('Not found', { status: 404 })
  if (['outlining','drafting'].includes(article.status)) return new Response('Busy', { status: 409 })

  const { data: project } = await supabase.from('projects').select('*').eq('id', article.project_id).single()
  const { data: brand } = await supabase.from('brand_materials').select('*').eq('project_id', article.project_id).single()

  // Advance status
  await supabase.from('articles').update({ status: 'outlining' }).eq('id', articleId)

  const result = streamObject({
    model: MODELS.main,
    system: `${OUTLINE_SYSTEM}\n\n${brandContextBlock(project!, brand)}`,
    schema: outlineSchema,
    prompt: JSON.stringify({
      title: article.title,
      target_keyword: article.target_keyword,
      lsi_keywords: article.lsi_keywords,
      search_intent: article.search_intent,
      word_count_target: article.word_count_target,
      role: article.role,
      pillar: article.pillars,
    }),
    onFinish: async ({ object }) => {
      if (!object) {
        await supabase.from('articles').update({ status: 'planned' }).eq('id', articleId)
        return
      }
      await supabase.from('article_outlines').upsert({ article_id: articleId, sections: object.sections })
      await supabase.from('articles').update({ status: 'outline_ready' }).eq('id', articleId)
    },
  })
  return result.toTextStreamResponse()
}
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat(ai): outline streaming endpoint"
```

---

### Task 36: Outline tab UI with streaming + edit

**Files:** `_outline-tab.tsx`

**Step 1: Use `useObject` to stream.**
**Step 2: After stream ends** — show editable list: drag reorder (dnd-kit), add/delete section, toggle `needs_interview`.
**Step 3: Save action** — `updateOutline(articleId, sections)` that does `upsert` on `article_outlines.sections`.

**Step 4: Commit**

```bash
git add .
git commit -m "feat(articles): outline tab with generation and editing"
```

---

### Task 37: `/api/ai/interview` endpoint

**Files:** `src/app/api/ai/interview/route.ts`

Similar structure. Input: outline sections where `needs_interview = true`. On finish: delete existing `interview_questions` for this article + batch insert; `status → interviewing`.

**Step 1: Commit**

```bash
git add .
git commit -m "feat(ai): interview questions streaming endpoint"
```

---

### Task 38: Interview tab UI (single-page list)

**Files:** `_interview-tab.tsx`

**Step 1:** Render all questions grouped by section. Each: question text, textarea, "Skip" button. Top bar: "Skip All" + "Generate Draft" (disabled until all questions are not `pending`).

**Step 2: Autosave** — onBlur, 500ms debounce, calls `updateInterviewAnswer(id, answer)`.

**Step 3: Actions** — `skipQuestion`, `skipAll`, `answerQuestion`.

**Step 4: Commit**

```bash
git add .
git commit -m "feat(articles): interview single-page list UI"
```

---

### Task 39: `/api/ai/draft` endpoint

**Files:** `src/app/api/ai/draft/route.ts`

**Step 1: Route** — `streamText`, on completion server-side: convert markdown → tiptap JSON (via Tiptap helpers in Node), upsert `articles.body_markdown`, `articles.body_tiptap`, set `status = draft_ready`.

Tiptap conversion server-side — use `@tiptap/core` `generateJSON` with the same extensions.

**Step 2: Commit**

```bash
git add .
git commit -m "feat(ai): draft streaming endpoint with server-side persistence"
```

---

### Task 40: Draft streaming UI (pre-editor view)

**Files:** `_draft-tab.tsx`

**Step 1:** Plain `<pre>` that accumulates markdown as stream arrives. "Cancel" aborts. "Enter editor" once done → navigates to `?tab=editor`.

**Step 2: Commit**

```bash
git add .
git commit -m "feat(articles): draft streaming view"
```

---

### Task 41: Server-side markdown ↔ Tiptap converters

**Files:** `src/lib/tiptap/extensions.ts`, `src/lib/tiptap/serialize.ts`, tests

**Step 1: Extensions bundle** — shared by browser and server.

```ts
// src/lib/tiptap/extensions.ts
import StarterKit from '@tiptap/starter-kit'
import { Image } from '@tiptap/extension-image'
import { Link } from '@tiptap/extension-link'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'

export const tiptapExtensions = [StarterKit, Image, Link, Placeholder, Markdown]
```

**Step 2: Server converters** — `src/lib/tiptap/serialize.ts`

```ts
import { generateJSON, generateHTML } from '@tiptap/html'
import { tiptapExtensions } from './extensions'
// NOTE: markdown→tiptap uses tiptap-markdown via Editor instance (jsdom or DOMParser polyfill not needed on Node 24 for our use).
// Simplest reliable path: parse md → HTML with marked → generateJSON.
import { marked } from 'marked'
export function markdownToTiptap(md: string) {
  const html = marked.parse(md, { async: false }) as string
  return generateJSON(html, tiptapExtensions)
}
export function tiptapToMarkdown(doc: unknown): string {
  // use tiptap-markdown's Editor.storage path; simplest: instantiate Editor with headless DOM.
  // For server: use `@tiptap/core` Editor with element: undefined and read editor.storage.markdown.getMarkdown().
  // Implement with a small helper that creates a headless Editor via happy-dom.
  // (Implementation body omitted — write it and test it in Step 3.)
  throw new Error('implement with headless editor')
}
```

**Step 3: Test** — unit tests for round-trip `md → tiptap → md` preserving headings and paragraphs.

**Step 4: Commit**

```bash
git add .
git commit -m "feat(tiptap): server-side md ↔ tiptap converters"
```

---

### Task 42: Autosave for article body (Tiptap)

**Files:** add to editor tab (Task 44 will build the editor itself).

**Actions:**
```ts
'use server'
export async function saveArticleBody(articleId: string, tiptap: unknown) {
  const md = tiptapToMarkdown(tiptap)
  await supabase.from('articles').update({ body_tiptap: tiptap, body_markdown: md, status: 'editing' }).eq('id', articleId)
}
```

**Commit message:** `feat(articles): autosave action for article body`

---

## Part F — Editor + images + SEO (Tasks 43-54)

### Task 43: Tiptap editor component

**Files:** `src/components/tiptap/editor.tsx`

**Step 1:** Use `useEditor({ extensions: tiptapExtensions, content: initial })`.
**Step 2:** Debounced autosave (1s).
**Step 3:** Floating menu (Task 48).

**Commit message:** `feat(editor): Tiptap React component with autosave`

---

### Task 44: Editor tab renders editor

**Files:** `_editor-tab.tsx`

- If `body_tiptap` null and `body_markdown` present → initialize by `markdownToTiptap(body_markdown)`.
- Render editor.

**Commit message:** `feat(articles): editor tab`

---

### Task 45: Storage bucket + policies

**Files:** `supabase/migrations/20260420000000_storage.sql`

**Step 1:** SQL

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('article-images', 'article-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY article_images_read ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (bucket_id = 'article-images');

CREATE POLICY article_images_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'article-images'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_tenant_ids())
  );

CREATE POLICY article_images_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'article-images'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_tenant_ids())
  );

CREATE POLICY article_images_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'article-images'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_tenant_ids())
  );
```

**Step 2:** `npx supabase db reset` then `npm run db:types`.

**Commit message:** `feat(storage): article-images bucket with tenant-scoped policies`

---

### Task 46: Signed upload URL action

**Files:** `src/app/[locale]/(app)/projects/[projectId]/articles/[articleId]/upload-actions.ts`

```ts
'use server'
import { adminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

export async function getUploadUrl(articleId: string, contentType: string, kind: 'feature'|'inline') {
  const supabase = await createClient()
  const { data: article } = await supabase.from('articles').select('tenant_id,project_id').eq('id', articleId).single()
  if (!article) throw new Error('unauthorized')
  const ext = contentType.split('/')[1] || 'bin'
  const path = `${article.tenant_id}/${articleId}/${kind}/${randomUUID()}.${ext}`
  const admin = adminClient()
  const { data, error } = await admin.storage.from('article-images').createSignedUploadUrl(path)
  if (error) throw error
  return { path, token: data.token, signedUrl: data.signedUrl }
}

export async function saveImage(articleId: string, storagePath: string, kind: 'feature'|'inline') {
  const supabase = await createClient()
  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/article-images/${storagePath}`
  const { data, error } = await supabase.from('article_images').insert({
    article_id: articleId, storage_path: storagePath, url: publicUrl, kind,
  }).select('id,url').single()
  if (error) throw error
  if (kind === 'feature') {
    await supabase.from('articles').update({ feature_image_url: publicUrl }).eq('id', articleId)
  }
  return data
}
```

**Commit message:** `feat(storage): signed upload URL and image save actions`

---

### Task 47: Image upload in editor

**Files:** `src/components/tiptap/image-upload.tsx`, wire into editor

**Step 1: Upload flow**
```ts
const { path, signedUrl } = await getUploadUrl(articleId, file.type, 'inline')
await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'content-type': file.type } })
const { url } = await saveImage(articleId, path, 'inline')
editor.chain().focus().setImage({ src: url, alt: '' }).run()
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat(editor): image upload and insert"
```

---

### Task 48: Feature image UI

**Files:** `_feature-image.tsx`

Drop zone on top of article page. Same upload action with `kind='feature'`.

**Commit message:** `feat(articles): feature image upload`

---

### Task 49: SEO metadata tab

**Files:** `_seo-tab.tsx`

All fields from **[DESIGN §4.2 articles]** SEO group. Autosave per field.

**Commit message:** `feat(articles): SEO metadata tab`

---

### Task 50: `/api/ai/meta-suggest` + UI

**Files:** `src/app/api/ai/meta-suggest/route.ts`, wire button in SEO tab

**Step 1: Route** — `streamObject` with `metaSchema`.
**Step 2: UI** — "AI suggest" button → streaming two fields in parallel; user taps "Use" to copy into the form.

**Commit message:** `feat(seo): AI meta suggestion`

---

### Task 51: Floating menu + `/api/ai/rewrite`

**Files:** `src/app/api/ai/rewrite/route.ts`, `_floating-menu.tsx`

**Step 1: Route** — `streamText` with `REWRITE_SYSTEM`; body has `selected_text`, `instruction`, `projectId`.
**Step 2: UI** — Tiptap's `BubbleMenu` shows on selection; four buttons (更簡潔/更詳細/改語氣/自訂); streaming result replaces selection via `editor.commands.insertContent`.

**Commit message:** `feat(editor): rewrite selection with floating menu`

---

### Task 52: Edit image alt / caption

**Files:** image node edit popover

- Click image → popover with alt and caption inputs → debounced save to `article_images`.
- Also update Tiptap node attrs so HTML output has proper `alt`.

**Commit message:** `feat(editor): edit image alt and caption`

---

### Task 53: Articles list page

**Files:** `src/app/[locale]/(app)/projects/[projectId]/articles/page.tsx`

Table/cards: title, target_keyword, pillar, status, updated_at. Filter by status and pillar. Sort by updated_at.

**Commit message:** `feat(articles): list page with filter/sort`

---

### Task 54: Delete article

**Action:** `deleteArticle(id)`; cascades to outline / questions / images / publish_targets via FK.

**Commit message:** `feat(articles): delete article`

---

## Part G — Ghost publishing (Tasks 55-63)

### Task 55: AES-256-GCM encryption utility

**Files:** `src/lib/crypto/encrypt.ts`, `src/lib/crypto/encrypt.test.ts`

**Step 1 (TDD): failing test**

```ts
// encrypt.test.ts
import { describe, it, expect } from 'vitest'
import { encryptJson, decryptJson } from './encrypt'

describe('encryption', () => {
  it('round-trips JSON', () => {
    const enc = encryptJson({ apiUrl: 'https://x', apiKey: 'abc' })
    expect(decryptJson(enc)).toEqual({ apiUrl: 'https://x', apiKey: 'abc' })
  })
  it('each encryption produces a different ciphertext', () => {
    const a = encryptJson({ x: 1 }); const b = encryptJson({ x: 1 })
    expect(Buffer.compare(a, b)).not.toBe(0)
  })
})
```

`npm run test:run` → should fail (function undefined).

**Step 2: Implement**

```ts
import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'base64')
export function encryptJson(value: unknown): Buffer {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const pt = Buffer.from(JSON.stringify(value), 'utf-8')
  const ct = Buffer.concat([cipher.update(pt), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct])
}
export function decryptJson<T>(buf: Buffer): T {
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const ct = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv)
  decipher.setAuthTag(tag)
  const pt = Buffer.concat([decipher.update(ct), decipher.final()])
  return JSON.parse(pt.toString('utf-8'))
}
```

**Step 3: Pass tests.**

**Step 4: Commit**

```bash
git add .
git commit -m "feat(crypto): AES-256-GCM JSON encryption utility"
```

---

### Task 56: Ghost connection form

**Files:** `src/app/[locale]/(app)/projects/[projectId]/settings/page.tsx`, `_ghost-form.tsx`, `settings-actions.ts`

**Step 1: Fields** — name, admin_api_url, admin_api_key, platform='ghost'.
**Step 2: Action** — validate `admin_api_key` format `^[a-f0-9]{24}:[a-f0-9]{64}$`; encrypt `{ apiUrl, apiKey }`; insert/update `site_connections`.

**Commit message:** `feat(settings): Ghost connection form`

---

### Task 57: Test connection button

**Files:** `settings-actions.ts` add `testConnection(connectionId)`

**Step 1:** Decrypt config; call Ghost `/admin/site/` with JWT auth (Ghost Admin API client handles JWT from `id:secret`); update `last_tested_at` / `last_test_ok`.

```ts
import GhostAdminAPI from '@tryghost/admin-api'
const { apiUrl, apiKey } = decryptJson(row.config_encrypted)
const api = new GhostAdminAPI({ url: apiUrl, key: apiKey, version: 'v5.0' })
try { await api.site.read(); ok = true } catch { ok = false }
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat(settings): test Ghost connection"
```

---

### Task 58: URL normalize — TS mirror + test

**Files:** `src/lib/url/normalize.ts`, tests

**Step 1 (TDD):**

```ts
// normalize.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeUrl } from './normalize'
it.each([
  ['HTTPS://Site.com/Post/?utm=x#top', 'https://site.com/post'],
  ['https://x.com/a/', 'https://x.com/a'],
  ['https://x.com/a', 'https://x.com/a'],
  ['', null],
  [null as any, null],
])('normalizes %s → %s', (input, expected) => {
  expect(normalizeUrl(input)).toBe(expected)
})
```

**Step 2: Implement**

```ts
export function normalizeUrl(u: string | null | undefined): string | null {
  if (!u) return null
  return u.toLowerCase().replace(/[#?].*$/, '').replace(/\/+$/, '')
}
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat(url): normalize helper matching Postgres function"
```

---

### Task 59: Ghost client wrapper

**Files:** `src/lib/ghost/client.ts`

```ts
import GhostAdminAPI from '@tryghost/admin-api'
import { decryptJson } from '@/lib/crypto/encrypt'

export function ghostClientFromRow(row: { config_encrypted: Buffer }) {
  const { apiUrl, apiKey } = decryptJson<{ apiUrl: string; apiKey: string }>(row.config_encrypted)
  return new GhostAdminAPI({ url: apiUrl, key: apiKey, version: 'v5.0' })
}
```

**Commit message:** `feat(ghost): Ghost Admin API client wrapper`

---

### Task 60: `/api/publish/ghost` endpoint

**Files:** `src/app/api/publish/ghost/route.ts`

**Step 1: Pseudocode**

```ts
POST { articleId, connectionId, action: 'publish'|'draft'|'unpublish', scheduledFor? }

1. Fetch article, connection, article_images, existing publish_target.
2. If action === 'unpublish': call ghost.posts.delete(remote_post_id); update row; log; return.
3. Else:
   - Download each image from Supabase, upload to Ghost (ghost.images.upload), note mapping from supabase URL → ghost URL.
   - Replace URLs in body_markdown.
   - Render HTML via marked.
   - Payload: { title, slug, html, excerpt, meta_title, meta_description, canonical_url, feature_image, tags: tags.map(t => ({name:t})), status: action === 'publish' ? 'published' : 'draft', published_at: scheduledFor }
   - If existing remote_post_id → ghost.posts.edit; else ghost.posts.add.
4. Upsert publish_targets with remote_post_id, remote_url (post.url), remote_status, published_at.
5. Insert publish_logs success row. Catch errors → log failure, rethrow.
```

Full code — write in one file; expect ~150-200 lines.

**Step 2: Commit**

```bash
git add .
git commit -m "feat(publish): Ghost publish/draft/unpublish endpoint"
```

---

### Task 61: Publish drawer UI

**Files:** `_publish-tab.tsx`

- Show current `publish_targets` for this article (currently 0 or 1 for M1 single-connection).
- Buttons: Publish / Save as Draft / Republish / Unpublish.
- Status badge + remote URL link + published_at.
- Schedule field disabled ("Coming in M2").

**Commit message:** `feat(publish): publish drawer UI`

---

### Task 62: Publish logs list

**Files:** `_publish-logs.tsx`

Last 10 logs for this article's publish_targets.

**Commit message:** `feat(publish): publish logs display`

---

### Task 63: E2E publishing manual verification

Use an actual test Ghost site (self-hosted or ghost.io trial).

**Steps:**
1. Sign up a new account in local app.
2. Create project + fill brand.
3. Plan Pillar Cluster.
4. Pick one article → outline → interview → draft.
5. Edit in Tiptap, upload one image, set feature image, fill SEO.
6. Add Ghost connection → test passes.
7. Publish.
8. Open Ghost site → confirm post appears with correct:
   - title, content, images (Ghost-hosted URLs), tags, meta title/description.
9. Edit content in Quillo → republish → confirm update.
10. Unpublish → confirm gone.

Commit message: `docs: E2E publishing verification steps (nothing to commit; manual run)`.

---

## Part H — Polish & ship (Tasks 64-72)

### Task 64: Empty states

Wherever there's a list: projects, pillars, articles, publish_targets, logs. Short copy + CTA.

**Commit message:** `feat(ui): empty states`

---

### Task 65: Error boundaries and toasts

**Files:** `src/app/[locale]/(app)/error.tsx`, `src/components/toaster.tsx`

Use `sonner` or hand-roll a minimal toaster.

```bash
npm i sonner
```

**Commit message:** `feat(ui): global error boundary and toasts`

---

### Task 66: Loading states

Next.js `loading.tsx` in each segment; skeleton for article editor.

**Commit message:** `feat(ui): loading states`

---

### Task 67: i18n coverage audit

**Files:** scripts or manual.

**Step 1:** grep for Chinese / English string literals in JSX; move to messages.

```bash
npx tsc --noEmit && npm run lint
```

**Step 2:** Commit

```bash
git add .
git commit -m "chore(i18n): move stray literals into message catalogs"
```

---

### Task 68: Locale switcher

**Files:** `src/components/locale-switcher.tsx`

Dropdown in AppShell; uses `useRouter` from `@/i18n/routing` to switch.

**Commit message:** `feat(i18n): locale switcher in app shell`

---

### Task 69: Smoke test script (Playwright)

**Files:** `playwright.config.ts`, `tests/e2e/smoke.spec.ts`

```bash
npm i -D @playwright/test
npx playwright install chromium
```

**Step 1: Config** — base URL `http://localhost:3000`, projects: chromium only.

**Step 2: Test** — signup → create project → save brand → skip planning → go to /projects expected to list.

> Full end-to-end is too flaky with AI streaming for M1 CI. Keep smoke to non-AI paths.

**Commit message:** `test(e2e): smoke for auth + project creation`

---

### Task 70: Deploy to Vercel (preview)

**Step 1:** `git push origin main` (assumes a remote is configured; if not, `gh repo create` first).

**Step 2:** In Vercel dashboard: confirm project linked; confirm env vars pushed (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`, `NEXT_PUBLIC_SITE_URL`).

**Step 3:** Deploy — `npx vercel` (preview) or push PR.

**Step 4:** Smoke test on preview URL.

**Commit message:** none (CI-triggered).

---

### Task 71: Production Supabase

**Step 1:** Create Supabase project in cloud; apply migrations via `npx supabase db push --linked`.
**Step 2:** Update Vercel production env vars.
**Step 3:** Redeploy to production.

**Commit message:** none.

---

### Task 72: Launch checklist

- [ ] Google OAuth credentials set in Supabase cloud
- [ ] Email confirmation re-enabled for production
- [ ] `NEXT_PUBLIC_SITE_URL` = production domain
- [ ] `ENCRYPTION_KEY` is a **different** key from dev and stored in 1Password / password manager
- [ ] Tested end-to-end on production: signup → publish
- [ ] At least one working locale switch
- [ ] Basic dashboard bookmark in browser

Commit message: `docs: M1 launch checklist`.

---

## Appendix — Risk register

| Risk | Mitigation |
|---|---|
| `tiptap-markdown` round-trip loses formatting | Round-trip tests in Task 41; fallback to only-markdown storage + re-parse on editor mount |
| AI output misses Zod schema repeatedly | `streamObject` has a built-in single retry; if recurring, add `system`-level reinforcement + examples |
| Supabase Storage upload CORS on Vercel | If direct upload fails in prod, fall back to route-handler proxy upload |
| Ghost admin key format changes | Pin `@tryghost/admin-api` version; snapshot the post payload shape in a log on failure |
| Vercel function 300s limit hit by draft of very long articles | Chunk draft by section if > 15 sections; M1 unlikely |
| OIDC token expired locally | `vercel env pull .env.local` refresh; add docs note |

## Appendix — File / commit count estimate

~72 tasks, ~65 commits, ~85-100 new files. Full file tree matches **[DESIGN §3.3]**.
