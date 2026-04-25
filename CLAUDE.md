# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: Next.js version

This project runs **Next.js 16 + React 19**. APIs, file conventions, and config differ from older Next.js. Per `AGENTS.md`, before writing Next-specific code consult `node_modules/next/dist/docs/` rather than relying on training data. Notably:
- `cookies()`, `headers()`, and route `params` are **async** (`await params`, `await cookies()`).
- Route groups in use: `[locale]/(app)`, `[locale]/(auth)`, `[locale]/(focus)`.
- App Router server actions live in `actions.ts` / `*-actions.ts` files next to the route.

## Commands

Package manager is **pnpm** (per README). Scripts (`package.json`):

- `pnpm dev` — Next dev server on :3000
- `pnpm build` / `pnpm start` — production build / serve
- `pnpm lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + ts)
- `pnpm test` — Vitest watch mode
- `pnpm test:run` — Vitest single run (CI-style)
- `pnpm test:run -- src/lib/url/normalize.test.ts` — run a single test file
- `pnpm test:run -- -t "name fragment"` — run tests matching a name
- `pnpm db:types` — regenerate `src/lib/supabase/types.ts` from the **local** Supabase schema (requires `supabase start`)
- `npx supabase db push` — apply migrations to the linked Supabase project

Vitest uses `happy-dom` and aliases `@/* → src/*` plus a `server-only` stub (`vitest.server-only-stub.ts`); `vitest.setup.ts` injects a test `ENCRYPTION_KEY`. Tests live next to source as `*.test.ts(x)`.

## Environment

`.env.example` lists the required vars: Supabase URL/anon/service-role, `ENCRYPTION_KEY` (32 random bytes base64 — used by `src/lib/crypto/encrypt.ts` for AES-256-GCM of CMS credentials), `NEXT_PUBLIC_SITE_URL`, and `VERCEL_OIDC_TOKEN` (populated by `vercel env pull` for the AI Gateway). For local Supabase, `supabase/config.toml` runs API on :54321, DB on :54322.

## Architecture

### Routing & i18n

- All user-facing routes are nested under `src/app/[locale]/...` with locales `zh-TW` (default) and `en` declared in `src/i18n/routing.ts` (`localePrefix: 'always'`).
- **Use the locale-aware navigation** exported from `@/i18n/routing` (`Link`, `redirect`, `useRouter`, `usePathname`) — not the bare `next/navigation` versions — so the locale prefix is preserved.
- `src/middleware.ts` composes `next-intl` middleware **with** Supabase session refresh: it runs `updateSession` (rotates auth cookies via `@supabase/ssr`) and then merges those cookies onto the intl response. The matcher excludes `/api`, `/auth`, Next internals, and static assets.
- Three route groups have distinct shells:
  - `(app)` — main shell with sidebar (`src/components/app-shell.tsx`, `projects-sidebar.tsx`)
  - `(auth)` — login/signup
  - `(focus)` — distraction-free article editor (Tiptap)
- Translations live in `messages/{locale}/*.json`, split per feature (articles, brand, planning, etc.).

### Data layer (Supabase)

Three client factories in `src/lib/supabase/`:
- `client.ts` — browser client
- `server.ts` — RSC/server-action client; cookie writes are wrapped in try/catch because RSCs can't mutate cookies (middleware handles refresh)
- `admin.ts` — service-role client, marked `'server-only'`; bypasses RLS, use sparingly
- `middleware.ts` — the `updateSession` helper used by `src/middleware.ts`
- `types.ts` — generated; **don't hand-edit**, regen via `pnpm db:types`

Multitenancy & RLS: every business table has a `tenant_id` and BEFORE INSERT triggers (`set_tenant_from_project`, `set_tenant_from_article`, etc.) auto-fill it from the parent row. RLS policies key off `public.user_tenant_ids()`. New tables that belong to a project/article should follow the same trigger pattern (see `supabase/migrations/20260418000000_init.sql`).

Auth gate: server code that needs a user calls `requireUser()` from `src/lib/auth/require-user.ts`, which redirects unauthenticated visitors to the locale-aware `/login`.

Migrations are timestamped SQL in `supabase/migrations/`. The init migration defines the core schema (tenants, projects, brand_materials, pillars, articles, article_outlines, interview_questions, article_images, site_connections, publish_targets, publish_logs); later migrations add the pillar plan, article source, Shopify source, and GSC integration tables/RPCs.

### AI layer

- `src/lib/ai/gateway.ts` — model registry. `MODELS.main` = `anthropic/claude-sonnet-4.6` (planning, drafting); `MODELS.fast` = `anthropic/claude-haiku-4.5` (rewrite, meta). **Versioned slugs use dots, not hyphens** — the comment in the file is binding.
- `src/lib/ai/prompts.ts` — every prompt builder takes `(project, brand)` and emits a `<brand_context>` XML block. Always inject brand context in new AI prompts so tone/preferred-terms/forbidden-terms propagate.
- `src/lib/ai/schemas.ts` — Zod schemas used for `generateObject` / structured output (pillar plan, cluster articles, outline, interview questions, meta suggestions). Keep response schemas here, not inline in routes.
- AI HTTP routes under `src/app/api/ai/*` use `streamText` / `generateObject` from the `ai` SDK. They set `runtime = 'nodejs'` and a `maxDuration` (e.g. draft = 300s). Body shapes are validated with Zod.

### Integrations

- **Ghost**: `src/lib/ghost/client.ts` (Admin API) + `src/app/api/publish/ghost`. Site connection credentials are encrypted at rest using `src/lib/crypto/encrypt.ts` (AES-256-GCM, 12-byte IV, 16-byte tag, prefixed; `toBytea`/`fromBytea` adapt to Postgres `bytea` and tolerate legacy JSON-Buffer rows).
- **Shopify**: `src/lib/shopify/client.ts` + `src/app/api/publish/shopify`. Same encrypted-credentials pattern.
- **Google Search Console**: OAuth callback at `src/app/api/gsc/oauth`; daily sync via `src/app/api/cron/gsc-sync` scheduled by `vercel.json` (`0 3 * * *`). The `src/lib/gsc/` module is heavily tested — `auth`, `client`, `state`, `sync`, `topic-match`, `opportunities` all have colocated `*.test.ts`.

### Frontend conventions

- Server Components by default; client islands are explicit `_*.tsx` files prefixed with underscore (e.g. `_articles-table.tsx`, `_brand-form.tsx`) colocated with the route.
- Server actions live in `actions.ts` or `<feature>-actions.ts` next to the route.
- Tiptap editor + extensions are in `src/components/tiptap/`; the focus-mode editor route is under `(focus)/projects/[projectId]/articles/[articleId]`.
- Design system: deep-green ink + ochre accent + paper background, with dual-density `canvas` (writing) vs `chrome` (dashboards). The authoritative spec is `docs/DESIGN.md`; `docs/plans/design-system.md` and `docs/demo.html` are older references that DESIGN.md supersedes when they conflict. Italic Instrument Serif is reserved for `<h1>`, AI-generated content, the "Quillo" lockup, and KPI numerals; use `text-ochre-ink` (#8A5A1C) for ochre **text**, plain `ochre` only for fills.

## Path alias

`@/*` maps to `src/*` in both `tsconfig.json` and `vitest.config.ts`. Prefer it over deep relatives.
