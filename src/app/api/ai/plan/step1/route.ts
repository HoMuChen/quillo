import { streamText } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MODELS } from '@/lib/ai/gateway'
import { PLAN_STEP1_SYSTEM, brandContextBlock } from '@/lib/ai/prompts'

export const runtime = 'nodejs'
export const maxDuration = 120

const bodySchema = z.object({
  projectId: z.string().uuid(),
  topic: z.string().min(1).max(500),
  audience_supplement: z.string().max(1000).optional(),
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

  const result = streamText({
    model: MODELS.main,
    system: `${PLAN_STEP1_SYSTEM}\n\n${brandContextBlock(project, brand)}`,
    prompt: `Topic: ${parsed.data.topic}\nAudience notes: ${parsed.data.audience_supplement ?? '(none)'}`,
  })

  return result.toTextStreamResponse()
}
