'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Database, Json } from '@/lib/supabase/types'

type ArticleUpdate = Database['public']['Tables']['articles']['Update']

export async function saveArticleBodyAction(
  projectId: string,
  articleId: string,
  tiptapDoc: unknown,
  bodyMarkdown: string,
) {
  const supabase = await createClient()

  const { data: article } = await supabase
    .from('articles').select('status').eq('id', articleId).single()
  if (!article) throw new Error('Not found')

  const patch: ArticleUpdate = {
    body_tiptap: tiptapDoc as Json,
    body_markdown: bodyMarkdown,
  }
  // Once the user edits, move from draft_ready → editing
  if (article.status === 'draft_ready') patch.status = 'editing'

  const { error } = await supabase.from('articles').update(patch).eq('id', articleId)
  if (error) throw error

  revalidatePath(`/projects/${projectId}/articles/${articleId}/editor`)
}
