import { streamObject } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MODELS } from '@/lib/ai/gateway'
import { analyzeBrandSchema } from '@/lib/ai/schemas'

export const runtime = 'nodejs'
export const maxDuration = 120

const bodySchema = z.object({
  projectId: z.string().uuid(),
  articleIds: z.array(z.string().uuid()).min(1).max(20),
})

function extractText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as { type?: string; text?: string; content?: unknown[] }
  if (n.type === 'hardBreak') return '\n'
  if (typeof n.text === 'string') return n.text
  if (!Array.isArray(n.content)) return ''
  const children = n.content.map(extractText).join('')
  if (['paragraph', 'heading', 'blockquote', 'listItem'].includes(n.type ?? '')) return children + '\n'
  return children
}

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad request', { status: 400 })
  const { projectId, articleIds } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: project } = await supabase
    .from('projects').select('id').eq('id', projectId).single()
  if (!project) return new Response('Not found', { status: 404 })

  const { data: articles } = await supabase
    .from('articles')
    .select('title, target_keyword, body_tiptap, body_markdown')
    .in('id', articleIds)
    .eq('project_id', projectId)

  if (!articles?.length) return new Response('No articles', { status: 400 })

  const corpus = articles
    .map((a) => {
      const body = a.body_tiptap
        ? extractText(a.body_tiptap).trim()
        : (a.body_markdown ?? '').trim()
      return `# ${a.title}\n\n${body}`
    })
    .join('\n\n---\n\n')
    .slice(0, 80000)

  const result = streamObject({
    model: MODELS.main,
    schema: analyzeBrandSchema,
    system: `You are a brand voice analyst. Extract brand characteristics from the provided articles.
Be concise and specific. Respond in the same language the articles are written in.
- tone: describe the writing style and voice in 1–2 sentences
- author_background: infer the author's expertise and background from the content
- reader_persona: describe the intended reader based on assumptions made in the writing
- preferred_terms: recurring phrases or vocabulary the author uses (max 10)
- forbidden_terms: terms that clash with the observed tone or seem out of place (max 5); leave empty if unclear
- ee_at_cases: specific case studies, numbers, or first-hand examples that demonstrate expertise`,
    prompt: `Analyze these articles:\n\n${corpus}`,
  })

  return result.toTextStreamResponse()
}
