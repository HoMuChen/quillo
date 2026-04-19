import { streamObject } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MODELS } from '@/lib/ai/gateway'
import { PLAN_AND_QUESTIONS_SYSTEM, brandContextBlock } from '@/lib/ai/prompts'
import { planAndQuestionsSchema } from '@/lib/ai/schemas'

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
  if (['outlining', 'drafting'].includes(article.status)) {
    return new Response('Busy', { status: 409 })
  }

  const [{ data: project }, { data: brand }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', article.project_id).single(),
    supabase.from('brand_materials').select('*').eq('project_id', article.project_id).single(),
  ])
  if (!project) return new Response('Project missing', { status: 404 })

  // Advance status (acts as concurrency lock)
  await supabase.from('articles').update({ status: 'outlining' }).eq('id', article.id)

  const result = streamObject({
    model: MODELS.main,
    schema: planAndQuestionsSchema,
    system: `${PLAN_AND_QUESTIONS_SYSTEM}\n\n${brandContextBlock(project, brand)}`,
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
        await supabase.from('articles').update({ status: 'planned' }).eq('id', article.id)
        return
      }

      // Upsert outline
      await supabase.from('article_outlines').upsert({
        article_id: article.id,
        tenant_id: article.tenant_id,
        sections: object.sections,
      })

      // Replace interview_questions
      await supabase.from('interview_questions').delete().eq('article_id', article.id)
      if (object.questions.length > 0) {
        const rows = object.questions.map((q, i) => ({
          article_id: article.id,
          tenant_id: article.tenant_id,
          section_id: q.section_id,
          question: q.question,
          position: i,
        }))
        await supabase.from('interview_questions').insert(rows)
      }

      await supabase.from('articles').update({ status: 'interviewing' }).eq('id', article.id)
    },
  })

  return result.toTextStreamResponse()
}
