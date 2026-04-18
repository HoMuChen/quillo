import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { PublishPanel } from './_publish-panel'

type Props = { params: Promise<{ locale: string; projectId: string; articleId: string }> }

export default async function PublishTabPage({ params }: Props) {
  const { locale, projectId, articleId } = await params
  setRequestLocale(locale)

  const supabase = await createClient()
  const { data: article, error } = await supabase
    .from('articles')
    .select('id,status,title')
    .eq('id', articleId)
    .single()
  if (error || !article) notFound()

  const { data: connection } = await supabase
    .from('site_connections')
    .select('id,name,platform,last_tested_at,last_test_ok')
    .eq('project_id', projectId)
    .eq('platform', 'ghost')
    .maybeSingle()

  const { data: target } = connection
    ? await supabase
        .from('publish_targets')
        .select('id,remote_post_id,remote_url,remote_status,published_at,scheduled_for')
        .eq('article_id', articleId)
        .eq('connection_id', connection.id)
        .maybeSingle()
    : { data: null }

  const { data: logs } = target
    ? await supabase
        .from('publish_logs')
        .select('id,action,status,error_message,created_at')
        .eq('publish_target_id', target.id)
        .order('created_at', { ascending: false })
        .limit(10)
    : {
        data: [] as Array<{
          id: string
          action: string
          status: string
          error_message: string | null
          created_at: string
        }>,
      }

  if (!connection) {
    return <NoConnection projectId={projectId} />
  }

  return (
    <PublishPanel
      articleId={articleId}
      articleStatus={article.status}
      connection={connection}
      target={target}
      logs={logs ?? []}
      settingsHref={`/projects/${projectId}/settings`}
    />
  )
}

async function NoConnection({ projectId }: { projectId: string }) {
  const t = await getTranslations('publish')
  return (
    <div className="rounded-xl border border-rule border-dashed bg-bg/60 p-10 text-center shadow-sh-1 space-y-3">
      <p className="font-serif italic text-[20px] text-ink">{t('no_connection_title')}</p>
      <p className="text-[12px] text-ink-3">{t('no_connection_body')}</p>
      <Link href={`/projects/${projectId}/settings`}>
        <Button variant="primary">{t('no_connection_cta')}</Button>
      </Link>
    </div>
  )
}
