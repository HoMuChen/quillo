# Pillar count & pre-generation orphan assignment — Design

## Goal

Let users (a) pick how many pillars to generate, and (b) opt selected orphan articles into the pillar plan so the AI auto-assigns them to the right pillar during generation.

## Current state

- Step 1 streams a "direction" text from a topic + audience.
- Step 2 auto-starts on mount, AI generates 3–5 pillars (count AI-chosen). Each pillar has 5–10 cluster articles.
- Orphan articles (pillar_id IS NULL, source='quillo') are shown at the bottom of Step 2 post-generation; user assigns each to a pillar via a dropdown. Save action writes those mappings.

## Changes

### 1. Pillar count

- Step 1 form adds a small "幾個 Pillar" number picker (range 3–6, default 3).
- Value held in wizard state, passed to Step 2 component, sent to `/api/ai/plan/step2` as `pillarCount`.
- `PLAN_STEP2_SYSTEM` prompt updated: "Produce **exactly N** Pillars, each with 5–10 Cluster articles." (N interpolated at request time.)
- `pillarPlanSchema.pillars` loosens `.min(3).max(5)` → `.min(3).max(6)`.

### 2. Pre-generation orphan selection

- Step 2 no longer auto-starts. On mount it shows a config card:
  - The pillar count (read-only echo)
  - The orphan article list with checkboxes (previously post-gen dropdowns)
  - "Generate plan" button
- On click, Step 2 kicks off the AI stream, passing checked orphan articles as `orphanArticles: [{ id, title, target_keyword }]` to the API.
- AI prompt extended: "You may receive `existing_articles`. Assign each one to the most relevant pillar by populating `existing_article_ids` on that pillar."
- Schema adds `existing_article_ids: z.array(z.string().uuid()).optional()` per pillar.
- Cluster article count (`.min(5).max(10)`) counts NEW articles only — existing ones supplement but do not replace the new cluster articles. Prompt makes this explicit.

### 3. Save flow

- `savePlanAction` extracts `existing_article_ids` from each pillar in the AI output after the RPC creates the pillars.
- For each `(pillarIndex, articleId)` pair, update `articles.pillar_id` where `pillar_id IS NULL` (same safety check as today).
- The old `orphanAssignments` param kept for unchecked orphans the user might still assign manually on an optional post-gen UI. (To keep the diff tight, we remove the post-gen dropdown for now — users check orphans up front. Dropdown UI removed.)

## Files touched

| File | Change |
|---|---|
| `src/lib/ai/schemas.ts` | loosen max to 6; add `existing_article_ids` |
| `src/lib/ai/prompts.ts` | pillar-count placeholder; orphan assignment instruction |
| `src/app/api/ai/plan/step2/route.ts` | accept `pillarCount`, `orphanArticles` |
| `src/app/[locale]/(app)/projects/[projectId]/planning/new/_wizard.tsx` | pillar count input on Step 1; pass through to Step 2 |
| `src/app/[locale]/(app)/projects/[projectId]/planning/new/_step2.tsx` | config card, manual trigger, checkbox UI |
| `src/app/[locale]/(app)/projects/[projectId]/planning/new/actions.ts` | read `existing_article_ids` from plan |
| `messages/en/planning.json`, `messages/zh-TW/planning.json` | new keys |

## Out of scope

- New DB migration (none needed).
- Post-generation re-assignment UI (the dropdowns are removed; drag-and-drop on the planning page still works).
- Batching or streaming of orphan assignment — save remains a single transaction.
