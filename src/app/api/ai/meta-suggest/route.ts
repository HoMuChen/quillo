import { streamObject } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MODELS } from '@/lib/ai/gateway'
import { META_SYSTEM, brandContextBlock } from '@/lib/ai/prompts'
import { metaSchema } from '@/lib/ai/schemas'

export const runtime = 'nodejs'
export const maxDuration = 60

const bodySchema = z.object({ articleId: z.string().uuid() })

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad request', { status: 400 })

  const supabase = await createClient()
  const { data: article } = await supabase
    .from('articles')
    .select('title,target_keyword,focus_keyword,body_markdown,project_id')
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

  const result = streamObject({
    model: MODELS.fast,
    schema: metaSchema,
    system: `${META_SYSTEM}\n\n${brandContextBlock(project, brand)}`,
    prompt: `Article title: ${article.title}\nFocus keyword: ${focus}\n\nArticle body (truncated):\n${bodyTruncated}`,
  })

  return result.toTextStreamResponse()
}
