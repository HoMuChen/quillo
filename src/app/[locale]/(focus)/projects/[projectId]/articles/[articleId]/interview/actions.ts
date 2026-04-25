'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { throwIfError } from '@/lib/supabase/helpers'
import type { ArticleStatus } from '@/lib/article'

export async function answerQuestionAction(
  projectId: string,
  articleId: string,
  questionId: string,
  answer: string,
) {
  const supabase = await createClient()
  const status = answer.trim().length > 0 ? 'answered' : 'pending'
  throwIfError(
    await supabase
      .from('interview_questions')
      .update({ answer: answer.trim() || null, status })
      .eq('id', questionId),
  )
  revalidatePath(`/projects/${projectId}/articles/${articleId}/interview`)
}

export async function skipQuestionAction(
  projectId: string,
  articleId: string,
  questionId: string,
) {
  const supabase = await createClient()
  throwIfError(
    await supabase
      .from('interview_questions')
      .update({ status: 'skipped', answer: null })
      .eq('id', questionId),
  )
  revalidatePath(`/projects/${projectId}/articles/${articleId}/interview`)
}

export async function skipAllAction(projectId: string, articleId: string) {
  const supabase = await createClient()
  throwIfError(
    await supabase
      .from('interview_questions')
      .update({ status: 'skipped' })
      .eq('article_id', articleId)
      .eq('status', 'pending'),
  )
  revalidatePath(`/projects/${projectId}/articles/${articleId}/interview`)
}

export async function startManualDraftAction(projectId: string, articleId: string) {
  const supabase = await createClient()
  const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] }
  throwIfError(
    await supabase
      .from('articles')
      .update({ body_tiptap: emptyDoc, body_markdown: '', status: 'editing' satisfies ArticleStatus })
      .eq('id', articleId),
  )
  revalidatePath(`/projects/${projectId}/articles/${articleId}`)
}
