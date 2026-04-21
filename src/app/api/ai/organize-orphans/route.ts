import { streamObject } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MODELS } from '@/lib/ai/gateway'
import { organizeOrphansSchema } from '@/lib/ai/schemas'

export const runtime = 'nodejs'
export const maxDuration = 120

const bodySchema = z.object({
  projectId: z.string().uuid(),
  orphanArticles: z.array(z.object({
    id: z.string(),
    title: z.string(),
    target_keyword: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
  })),
  pillars: z.array(z.object({
    id: z.string(),
    title: z.string(),
    target_keyword: z.string().nullable().optional(),
  })),
})

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad request', { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { orphanArticles, pillars } = parsed.data

  const existingPillarsBlock = pillars.length > 0
    ? `Existing pillars you CAN assign articles to:\n${pillars.map(p => `- id:${p.id} "${p.title}"${p.target_keyword ? ` (keyword: ${p.target_keyword})` : ''}`).join('\n')}`
    : 'No existing pillars yet.'

  const articlesBlock = orphanArticles.map(a =>
    `- id:${a.id} "${a.title}"${a.target_keyword ? ` [kw: ${a.target_keyword}]` : ''}${a.tags?.length ? ` [tags: ${a.tags.join(', ')}]` : ''}`
  ).join('\n')

  const result = streamObject({
    model: MODELS.main,
    schema: organizeOrphansSchema,
    system: `You are an SEO content strategist helping to organize standalone articles into content pillars.

Rules:
- Group articles that share a common topic or target audience into pillars.
- Only create a new pillar if AT LEAST 3 articles clearly belong to it.
- Do NOT force every article into a group — it is fine to leave some unassigned.
- For new pillars: choose a clear, keyword-rich title and a primary target_keyword.
- For new pillar temp_ids use simple strings like "p1", "p2", etc.
- If an article fits an existing pillar, use existing_assignments instead of creating a new pillar.
- Assign each article to at most one pillar.`,
    prompt: `${existingPillarsBlock}

Standalone articles to organize (${orphanArticles.length} total):
${articlesBlock}

Return a grouping plan. Remember: new pillars need ≥3 articles. Leave ambiguous articles unassigned.`,
  })

  return result.toTextStreamResponse()
}
