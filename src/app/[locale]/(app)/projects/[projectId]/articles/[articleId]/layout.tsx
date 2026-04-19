import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/server'
import { ArticleTabs } from './_tabs'
import { FeatureImage } from './_feature-image'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string; projectId: string; articleId: string }>
}

export default async function ArticleLayout({ children, params }: Props) {
  const { locale, projectId, articleId } = await params
  setRequestLocale(locale)
  const t = await getTranslations('articles')
  const tp = await getTranslations('planning')

  const supabase = await createClient()
  const { data: article, error } = await supabase
    .from('articles')
    .select('id,title,status,pillar_id,target_keyword,word_count_target,role,feature_image_url,pillars(title)')
    .eq('id', articleId)
    .single()

  if (error || !article) notFound()

  // Flatten pillar from .pillars embed
  const pillarTitle = (article.pillars as { title: string } | null)?.title ?? null

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="space-y-2">
        <Link
          href={`/projects/${projectId}/planning`}
          className="inline-block text-[11px] uppercase tracking-[0.14em] text-ink-4 hover:text-ink-2 transition-colors"
        >
          ← {t('back_to_planning')}
        </Link>
        {pillarTitle && (
          <div className="text-[12px] text-ink-3">
            <span className="text-ink-4">{tp('pillar_label')}</span> · {pillarTitle}
          </div>
        )}
        <h1 className="font-serif italic text-[36px] text-ink leading-tight">{article.title}</h1>
        <div className="flex items-center gap-3 text-[12px] text-ink-3">
          {article.target_keyword && <span className="font-mono">{article.target_keyword}</span>}
          {article.word_count_target && <span>·  {article.word_count_target} {t('words')}</span>}
          {article.role && <span>·  {article.role}</span>}
        </div>
      </header>

      <FeatureImage
        projectId={projectId}
        articleId={articleId}
        featureImageUrl={article.feature_image_url}
      />

      <ArticleTabs projectId={projectId} articleId={articleId} status={article.status} />

      <div>{children}</div>
    </div>
  )
}
