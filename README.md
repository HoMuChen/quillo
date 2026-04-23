# Quillo

AI-powered SEO content planning and writing tool. Quillo helps content teams go from topic idea to published article through a structured pillar-cluster workflow — with AI at every step.

## Features

### Content Planning
- **Pillar Cluster Wizard** — two-step AI workflow: generate a strategic direction, then produce a full pillar-cluster plan with configurable pillar count (3–6)
- **Orphan Article Assignment** — select existing unassigned articles before generation; AI automatically assigns them to the most relevant pillars
- **Cluster Regeneration** — regenerate articles for an individual pillar without touching the rest of the plan
- **Orphan Organizer** — AI groups unassigned articles into new pillars or assigns them to existing ones
- **Visual Planning Board** — bento-grid layout showing each pillar and its cluster articles; responsive for any pillar count

### Article Workflow
- **AI Draft Generation** — produces a full Markdown draft grounded in the outline and interview answers; respects word count target and brand voice
- **Outline Builder** — AI generates a 3–15 section outline with section purpose and interview flags
- **Interview Phase** — AI generates targeted questions for sections requiring first-hand experience; supports skipping or answering per-section
- **AI Rewrite** — select any passage in the editor and rewrite it with a custom instruction
- **Focus Editor** — distraction-free Tiptap rich-text editor with full article context in the sidebar

### SEO Tools
- **SEO Metadata Suggestions** — AI generates meta title, meta description, slug, excerpt, focus keyword, and tags in one shot
- **Meta Fields** — editable meta title and description with character-count guardrails

### Brand Voice
- **Brand Material Analysis** — paste up to 20 existing articles; AI extracts tone, author background, reader persona, preferred terms, forbidden terms, and E-E-A-T cases
- **Brand Context** — brand voice is automatically injected into every AI prompt across the product

### Publishing
- **Ghost Integration** — publish or update articles directly to a Ghost blog via the Admin API
- **Shopify Integration** — sync articles to/from a Shopify store blog via the Admin REST API

### Project Management
- **Multi-project** — separate brand, planning, and article space per project
- **Project Settings** — configure theme, target audience, content locale, and CMS connections
- **i18n** — UI available in Traditional Chinese (zh-TW) and English

## Tech Stack

- **Framework** — Next.js 15 (App Router)
- **Database** — Supabase (Postgres + RLS)
- **AI** — Vercel AI Gateway → Anthropic Claude (streamed text and structured object generation)
- **Editor** — Tiptap
- **Auth** — Supabase Auth
- **Styling** — Tailwind CSS
- **i18n** — next-intl

## Getting Started

```bash
pnpm install
pnpm dev
```

Copy `.env.example` to `.env.local` and fill in your Supabase credentials, then run database migrations:

```bash
npx supabase db push
```

Open [http://localhost:3000](http://localhost:3000).
