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

  const patch: ArticleUpdate = {
    body_tiptap: tiptapDoc as Json,
    body_markdown: bodyMarkdown,
  }

  const { error } = await supabase.from('articles').update(patch).eq('id', articleId)
  if (error) throw error

  revalidatePath(`/projects/${projectId}/articles/${articleId}/editor`)
}
