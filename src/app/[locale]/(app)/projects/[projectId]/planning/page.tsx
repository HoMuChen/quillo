import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { PlanningGraph } from './_graph'
import { SyncGhostButton } from './_sync-button'

type Props = { params: Promise<{ locale: string; projectId: string }> }

type OrphanArticle = {
  id: string
  title: string
  target_keyword: string | null
  slug: string | null
  tags: string[]
  status: string
  source: string
}

export default async function PlanningPage({ params }: Props) {
  const { locale, projectId } = await params
  setRequestLocale(locale)
  const t = await getTranslations('planning')
  const tp = await getTranslations('projects')

  const supabase = await createClient()
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single()
  if (projectError || !project) notFound()

  const [{ data: pillars }, { data: ghostConn }, { data: orphanArticlesRaw }] =
    await Promise.all([
      supabase
        .from('pillars')
        .select('id,title,description,target_keyword,search_intent,position')
        .eq('project_id', projectId)
        .order('position'),
      supabase
        .from('site_connections')
        .select('id')
        .eq('project_id', projectId)
        .eq('platform', 'ghost')
        .maybeSingle(),
      supabase
        .from('articles')
        .select('id,title,target_keyword,slug,tags,status,source')
        .eq('project_id', projectId)
        .is('pillar_id', null)
        .order('created_at', { ascending: false }),
    ])
  const orphanArticles = (orphanArticlesRaw ?? []) as OrphanArticle[]

  const pillarIds = (pillars ?? []).map((p) => p.id)
  const { data: articles } = pillarIds.length
    ? await supabase
        .from('articles')
        .select('id,title,target_keyword,search_intent,role,status,position,pillar_id')
        .in('pillar_id', pillarIds)
        .order('position')
    : { data: [] as Array<{
        id: string
        title: string
        target_keyword: string | null
        search_intent: string | null
        role: string | null
        status: string
        position: number
        pillar_id: string | null
      }> }

  const articleIds = (articles ?? []).map((a) => a.id)
  const { data: publishTargets } = articleIds.length
    ? await supabase
        .from('publish_targets')
        .select('article_id,remote_status')
        .in('article_id', articleIds)
    : { data: [] as Array<{ article_id: string; remote_status: string | null }> }

  const hasPillars = (pillars ?? []).length > 0

  if (!hasPillars && orphanArticles.length === 0) {
    return (
      <div className="space-y-6">
        <header className="flex items-start justify-between gap-6">
          <h1 className="font-serif italic text-[32px] text-ink leading-tight">
            {tp('nav_planning')}
          </h1>
          <div className="flex items-center gap-3">
            {ghostConn && <SyncGhostButton projectId={projectId} />}
            <Link href={`/projects/${projectId}/planning/new`}>
              <Button variant="default">{t('plan_new_button')}</Button>
            </Link>
          </div>
        </header>
        <div className="rounded-xl border border-rule border-dashed bg-bg/60 p-10 text-center shadow-sh-1 space-y-4">
          <p className="font-serif italic text-[22px] text-ink">{t('empty_title')}</p>
          <p className="text-[13px] text-ink-3 max-w-md mx-auto">{t('empty_body')}</p>
          <Link href={`/projects/${projectId}/planning/new`} className="inline-block">
            <Button variant="primary" size="lg">
              ✦ {t('empty_cta')}
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-6">
        <h1 className="font-serif italic text-[32px] text-ink leading-tight">
          {tp('nav_planning')}
        </h1>
        <div className="flex items-center gap-3">
          {ghostConn && <SyncGhostButton projectId={projectId} />}
          <Link href={`/projects/${projectId}/planning/new`}>
            <Button variant="default">{t('plan_new_button')}</Button>
          </Link>
        </div>
      </header>
      <PlanningGraph
        projectId={projectId}
        pillars={pillars ?? []}
        articles={articles ?? []}
        publishTargets={publishTargets ?? []}
        orphanArticles={orphanArticles}
        hasGhostConnection={!!ghostConn}
      />
    </div>
  )
}
