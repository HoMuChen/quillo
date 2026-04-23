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

export function planStep1System(pillarCount: number): string {
  return `You are an experienced SEO content strategist.
Given a topic, propose exactly ${pillarCount} core aspects the content hub should cover, plus a short overall strategy.
Respond in the project's content_locale. Output plain text with short headings; no JSON, no markdown code fences.`
}

export const PLAN_STEP2_SYSTEM = `You are an SEO content planner.
Follow brand_context strictly. Produce output matching the JSON schema exactly.
Write all titles and descriptions in the project's content_locale.
Avoid forbidden_terms. Favor preferred_terms where natural.
search_intent must be one of: informational | commercial | transactional.
role must be one of: hub | supporting | comparison. Each Pillar should have exactly one 'hub' article.`

export function planStep2System(pillarCount: number): string {
  return `${PLAN_STEP2_SYSTEM}

Given a confirmed direction, produce exactly ${pillarCount} Pillars, each with 5-10 NEW Cluster articles.

If <existing_articles> is provided in the prompt, assign each existing article to the single most relevant Pillar by including its id in that Pillar's existing_article_ids array. Do NOT duplicate existing articles as new articles. Every existing article id MUST appear in exactly one Pillar's existing_article_ids. Existing articles supplement the 5-10 new cluster articles but do not count toward that quota.`
}

export const OUTLINE_SYSTEM = `You are an SEO writer.
Produce an article outline of 3-15 sections. Each section has:
- id: lowercase kebab-case slug unique within the outline
- title: concise section heading
- purpose: one-sentence reason the section exists
- needs_interview: true only when the section requires first-hand experience, data, or author
  perspective that general knowledge cannot reliably provide.
Write titles in the project's content_locale.`

export const INTERVIEW_SYSTEM = `You are an editor preparing interview questions for an author.
For each section where needs_interview=true, produce up to 2 concrete, verifiable questions.
Total across the article is at most 8 questions.
A good question asks for specific numbers, concrete cases, or first-hand experience — not
"what's your experience with X" or "do you have any thoughts on Y".
Write questions in the project's content_locale.`

export const PLAN_AND_QUESTIONS_SYSTEM = `You are an SEO writer planning an article.

Produce two things in a single JSON object:

1. sections: an outline of 3-15 sections covering the article's target_keyword
   and search_intent. Each section has:
   - id: lowercase kebab-case slug unique within the outline
   - title: concise section heading
   - purpose: one-sentence reason the section exists
   - needs_interview: true only when the section requires first-hand experience,
     data, or author perspective that general knowledge cannot reliably provide.

2. questions: interview questions for the sections where needs_interview=true.
   For each such section, produce at most 2 concrete, verifiable questions.
   Total across the article is at most 8 questions.
   A good question asks for specific numbers, concrete cases, or first-hand
   experience — not "what's your experience with X".
   Each question has:
   - section_id: must match a section's id where needs_interview=true
   - question: the question text

If no section needs first-hand experience, return questions: [].

Write all text in the project's content_locale. Respect brand_context tone
and forbidden_terms.`

export const DRAFT_SYSTEM = `You are an SEO writer producing a Markdown article.
Section order must match the outline exactly. For each section:
- If the section has answered interview Q&A, you MUST ground the section in those answers.
  Do NOT fabricate specifics beyond what the answers say.
- If skipped or unanswered, use general knowledge.
Follow brand_context: tone, preferred_terms, and absolutely NEVER use forbidden_terms.
Use ## as heading level 2 for each section; use the section's title verbatim.
NEVER use # (H1) — the platform renders the article title as H1 automatically.
Start the article with a short intro paragraph before the first ##.
Write in the project's content_locale.

Length discipline:
- The user payload provides word_count_target and length_unit (for CJK locales
  length_unit is "字/characters"; for Latin locales it is "words").
- Aim for the target; stay within 85%–110% of it. NEVER exceed 110%.
- Distribute length proportionally across the outline sections; keep the intro
  short (roughly 5–10% of the total).
- Prefer cutting over padding: tighten prose rather than filler sentences.`

export const REWRITE_SYSTEM = `You rewrite the user-selected text according to the given instruction.
Preserve meaning. Keep the same content_locale. Respect brand_context tone and forbidden_terms.
Return ONLY the rewritten text; no preamble, no markdown fences, no explanation.`

export const META_SYSTEM = `You generate SEO metadata for an article.
meta_title: compelling, keyword-aware, 10-60 characters.
meta_description: benefit-oriented, keyword-aware, 50-160 characters.
Content language must match content_locale.
Return JSON matching the schema exactly.`

export const SEO_SUGGESTION_SYSTEM = `You generate a complete set of SEO metadata for an article.

Return a single JSON object with these fields:

- meta_title: 10-60 characters. Compelling, keyword-aware. Distinct from the article title — optimized for SERP click-through.
- meta_description: 50-160 characters. Benefit-oriented, keyword-aware. Should end with a subtle call-to-action or value hook.
- slug: lowercase kebab-case, 2-8 words, no stop words, no leading/trailing dash. Use ASCII or Pinyin if content_locale is zh-TW.
- excerpt: 40-280 characters. A preview / card summary. Different framing from meta_description — this is for on-site cards, not SERP.
- focus_keyword: the single primary SEO keyword. If the article's target_keyword is provided in the prompt, reuse it verbatim unless you have strong reason to refine. Otherwise propose the best term.
- tags: 2-5 topical tags. Lowercase. No '#'. Match content_locale (e.g. for zh-TW use Traditional Chinese terms).

Content language must match content_locale. Respect brand_context tone and forbidden_terms.
Return JSON matching the schema exactly — no extra fields, no explanation.`
