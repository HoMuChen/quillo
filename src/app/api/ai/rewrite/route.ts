import { streamText } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MODELS } from '@/lib/ai/gateway'
import { REWRITE_SYSTEM, brandContextBlock } from '@/lib/ai/prompts'

export const runtime = 'nodejs'
export const maxDuration = 60

const bodySchema = z.object({
  projectId: z.string().uuid(),
  selectedText: z.string().min(1).max(5000),
  instruction: z.string().min(1).max(500),
})

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad request', { status: 400 })

  const supabase = await createClient()
  const [{ data: project }, { data: brand }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', parsed.data.projectId).single(),
    supabase.from('brand_materials').select('*').eq('project_id', parsed.data.projectId).single(),
  ])
  if (!project) return new Response('Project missing', { status: 404 })

  const result = streamText({
    model: MODELS.fast,
    system: `${REWRITE_SYSTEM}\n\n${brandContextBlock(project, brand)}`,
    prompt: `Instruction: ${parsed.data.instruction}\n\nSelected text:\n${parsed.data.selectedText}`,
  })

  return result.toTextStreamResponse()
}
