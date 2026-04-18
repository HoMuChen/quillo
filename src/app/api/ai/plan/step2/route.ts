import { streamObject } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MODELS } from '@/lib/ai/gateway'
import { PLAN_STEP2_SYSTEM, brandContextBlock } from '@/lib/ai/prompts'
import { pillarPlanSchema } from '@/lib/ai/schemas'

export const runtime = 'nodejs'
export const maxDuration = 180

const bodySchema = z.object({
  projectId: z.string().uuid(),
  direction: z.string().min(1).max(10000),
})

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad request', { status: 400 })

  const supabase = await createClient()
  const [{ data: project }, { data: brand }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', parsed.data.projectId).single(),
    supabase.from('brand_materials').select('*').eq('project_id', parsed.data.projectId).single(),
  ])
  if (!project) return new Response('Project not found', { status: 404 })

  const result = streamObject({
    model: MODELS.main,
    schema: pillarPlanSchema,
    system: `${PLAN_STEP2_SYSTEM}\n\n${brandContextBlock(project, brand)}`,
    prompt: `Confirmed direction:\n${parsed.data.direction}\n\nProduce the Pillar Cluster plan matching the schema exactly.`,
  })

  return result.toTextStreamResponse()
}
