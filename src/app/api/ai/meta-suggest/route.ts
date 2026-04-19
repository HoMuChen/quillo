import { streamObject } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MODELS } from '@/lib/ai/gateway'
import { SEO_SUGGESTION_SYSTEM, brandContextBlock } from '@/lib/ai/prompts'
import { seoSuggestionSchema } from '@/lib/ai/schemas'

export const runtime = 'nodejs'
export const maxDuration = 60

const bodySchema = z.object({ articleId: z.string().uuid() })

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad request', { status: 400 })

  const supabase = await createClient()
  const { data: article } = await supabase
    .from('articles')
    .select('title,target_keyword,focus_keyword,lsi_keywords,body_markdown,project_id')
    .eq('id', parsed.data.articleId)
    .single()
  if (!article) return new Response('Not found', { status: 404 })

  const [{ data: project }, { data: brand }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', article.project_id).single(),
    supabase.from('brand_materials').select('*').eq('project_id', article.project_id).single(),
  ])
  if (!project) return new Response('Project missing', { status: 404 })

  const bodyTruncated = (article.body_markdown ?? '').slice(0, 4000)
  const focus = article.focus_keyword || article.target_keyword || ''
  const lsi = (article.lsi_keywords ?? []).join(', ')

  const result = streamObject({
    model: MODELS.fast,
    schema: seoSuggestionSchema,
    system: `${SEO_SUGGESTION_SYSTEM}\n\n${brandContextBlock(project, brand)}`,
    prompt: [
      `Article title: ${article.title}`,
      `Target keyword: ${article.target_keyword ?? '(none)'}`,
      `Focus keyword hint: ${focus || '(none)'}`,
      `LSI keywords: ${lsi || '(none)'}`,
      ``,
      `Article body (truncated to 4000 chars):`,
      bodyTruncated || '(empty — article has not been drafted yet)',
    ].join('\n'),
  })

  return result.toTextStreamResponse()
}
