import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { InterviewTab } from './_interview-tab'

type Props = { params: Promise<{ locale: string; projectId: string; articleId: string }> }

export default async function InterviewTabPage({ params }: Props) {
  const { locale, projectId, articleId } = await params
  setRequestLocale(locale)

  const supabase = await createClient()
  const { data: article, error } = await supabase
    .from('articles').select('status').eq('id', articleId).single()
  if (error || !article) notFound()

  const { data: outline } = await supabase
    .from('article_outlines').select('sections').eq('article_id', articleId).maybeSingle()

  const { data: questions } = await supabase
    .from('interview_questions')
    .select('id,section_id,question,answer,status,position')
    .eq('article_id', articleId)
    .order('position')

  const sections = (outline?.sections ?? []) as Array<{
    id: string; title: string; purpose: string; needs_interview: boolean
  }>

  return (
    <InterviewTab
      projectId={projectId}
      articleId={articleId}
      status={article.status}
      sections={sections}
      questions={(questions ?? []) as Array<{
        id: string
        section_id: string
        question: string
        answer: string | null
        status: 'pending' | 'answered' | 'skipped'
        position: number
      }>}
    />
  )
}
