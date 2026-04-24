import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { normalizeUrl } from '@/lib/url/normalize'
import { getGscAccessToken } from './auth'
import { querySearchAnalytics, type SearchAnalyticsRow } from './client'

const ROW_LIMIT = 25000
// Rows per sync run cap. The actual stored count may exceed this by up to ROW_LIMIT-1
// because rows are counted after each batch is upserted. Intentional: prevents runaway
// API fetches, not runaway storage — the overshoot is bounded and acceptable.
const MAX_ROWS_PER_RUN = 100_000

export function computeSyncWindow(
  lastSyncedAt: string | null,
  today: Date,
  coldStartDays = 90,
): { startDate: string; endDate: string } {
  const end = new Date(today); end.setUTCDate(end.getUTCDate() - 1)
  const coldStart = new Date(today); coldStart.setUTCDate(coldStart.getUTCDate() - coldStartDays)
  let start: Date
  if (!lastSyncedAt) {
    start = coldStart
  } else {
    const warm = new Date(lastSyncedAt); warm.setUTCDate(warm.getUTCDate() - 3)
    start = warm < coldStart ? coldStart : warm
  }
  return { startDate: toIsoDate(start), endDate: toIsoDate(end) }
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export async function runGscSync(projectId: string, coldStartDays = 90): Promise<{
  rowsInserted: number; status: 'ok' | 'partial' | 'error'
}> {
  const supabase = await createClient()

  const { data: conn, error } = await supabase
    .from('gsc_connections')
    .select('id, tenant_id, property_url, last_synced_at')
    .eq('project_id', projectId)
    .single()
  if (error || !conn) throw new Error('no gsc connection')

  const { data: runStart } = await supabase
    .from('gsc_sync_runs')
    .insert({
      project_id: projectId,
      tenant_id: conn.tenant_id,
      status: 'error', // placeholder — updated on completion; absent finished_at = process crashed
    })
    .select('id')
    .single()
  const runId = runStart?.id

  const window = computeSyncWindow(conn.last_synced_at, new Date(), coldStartDays)

  let rowsInserted = 0
  let status: 'ok' | 'partial' | 'error' = 'ok'
  let errorMsg: string | null = null

  // Partial-sync safety: if an upsert throws on page N, pages 1..N-1 are already
  // committed. last_synced_at won't advance (error path), so the next run re-pulls
  // the full overlap window and re-upserts the earlier pages safely via ON CONFLICT.
  try {
    const accessToken = await getGscAccessToken(projectId)

    let startRow = 0
    while (rowsInserted < MAX_ROWS_PER_RUN) {
      const { rows } = await querySearchAnalytics(accessToken, conn.property_url, {
        startDate: window.startDate, endDate: window.endDate,
        rowLimit: ROW_LIMIT, startRow,
      })
      if (rows.length === 0) break

      // Deduplicate by the normalized PK before upserting.
      // Two GSC page_url values may normalize to the same string (e.g. trailing slash),
      // which would cause "ON CONFLICT DO UPDATE command cannot affect row a second time".
      type UpsertRow = {
        project_id: string; tenant_id: string; date: string; query: string
        page_url: string; clicks: number; impressions: number; ctr: number; position: number
      }
      const deduped = new Map<string, UpsertRow>()
      const upsertRows: UpsertRow[] = []
      for (const r of rows) {
        const normUrl = normalizeUrl(r.page) ?? r.page
        const key = `${r.date}|${r.query}|${normUrl}`
        const existing = deduped.get(key)
        if (existing) {
          // Merge: sum clicks/impressions, weighted-average position and ctr
          const totalImp = existing.impressions + r.impressions
          existing.clicks += r.clicks
          existing.position = totalImp > 0
            ? (existing.position * existing.impressions + r.position * r.impressions) / totalImp
            : existing.position
          existing.ctr = totalImp > 0
            ? (existing.ctr * existing.impressions + r.ctr * r.impressions) / totalImp
            : existing.ctr
          existing.impressions = totalImp
        } else {
          const row: UpsertRow = {
            project_id: projectId,
            tenant_id: conn.tenant_id,
            date: r.date,
            query: r.query,
            page_url: r.page,
            clicks: r.clicks,
            impressions: r.impressions,
            ctr: r.ctr,
            position: r.position,
          }
          deduped.set(key, row)
          upsertRows.push(row)
        }
      }

      const { error: upsertErr } = await supabase
        .from('gsc_daily_query_page')
        .upsert(upsertRows, { onConflict: 'project_id,date,query,normalized_page_url' })
      if (upsertErr) throw new Error(`upsert failed: ${upsertErr.message}`)

      rowsInserted += upsertRows.length
      if (rows.length < ROW_LIMIT) break
      startRow += ROW_LIMIT
    }

    if (rowsInserted >= MAX_ROWS_PER_RUN) status = 'partial'
  } catch (err) {
    status = 'error'
    errorMsg = err instanceof Error ? err.message : String(err)
  }

  await supabase
    .from('gsc_connections')
    .update({
      ...(status !== 'error' && { last_synced_at: new Date().toISOString() }),
      last_sync_status: status,
      last_sync_error: errorMsg,
    })
    .eq('id', conn.id)

  if (runId) {
    await supabase
      .from('gsc_sync_runs')
      .update({
        finished_at: new Date().toISOString(),
        rows_inserted: rowsInserted,
        status,
        error: errorMsg,
      })
      .eq('id', runId)
  }

  if (status === 'error' && errorMsg) throw new Error(errorMsg)
  return { rowsInserted, status }
}
