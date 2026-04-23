import { streamObject } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MODELS } from '@/lib/ai/gateway'
import { planStep2System, brandContextBlock } from '@/lib/ai/prompts'
import { pillarPlanSchema } from '@/lib/ai/schemas'

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
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad request', { status: 400 })

  const supabase = await createClient()
  const [{ data: project }, { data: brand }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', parsed.data.projectId).single(),
    supabase.from('brand_materials').select('*').eq('project_id', parsed.data.projectId).single(),
  ])
  if (!project) return new Response('Project not found', { status: 404 })

  const existingBlock = parsed.data.orphanArticles.length > 0
    ? `\n\n<existing_articles>\n${parsed.data.orphanArticles
        .map(
          (a) =>
            `<article id="${a.id}"><title>${a.title}</title><target_keyword>${a.target_keyword ?? ''}</target_keyword></article>`,
        )
        .join('\n')}\n</existing_articles>`
    : ''

  const result = streamObject({
    model: MODELS.main,
    schema: pillarPlanSchema,
    system: `${planStep2System(parsed.data.pillarCount)}\n\n${brandContextBlock(project, brand)}`,
    prompt: `Confirmed direction:\n${parsed.data.direction}${existingBlock}\n\nProduce the Pillar Cluster plan matching the schema exactly.`,
  })

  return result.toTextStreamResponse()
}
