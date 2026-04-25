import { streamText } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MODELS } from '@/lib/ai/gateway'
import { REWRITE_SYSTEM, brandContextBlock } from '@/lib/ai/prompts'
import { validateBody } from '@/lib/http/validate'
import { fetchProjectContext } from '@/lib/supabase/helpers'

export const runtime = 'nodejs'
export const maxDuration = 60

const bodySchema = z.object({
  projectId: z.string().uuid(),
  selectedText: z.string().min(1).max(5000),
  instruction: z.string().min(1).max(500),
})

export async function POST(req: Request) {
  const parsed = await validateBody(req, bodySchema)
  if (parsed instanceof Response) return parsed

  const supabase = await createClient()
  const ctx = await fetchProjectContext(supabase, parsed.data.projectId)
  if (!ctx) return new Response('Project missing', { status: 404 })
  const { project, brand } = ctx

  const result = streamText({
    model: MODELS.fast,
    system: `${REWRITE_SYSTEM}\n\n${brandContextBlock(project, brand)}`,
    prompt: `Instruction: ${parsed.data.instruction}\n\nSelected text:\n${parsed.data.selectedText}`,
  })

  return result.toTextStreamResponse()
}
