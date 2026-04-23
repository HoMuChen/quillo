import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { Link } from '@/i18n/routing'
import {
  getStrikingDistance,
  getRisingQueries,
  getDecayingPages,
} from '@/lib/gsc/opportunities'

type Props = { params: Promise<{ locale: string; projectId: string }> }

export default async function OpportunitiesPage({ params }: Props) {
  const { locale, projectId } = await params
  setRequestLocale(locale)
  const t = await getTranslations('opportunities')

  const supabase = await createClient()
  const { data: project } = await supabase
    .from('projects').select('id').eq('id', projectId).maybeSingle()
  if (!project) notFound()

  // Check if GSC is connected
  const { data: gscConn } = await supabase
    .from('gsc_connections')
    .select('last_synced_at')
    .eq('project_id', projectId)
    .maybeSingle()

  if (!gscConn) {
    return (
      <div className="space-y-5 max-w-4xl">
        <header>
          <h1 className="font-serif italic text-[32px] text-ink leading-tight">{t('title')}</h1>
        </header>
        <div className="rounded-xl border border-dashed border-rule bg-bg/60 p-10 text-center space-y-3">
          <p className="text-[13px] text-ink-3">{t('no_connection')}</p>
          <Link href={`/projects/${projectId}/settings`} className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-[13px] font-medium text-bg hover:bg-ink-2 transition-colors">
            {t('no_connection_cta')}
          </Link>
        </div>
      </div>
    )
  }

  // Fetch all three opportunity lists in parallel
  const [striking, rising, decaying] = await Promise.all([
    getStrikingDistance(projectId).catch(() => []),
    getRisingQueries(projectId).catch(() => []),
    getDecayingPages(projectId).catch(() => []),
  ])

  const hasAnyData = striking.length + rising.length + decaying.length > 0
  const hasSyncData = gscConn.last_synced_at !== null

  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <h1 className="font-serif italic text-[32px] text-ink leading-tight">{t('title')}</h1>
      </header>

      {!hasSyncData || !hasAnyData ? (
        <div className="rounded-xl border border-dashed border-rule bg-bg/60 p-10 text-center">
          <p className="text-[13px] text-ink-3">{t('no_data')}</p>
        </div>
      ) : (
        <>
          {/* Striking distance */}
          <section className="space-y-3">
            <div>
              <h2 className="font-sans font-semibold text-[18px] text-ink tracking-tight">{t('striking_title')}</h2>
              <p className="text-[12px] text-ink-3 mt-0.5">{t('striking_help')}</p>
            </div>
            {striking.length === 0 ? (
              <p className="text-[12px] text-ink-4">{t('section_empty')}</p>
            ) : (
              <div className="rounded-xl bg-white shadow-sh-1 overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-rule text-left">
                      <th className="px-4 py-2.5 font-medium text-ink-3">{t('col_query')}</th>
                      <th className="px-4 py-2.5 font-medium text-ink-3 text-right">{t('col_impressions')}</th>
                      <th className="px-4 py-2.5 font-medium text-ink-3 text-right">{t('col_position')}</th>
                      <th className="px-4 py-2.5 font-medium text-ink-3 text-right">{t('col_clicks')}</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {striking.map((row, i) => (
                      <tr key={i} className="border-b border-rule last:border-0 hover:bg-mist/40 transition-colors">
                        <td className="px-4 py-2.5 text-ink font-medium max-w-[240px] truncate">{row.query}</td>
                        <td className="px-4 py-2.5 text-ink-2 text-right">{Number(row.impressions).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-ink-2 text-right">{Number(row.avg_position).toFixed(1)}</td>
                        <td className="px-4 py-2.5 text-ink-2 text-right">{Number(row.clicks).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right">
                          {row.matching_article_id && (
                            <Link href={`/projects/${projectId}/articles/${row.matching_article_id}/editor`} className="text-[12px] text-ink-3 hover:text-ink underline transition-colors">
                              {t('open_article')}
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Rising queries */}
          <section className="space-y-3">
            <div>
              <h2 className="font-sans font-semibold text-[18px] text-ink tracking-tight">{t('rising_title')}</h2>
              <p className="text-[12px] text-ink-3 mt-0.5">{t('rising_help')}</p>
            </div>
            {rising.length === 0 ? (
              <p className="text-[12px] text-ink-4">{t('section_empty')}</p>
            ) : (
              <div className="rounded-xl bg-white shadow-sh-1 overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-rule text-left">
                      <th className="px-4 py-2.5 font-medium text-ink-3">{t('col_query')}</th>
                      <th className="px-4 py-2.5 font-medium text-ink-3 text-right">{t('col_current')}</th>
                      <th className="px-4 py-2.5 font-medium text-ink-3 text-right">{t('col_previous')}</th>
                      <th className="px-4 py-2.5 font-medium text-ink-3 text-right">{t('col_growth')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rising.map((row, i) => (
                      <tr key={i} className="border-b border-rule last:border-0 hover:bg-mist/40 transition-colors">
                        <td className="px-4 py-2.5 text-ink font-medium max-w-[300px] truncate">{row.query}</td>
                        <td className="px-4 py-2.5 text-ink-2 text-right">{Number(row.current_impressions).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-ink-2 text-right">{Number(row.previous_impressions).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-sage font-medium text-right">+{Number(row.growth).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Decaying pages */}
          <section className="space-y-3">
            <div>
              <h2 className="font-sans font-semibold text-[18px] text-ink tracking-tight">{t('decaying_title')}</h2>
              <p className="text-[12px] text-ink-3 mt-0.5">{t('decaying_help')}</p>
            </div>
            {decaying.length === 0 ? (
              <p className="text-[12px] text-ink-4">{t('section_empty')}</p>
            ) : (
              <div className="rounded-xl bg-white shadow-sh-1 overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-rule text-left">
                      <th className="px-4 py-2.5 font-medium text-ink-3">{t('col_page')}</th>
                      <th className="px-4 py-2.5 font-medium text-ink-3 text-right">{t('col_current')}</th>
                      <th className="px-4 py-2.5 font-medium text-ink-3 text-right">{t('col_previous')}</th>
                      <th className="px-4 py-2.5 font-medium text-ink-3 text-right">{t('col_decline')}</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {decaying.map((row, i) => (
                      <tr key={i} className="border-b border-rule last:border-0 hover:bg-mist/40 transition-colors">
                        <td className="px-4 py-2.5 text-ink-2 max-w-[240px] truncate text-[11px] font-mono">{row.normalized_page_url}</td>
                        <td className="px-4 py-2.5 text-ink-2 text-right">{Number(row.current_clicks).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-ink-2 text-right">{Number(row.previous_clicks).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-rust font-medium text-right">−{(Number(row.decline_pct) * 100).toFixed(0)}%</td>
                        <td className="px-4 py-2.5 text-right">
                          {row.matching_article_id && (
                            <Link href={`/projects/${projectId}/articles/${row.matching_article_id}/editor`} className="text-[12px] text-ink-3 hover:text-ink underline transition-colors">
                              {t('open_article')}
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
