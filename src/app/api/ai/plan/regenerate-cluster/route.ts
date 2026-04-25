import { streamObject } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MODELS } from '@/lib/ai/gateway'
import { PLAN_STEP2_SYSTEM, brandContextBlock, pillarContextBlock } from '@/lib/ai/prompts'
import { clusterArticlesSchema } from '@/lib/ai/schemas'
import { validateBody } from '@/lib/http/validate'
import { fetchProjectContext } from '@/lib/supabase/helpers'

export const runtime = 'nodejs'
export const maxDuration = 180

const bodySchema = z.object({
  projectId: z.string().uuid(),
  pillarId: z.string().uuid(),
})

export async function POST(req: Request) {
  const parsed = await validateBody(req, bodySchema)
  if (parsed instanceof Response) return parsed

  const supabase = await createClient()
  const [ctx, { data: pillar }] = await Promise.all([
    fetchProjectContext(supabase, parsed.data.projectId),
    supabase.from('pillars').select('*').eq('id', parsed.data.pillarId).single(),
  ])
  if (!ctx || !pillar) return new Response('Not found', { status: 404 })
  const { project, brand } = ctx

  const result = streamObject({
    model: MODELS.main,
    schema: clusterArticlesSchema,
    system: `${PLAN_STEP2_SYSTEM}\n\n${brandContextBlock(project, brand)}\n\nYou are regenerating only the Cluster articles for a single Pillar. Produce 5-10 articles. Exactly one article should have role='hub'; the rest should be 'supporting' or 'comparison'.`,
    prompt: `Regenerate cluster articles for this Pillar:\n${pillarContextBlock(pillar)}`,
  })

  return result.toTextStreamResponse()
}
