import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArticlesTable } from './_articles-table'

type Props = { params: Promise<{ locale: string; projectId: string }> }

export default async function ArticlesPage({ params }: Props) {
  const { locale, projectId } = await params
  setRequestLocale(locale)
  const t = await getTranslations('articles')
  const tp = await getTranslations('projects')

  const supabase = await createClient()
  const { data: project } = await supabase
    .from('projects').select('id').eq('id', projectId).single()
  if (!project) notFound()

  const { data: articles } = await supabase
    .from('articles')
    .select('id,title,target_keyword,status,updated_at,pillar_id,role,pillars(title)')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })

  const { data: pillars } = await supabase
    .from('pillars')
    .select('id,title')
    .eq('project_id', projectId)
    .order('position')

  // GSC metrics for published articles
  let gscMetrics: Record<string, { clicks: number; position: number }> = {}

  const { data: gscConn } = await supabase
    .from('gsc_connections')
    .select('last_synced_at')
    .eq('project_id', projectId)
    .maybeSingle()

  if (gscConn?.last_synced_at && (articles ?? []).length > 0) {
    const articleIds = (articles ?? []).map((a) => a.id)

    // Get normalized_url per article (most recent published target)
    const { data: targets } = await supabase
      .from('publish_targets')
      .select('article_id, normalized_url')
      .in('article_id', articleIds)
      .not('normalized_url', 'is', null)

    if (targets && targets.length > 0) {
      const urlToArticle = new Map(targets.map((t) => [t.normalized_url!, t.article_id]))
      const urls = [...urlToArticle.keys()]

      const since = new Date()
      since.setUTCDate(since.getUTCDate() - 28)

      const { data: gscRows } = await supabase
        .from('gsc_page_daily')
        .select('normalized_page_url, clicks, impressions, position')
        .eq('project_id', projectId)
        .in('normalized_page_url', urls)
        .gte('date', since.toISOString().slice(0, 10))

      // Aggregate by URL
      const urlMetrics = new Map<string, { clicks: number; impSum: number; posSum: number }>()
      for (const r of gscRows ?? []) {
        const prev = urlMetrics.get(r.normalized_page_url) ?? { clicks: 0, impSum: 0, posSum: 0 }
        prev.clicks += r.clicks
        prev.impSum += r.impressions
        prev.posSum += r.position * r.impressions
        urlMetrics.set(r.normalized_page_url, prev)
      }

      // Map back to article IDs
      for (const [url, v] of urlMetrics.entries()) {
        const articleId = urlToArticle.get(url)
        if (articleId) {
          gscMetrics[articleId] = {
            clicks: v.clicks,
            position: v.impSum > 0 ? v.posSum / v.impSum : 0,
          }
        }
      }
    }
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <header className="flex items-start justify-between gap-4">
        <h1 className="font-serif italic text-[32px] text-ink leading-tight">{tp('nav_articles')}</h1>
        <Link href={`/projects/${projectId}/planning`}>
          <Button variant="default">{t('articles_back_to_planning')}</Button>
        </Link>
      </header>

      {(articles ?? []).length === 0 ? (
        <div className="rounded-xl border border-rule border-dashed bg-bg/60 p-10 text-center shadow-sh-1 space-y-3">
          <p className="font-serif italic text-[20px] text-ink">{t('articles_empty_title')}</p>
          <p className="text-[12px] text-ink-3">{t('articles_empty_body')}</p>
          <Link href={`/projects/${projectId}/planning/new`}>
            <Button variant="primary" size="lg">✦ {t('articles_empty_cta')}</Button>
          </Link>
        </div>
      ) : (
        <ArticlesTable
          projectId={projectId}
          articles={(articles ?? []).map((a) => ({
            id: a.id,
            title: a.title,
            target_keyword: a.target_keyword,
            status: a.status,
            updated_at: a.updated_at,
            pillar_id: a.pillar_id,
            role: a.role,
            pillar_title: (a.pillars as { title: string } | null)?.title ?? null,
          }))}
          pillars={pillars ?? []}
          gscMetrics={gscMetrics}
        />
      )}
    </div>
  )
}
