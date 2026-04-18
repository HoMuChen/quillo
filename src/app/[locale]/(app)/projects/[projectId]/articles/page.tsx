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

  return (
    <div className="space-y-5 max-w-5xl">
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
        />
      )}
    </div>
  )
}
