'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { outlineSchema } from '@/lib/ai/schemas'

export async function saveOutlineAction(
  projectId: string,
  articleId: string,
  sections: z.infer<typeof outlineSchema>['sections'],
) {
  const parsed = outlineSchema.parse({ sections })

  const supabase = await createClient()

  const { data: article } = await supabase
    .from('articles')
    .select('status, tenant_id')
    .eq('id', articleId)
    .single()
  if (!article) throw new Error('Article not found')

  const { error } = await supabase
    .from('article_outlines')
    .upsert({ article_id: articleId, tenant_id: article.tenant_id, sections: parsed.sections })
  if (error) throw error

  // Ensure status is at least outline_ready
  if (article.status === 'planned') {
    await supabase.from('articles').update({ status: 'outline_ready' }).eq('id', articleId)
  }

  revalidatePath(`/projects/${projectId}/articles/${articleId}/outline`)
}
