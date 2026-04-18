import { streamObject } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MODELS } from '@/lib/ai/gateway'
import { INTERVIEW_SYSTEM, brandContextBlock } from '@/lib/ai/prompts'
import { interviewSchema } from '@/lib/ai/schemas'

export const runtime = 'nodejs'
export const maxDuration = 120

const bodySchema = z.object({ articleId: z.string().uuid() })

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad request', { status: 400 })

  const supabase = await createClient()

  const { data: article } = await supabase
    .from('articles')
    .select('*, article_outlines(sections)')
    .eq('id', parsed.data.articleId)
    .single()
  if (!article) return new Response('Not found', { status: 404 })

  const sections = (article.article_outlines as { sections: Array<{ id: string; title: string; purpose: string; needs_interview: boolean }> } | null)?.sections ?? []
  const needs = sections.filter((s) => s.needs_interview)
  if (needs.length === 0) return new Response('No interview sections', { status: 400 })

  const [{ data: project }, { data: brand }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', article.project_id).single(),
    supabase.from('brand_materials').select('*').eq('project_id', article.project_id).single(),
  ])
  if (!project) return new Response('Project missing', { status: 404 })

  const result = streamObject({
    model: MODELS.main,
    schema: interviewSchema,
    system: `${INTERVIEW_SYSTEM}\n\n${brandContextBlock(project, brand)}`,
    prompt: JSON.stringify({
      article: {
        title: article.title,
        target_keyword: article.target_keyword,
        word_count_target: article.word_count_target,
      },
      sections_needing_interview: needs,
    }),
    onFinish: async ({ object }) => {
      if (!object) return
      // Clear existing and replace
      await supabase.from('interview_questions').delete().eq('article_id', article.id)
      const rows = (object.questions ?? []).map((q, i) => ({
        article_id: article.id,
        tenant_id: article.tenant_id,
        section_id: q.section_id,
        question: q.question,
        position: i,
      }))
      if (rows.length) {
        await supabase.from('interview_questions').insert(rows)
      }
      await supabase.from('articles').update({ status: 'interviewing' }).eq('id', article.id)
    },
  })

  return result.toTextStreamResponse()
}
