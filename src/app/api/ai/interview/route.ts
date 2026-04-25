import { streamObject } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MODELS } from '@/lib/ai/gateway'
import { PLAN_AND_QUESTIONS_SYSTEM, brandContextBlock } from '@/lib/ai/prompts'
import { planAndQuestionsSchema } from '@/lib/ai/schemas'
import { validateBody } from '@/lib/http/validate'
import { fetchProjectContext, setArticleStatus } from '@/lib/supabase/helpers'
import type { ArticleStatus } from '@/lib/article'

export const runtime = 'nodejs'
export const maxDuration = 120

const bodySchema = z.object({ articleId: z.string().uuid() })

export async function POST(req: Request) {
  const parsed = await validateBody(req, bodySchema)
  if (parsed instanceof Response) return parsed

  const supabase = await createClient()

  const { data: article } = await supabase
    .from('articles')
    .select('*, pillars(title,description)')
    .eq('id', parsed.data.articleId)
    .single()
  if (!article) return new Response('Not found', { status: 404 })
  const busy: ArticleStatus[] = ['outlining', 'drafting']
  if (busy.includes(article.status as ArticleStatus)) {
    return new Response('Busy', { status: 409 })
  }

  const ctx = await fetchProjectContext(supabase, article.project_id)
  if (!ctx) return new Response('Project missing', { status: 404 })
  const { project, brand } = ctx

  // Advance status (acts as concurrency lock)
  await setArticleStatus(supabase, article.id, 'outlining')

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
        await setArticleStatus(supabase, article.id, 'planned')
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

      await setArticleStatus(supabase, article.id, 'interviewing')
    },
  })

  return result.toTextStreamResponse()
}
