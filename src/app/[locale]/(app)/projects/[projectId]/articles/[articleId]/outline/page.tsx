import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { OutlineTab } from './_outline-tab'

type Props = { params: Promise<{ locale: string; projectId: string; articleId: string }> }

export default async function OutlineTabPage({ params }: Props) {
  const { locale, projectId, articleId } = await params
  setRequestLocale(locale)

  const supabase = await createClient()
  const { data: article, error } = await supabase
    .from('articles').select('status').eq('id', articleId).single()
  if (error || !article) notFound()

  const { data: outline } = await supabase
    .from('article_outlines').select('sections').eq('article_id', articleId).maybeSingle()

  const sections = (outline?.sections ?? []) as Array<{
    id: string
    title: string
    purpose: string
    needs_interview: boolean
  }>

  return (
    <OutlineTab
      projectId={projectId}
      articleId={articleId}
      initialSections={sections}
      initialStatus={article.status}
    />
  )
}
