'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function deleteArticleAction(projectId: string, articleId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('articles').delete().eq('id', articleId)
  if (error) throw error
  revalidatePath(`/projects/${projectId}/articles`)
  revalidatePath(`/projects/${projectId}/planning`)
}
