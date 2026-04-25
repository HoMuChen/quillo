import { streamText } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MODELS } from '@/lib/ai/gateway'
import { planStep1System, brandContextBlock, searchDataBlock } from '@/lib/ai/prompts'
import { validateBody } from '@/lib/http/validate'
import { fetchProjectContext } from '@/lib/supabase/helpers'

export const runtime = 'nodejs'
export const maxDuration = 120

const bodySchema = z.object({
  projectId: z.string().uuid(),
  topic: z.string().min(1).max(500),
  audience_supplement: z.string().max(1000).optional(),
  pillarCount: z.number().int().min(3).max(6).default(3),
  search_data: z.array(z.object({
    query: z.string(),
    impressions: z.number(),
    clicks: z.number(),
    avg_position: z.number(),
  })).optional(),
})

export async function POST(req: Request) {
  const parsed = await validateBody(req, bodySchema)
  if (parsed instanceof Response) return parsed

  const supabase = await createClient()
  const ctx = await fetchProjectContext(supabase, parsed.data.projectId)
  if (!ctx) return new Response('Project not found', { status: 404 })
  const { project, brand } = ctx

  const result = streamText({
    model: MODELS.main,
    system: `${planStep1System(parsed.data.pillarCount)}\n\n${brandContextBlock(project, brand)}`,
    prompt: `Topic: ${parsed.data.topic}\nAudience notes: ${parsed.data.audience_supplement ?? '(none)'}${searchDataBlock(parsed.data.search_data ?? [])}`,
  })

  return result.toTextStreamResponse()
}
