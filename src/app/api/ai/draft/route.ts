import { streamText } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MODELS } from '@/lib/ai/gateway'
import { DRAFT_SYSTEM, brandContextBlock } from '@/lib/ai/prompts'
import { validateBody } from '@/lib/http/validate'
import { fetchProjectContext, setArticleStatus } from '@/lib/supabase/helpers'
import type { ArticleStatus } from '@/lib/article'

export const runtime = 'nodejs'
export const maxDuration = 300

const bodySchema = z.object({ articleId: z.string().uuid() })

export async function POST(req: Request) {
  const parsed = await validateBody(req, bodySchema)
  if (parsed instanceof Response) return parsed

  const supabase = await createClient()

  const { data: article } = await supabase
    .from('articles')
    .select('*, article_outlines(sections)')
    .eq('id', parsed.data.articleId)
    .single()
  if (!article) return new Response('Not found', { status: 404 })
  const busy: ArticleStatus[] = ['drafting']
  if (busy.includes(article.status as ArticleStatus)) return new Response('Busy', { status: 409 })

  const [ctx, { data: questions }] = await Promise.all([
    fetchProjectContext(supabase, article.project_id),
    supabase
      .from('interview_questions')
      .select('section_id,question,answer,status')
      .eq('article_id', article.id)
      .order('position'),
  ])
  if (!ctx) return new Response('Project missing', { status: 404 })
  const { project, brand } = ctx

  const sections = (article.article_outlines as { sections: Array<{ id: string; title: string; purpose: string; needs_interview: boolean }> } | null)?.sections ?? []

  // Advance status
  const previousStatus = article.status as ArticleStatus
  await setArticleStatus(supabase, article.id, 'drafting')

  const isCjk = /^(zh|ja|ko)/i.test(project.content_locale ?? '')
  const lengthUnit = isCjk ? '字 (characters)' : 'words'
  const target = article.word_count_target ?? 1500
  const lengthMin = Math.round(target * 0.85)
  const lengthMax = Math.round(target * 1.1)

  const userPayload = {
    article: {
      title: article.title,
      target_keyword: article.target_keyword,
      lsi_keywords: article.lsi_keywords,
      word_count_target: target,
      length_unit: lengthUnit,
      length_min: lengthMin,
      length_max: lengthMax,
      role: article.role,
    },
    outline_sections: sections,
    interview_qa: (questions ?? []).map((q) => ({
      section_id: q.section_id,
      question: q.question,
      status: q.status,
      answer: q.answer,
    })),
  }

  const result = streamText({
    model: MODELS.main,
    system: `${DRAFT_SYSTEM}\n\n${brandContextBlock(project, brand)}`,
    prompt: JSON.stringify(userPayload),
    onFinish: async ({ text }) => {
      if (!text) {
        // Roll back status
        await setArticleStatus(supabase, article.id, previousStatus)
        return
      }
      await supabase
        .from('articles')
        .update({
          body_markdown: text,
          // Leave body_tiptap null — client converts on first editor mount.
          status: 'draft_ready' satisfies ArticleStatus,
        })
        .eq('id', article.id)
    },
  })

  return result.toTextStreamResponse()
}
