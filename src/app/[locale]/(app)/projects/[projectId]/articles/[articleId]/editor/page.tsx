import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { EditorTab } from './_editor-tab'

type Props = { params: Promise<{ locale: string; projectId: string; articleId: string }> }

export default async function EditorTabPage({ params }: Props) {
  const { locale, projectId, articleId } = await params
  setRequestLocale(locale)

  const supabase = await createClient()
  const { data: article, error } = await supabase
    .from('articles')
    .select('id,status,body_markdown,body_tiptap')
    .eq('id', articleId)
    .single()
  if (error || !article) notFound()

  return (
    <EditorTab
      projectId={projectId}
      articleId={articleId}
      status={article.status}
      bodyMarkdown={article.body_markdown}
      bodyTiptap={article.body_tiptap}
    />
  )
}
