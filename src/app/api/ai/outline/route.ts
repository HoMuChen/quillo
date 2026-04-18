import { streamObject } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MODELS } from '@/lib/ai/gateway'
import { OUTLINE_SYSTEM, brandContextBlock } from '@/lib/ai/prompts'
import { outlineSchema } from '@/lib/ai/schemas'

export const runtime = 'nodejs'
export const maxDuration = 120

const bodySchema = z.object({ articleId: z.string().uuid() })

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad request', { status: 400 })

  const supabase = await createClient()
  const { data: article } = await supabase
    .from('articles')
    .select('*, pillars(title,description)')
    .eq('id', parsed.data.articleId)
    .single()
  if (!article) return new Response('Not found', { status: 404 })

  // Concurrency guard: reject if already outlining/drafting
  if (['outlining', 'drafting'].includes(article.status)) {
    return new Response('Busy', { status: 409 })
  }

  const [{ data: project }, { data: brand }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', article.project_id).single(),
    supabase.from('brand_materials').select('*').eq('project_id', article.project_id).single(),
  ])
  if (!project) return new Response('Project missing', { status: 404 })

  // Advance status so concurrent requests get 409
  await supabase.from('articles').update({ status: 'outlining' }).eq('id', article.id)

  const result = streamObject({
    model: MODELS.main,
    schema: outlineSchema,
    system: `${OUTLINE_SYSTEM}\n\n${brandContextBlock(project, brand)}`,
    prompt: JSON.stringify({
      article: {
        title: article.title,
        target_keyword: article.target_keyword,
        lsi_keywords: article.lsi_keywords,
        search_intent: article.search_intent,
        word_count_target: article.word_count_target,
        role: article.role,
      },
      pillar: article.pillars,
    }),
    onFinish: async ({ object }) => {
      if (!object) {
        // Rollback
        await supabase.from('articles').update({ status: 'planned' }).eq('id', article.id)
        return
      }
      await supabase.from('article_outlines').upsert({
        article_id: article.id,
        tenant_id: article.tenant_id,
        sections: object.sections,
      })
      await supabase.from('articles').update({ status: 'outline_ready' }).eq('id', article.id)
    },
  })

  return result.toTextStreamResponse()
}
