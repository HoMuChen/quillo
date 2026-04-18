import { streamObject } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MODELS } from '@/lib/ai/gateway'
import { PLAN_STEP2_SYSTEM, brandContextBlock } from '@/lib/ai/prompts'
import { clusterArticlesSchema } from '@/lib/ai/schemas'

export const runtime = 'nodejs'
export const maxDuration = 180

const bodySchema = z.object({
  projectId: z.string().uuid(),
  pillarId: z.string().uuid(),
})

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad request', { status: 400 })

  const supabase = await createClient()
  const [{ data: project }, { data: brand }, { data: pillar }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', parsed.data.projectId).single(),
    supabase.from('brand_materials').select('*').eq('project_id', parsed.data.projectId).single(),
    supabase.from('pillars').select('*').eq('id', parsed.data.pillarId).single(),
  ])
  if (!project || !pillar) return new Response('Not found', { status: 404 })

  const pillarContext = `<pillar>
<title>${pillar.title}</title>
<description>${pillar.description ?? ''}</description>
<target_keyword>${pillar.target_keyword ?? ''}</target_keyword>
<search_intent>${pillar.search_intent ?? ''}</search_intent>
</pillar>`

  const result = streamObject({
    model: MODELS.main,
    schema: clusterArticlesSchema,
    system: `${PLAN_STEP2_SYSTEM}\n\n${brandContextBlock(project, brand)}\n\nYou are regenerating only the Cluster articles for a single Pillar. Produce 5-10 articles. Exactly one article should have role='hub'; the rest should be 'supporting' or 'comparison'.`,
    prompt: `Regenerate cluster articles for this Pillar:\n${pillarContext}`,
  })

  return result.toTextStreamResponse()
}
