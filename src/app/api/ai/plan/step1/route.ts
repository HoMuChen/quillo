import { streamText } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MODELS } from '@/lib/ai/gateway'
import { planStep1System, brandContextBlock } from '@/lib/ai/prompts'

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
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad request', { status: 400 })

  const supabase = await createClient()
  const [{ data: project }, { data: brand }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', parsed.data.projectId).single(),
    supabase.from('brand_materials').select('*').eq('project_id', parsed.data.projectId).single(),
  ])
  if (!project) return new Response('Project not found', { status: 404 })

  const searchDataBlock = (parsed.data.search_data ?? []).length > 0
    ? `\n\n<search_data>\n${(parsed.data.search_data ?? [])
        .map((q) => `<query><text>${q.query}</text><impressions>${q.impressions}</impressions><clicks>${q.clicks}</clicks><avg_position>${q.avg_position.toFixed(1)}</avg_position></query>`)
        .join('\n')}\n</search_data>`
    : ''

  const result = streamText({
    model: MODELS.main,
    system: `${planStep1System(parsed.data.pillarCount)}\n\n${brandContextBlock(project, brand)}`,
    prompt: `Topic: ${parsed.data.topic}\nAudience notes: ${parsed.data.audience_supplement ?? '(none)'}${searchDataBlock}`,
  })

  return result.toTextStreamResponse()
}
