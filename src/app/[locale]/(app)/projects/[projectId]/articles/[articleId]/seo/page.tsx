import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { SeoTab } from './_seo-tab'

type Props = { params: Promise<{ locale: string; projectId: string; articleId: string }> }

export default async function SeoTabPage({ params }: Props) {
  const { locale, projectId, articleId } = await params
  setRequestLocale(locale)

  const supabase = await createClient()
  const { data: article, error } = await supabase
    .from('articles')
    .select('meta_title,meta_description,slug,excerpt,canonical_url,focus_keyword,tags')
    .eq('id', articleId)
    .single()
  if (error || !article) notFound()

  return (
    <SeoTab
      projectId={projectId}
      articleId={articleId}
      initial={{
        meta_title: article.meta_title ?? '',
        meta_description: article.meta_description ?? '',
        slug: article.slug ?? '',
        excerpt: article.excerpt ?? '',
        canonical_url: article.canonical_url ?? '',
        focus_keyword: article.focus_keyword ?? '',
        tags: article.tags ?? [],
      }}
    />
  )
}
