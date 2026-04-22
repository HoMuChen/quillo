'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function sb() { return createClient() }

export async function answerQuestionAction(
  projectId: string,
  articleId: string,
  questionId: string,
  answer: string,
) {
  const supabase = await sb()
  const status = answer.trim().length > 0 ? 'answered' : 'pending'
  const { error } = await supabase
    .from('interview_questions')
    .update({ answer: answer.trim() || null, status })
    .eq('id', questionId)
  if (error) throw error
  revalidatePath(`/projects/${projectId}/articles/${articleId}/interview`)
}

export async function skipQuestionAction(
  projectId: string,
  articleId: string,
  questionId: string,
) {
  const supabase = await sb()
  const { error } = await supabase
    .from('interview_questions')
    .update({ status: 'skipped', answer: null })
    .eq('id', questionId)
  if (error) throw error
  revalidatePath(`/projects/${projectId}/articles/${articleId}/interview`)
}

export async function skipAllAction(projectId: string, articleId: string) {
  const supabase = await sb()
  const { error } = await supabase
    .from('interview_questions')
    .update({ status: 'skipped' })
    .eq('article_id', articleId)
    .eq('status', 'pending')
  if (error) throw error
  revalidatePath(`/projects/${projectId}/articles/${articleId}/interview`)
}

export async function startManualDraftAction(projectId: string, articleId: string) {
  const supabase = await sb()
  const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] }
  const { error } = await supabase
    .from('articles')
    .update({
      body_tiptap: emptyDoc,
      body_markdown: '',
      status: 'editing',
    })
    .eq('id', articleId)
  if (error) throw error
  revalidatePath(`/projects/${projectId}/articles/${articleId}`)
}
