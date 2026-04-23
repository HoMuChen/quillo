import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'

type Props = {
  projectId: string
  articleId: string
  rangeDays?: number
}

export async function PerformanceTab({ projectId, articleId, rangeDays = 28 }: Props) {
  const t = await getTranslations('articles')
  const supabase = await createClient()

  // 1. Check GSC connection exists
  const { data: gscConn } = await supabase
    .from('gsc_connections')
    .select('last_synced_at')
    .eq('project_id', projectId)
    .maybeSingle()

  if (!gscConn) {
    return <EmptyState>{t('perf_no_connection')}</EmptyState>
  }

  // 2. Find the most-recently-published URL for this article
  const { data: target } = await supabase
    .from('publish_targets')
    .select('normalized_url, remote_url')
    .eq('article_id', articleId)
    .not('remote_url', 'is', null)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!target?.normalized_url) {
    return <EmptyState>{t('perf_not_published')}</EmptyState>
  }

  const normalizedUrl = target.normalized_url

  // 3. Query current + previous period from gsc_daily_query_page
  const today = new Date()
  const periodStart = new Date(today); periodStart.setUTCDate(today.getUTCDate() - rangeDays)
  const prevStart = new Date(periodStart); prevStart.setUTCDate(periodStart.getUTCDate() - rangeDays)

  const toDateStr = (d: Date) => d.toISOString().slice(0, 10)

  const [{ data: curRows }, { data: prevRows }] = await Promise.all([
    supabase
      .from('gsc_daily_query_page')
      .select('clicks, impressions, ctr, position, query')
      .eq('project_id', projectId)
      .eq('normalized_page_url', normalizedUrl)
      .gte('date', toDateStr(periodStart))
      .lt('date', toDateStr(today)),
    supabase
      .from('gsc_daily_query_page')
      .select('clicks, impressions')
      .eq('project_id', projectId)
      .eq('normalized_page_url', normalizedUrl)
      .gte('date', toDateStr(prevStart))
      .lt('date', toDateStr(periodStart)),
  ])

  if (!curRows || curRows.length === 0) {
    return (
      <EmptyState>
        {t('perf_no_data')}
        <p className="text-[11px] font-mono text-ink-4 mt-1">{t('perf_url_hint', { url: normalizedUrl })}</p>
      </EmptyState>
    )
  }

  // 4. Aggregate current period
  const totalClicks = curRows.reduce((s, r) => s + r.clicks, 0)
  const totalImpressions = curRows.reduce((s, r) => s + r.impressions, 0)
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0
  const weightedPos = curRows.reduce((s, r) => s + r.position * r.impressions, 0)
  const avgPosition = totalImpressions > 0 ? weightedPos / totalImpressions : 0

  // 5. Aggregate previous period for deltas
  const prevClicks = (prevRows ?? []).reduce((s, r) => s + r.clicks, 0)
  const prevImpressions = (prevRows ?? []).reduce((s, r) => s + r.impressions, 0)

  function delta(cur: number, prev: number): string | null {
    if (prev === 0) return null
    const pct = Math.round(((cur - prev) / prev) * 100)
    return pct >= 0 ? `+${pct}%` : `${pct}%`
  }

  // 6. Top 20 queries by clicks
  const queryMap = new Map<string, { clicks: number; impressions: number; ctrSum: number; posSum: number; count: number }>()
  for (const r of curRows) {
    const prev = queryMap.get(r.query) ?? { clicks: 0, impressions: 0, ctrSum: 0, posSum: 0, count: 0 }
    prev.clicks += r.clicks
    prev.impressions += r.impressions
    prev.posSum += r.position * r.impressions
    prev.count++
    queryMap.set(r.query, prev)
  }
  const topQueries = Array.from(queryMap.entries())
    .map(([query, v]) => ({
      query,
      clicks: v.clicks,
      impressions: v.impressions,
      avgPosition: v.impressions > 0 ? v.posSum / v.impressions : 0,
      ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 20)

  return (
    <div className="space-y-8">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Tile label={t('perf_clicks')} value={totalClicks.toLocaleString()} delta={delta(totalClicks, prevClicks)} />
        <Tile label={t('perf_impressions')} value={totalImpressions.toLocaleString()} delta={delta(totalImpressions, prevImpressions)} />
        <Tile label={t('perf_ctr')} value={`${(avgCtr * 100).toFixed(1)}%`} />
        <Tile label={t('perf_position')} value={avgPosition.toFixed(1)} />
      </div>

      {/* Top queries table */}
      {topQueries.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-sans font-semibold text-[16px] text-ink tracking-tight">{t('perf_top_queries')}</h2>
          <div className="rounded-xl bg-white shadow-sh-1 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-rule text-left">
                  <th className="px-4 py-2.5 font-medium text-ink-3">{t('perf_col_query')}</th>
                  <th className="px-4 py-2.5 font-medium text-ink-3 text-right">{t('perf_col_clicks')}</th>
                  <th className="px-4 py-2.5 font-medium text-ink-3 text-right">{t('perf_col_impressions')}</th>
                  <th className="px-4 py-2.5 font-medium text-ink-3 text-right">{t('perf_col_position')}</th>
                </tr>
              </thead>
              <tbody>
                {topQueries.map((row, i) => (
                  <tr key={i} className="border-b border-rule last:border-0 hover:bg-mist transition-colors">
                    <td className="px-4 py-2.5 text-ink max-w-[280px] truncate">{row.query}</td>
                    <td className="px-4 py-2.5 text-ink-2 text-right">{row.clicks.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-ink-2 text-right">{row.impressions.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-ink-2 text-right">{row.avgPosition.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function Tile({ label, value, delta }: { label: string; value: string; delta?: string | null }) {
  const positive = delta?.startsWith('+')
  return (
    <div className="rounded-xl bg-white shadow-sh-1 p-4 space-y-1">
      <div className="text-[11px] text-ink-3 uppercase tracking-[0.08em]">{label}</div>
      <div className="font-serif italic text-[28px] text-ink leading-none">{value}</div>
      {delta && (
        <div className={`text-[11px] font-medium ${positive ? 'text-sage' : 'text-rust'}`}>{delta}</div>
      )}
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-rule bg-bg/60 p-10 text-center">
      <p className="text-[13px] text-ink-3">{children}</p>
    </div>
  )
}
