import { streamObject } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MODELS } from '@/lib/ai/gateway'
import { planStep2System, brandContextBlock, existingArticlesBlock } from '@/lib/ai/prompts'
import { pillarPlanSchema } from '@/lib/ai/schemas'
import { validateBody } from '@/lib/http/validate'
import { fetchProjectContext } from '@/lib/supabase/helpers'

export const runtime = 'nodejs'
export const maxDuration = 180

const bodySchema = z.object({
  projectId: z.string().uuid(),
  direction: z.string().min(1).max(10000),
  pillarCount: z.number().int().min(3).max(6).default(3),
  orphanArticles: z
    .array(
      z.object({
        id: z.string().uuid(),
        title: z.string(),
        target_keyword: z.string().nullable().optional(),
      }),
    )
    .default([]),
})

export async function POST(req: Request) {
  const parsed = await validateBody(req, bodySchema)
  if (parsed instanceof Response) return parsed

  const supabase = await createClient()
  const ctx = await fetchProjectContext(supabase, parsed.data.projectId)
  if (!ctx) return new Response('Project not found', { status: 404 })
  const { project, brand } = ctx

  const result = streamObject({
    model: MODELS.main,
    schema: pillarPlanSchema,
    system: `${planStep2System(parsed.data.pillarCount)}\n\n${brandContextBlock(project, brand)}`,
    prompt: `Confirmed direction:\n${parsed.data.direction}${existingArticlesBlock(parsed.data.orphanArticles)}\n\nProduce the Pillar Cluster plan matching the schema exactly.`,
  })

  return result.toTextStreamResponse()
}
