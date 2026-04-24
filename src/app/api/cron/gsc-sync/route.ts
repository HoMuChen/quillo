import { adminClient } from '@/lib/supabase/admin'
import { runGscSync } from '@/lib/gsc/sync'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('forbidden', { status: 403 })
  }

  const url = new URL(req.url)
  const daysParam = url.searchParams.get('days')
  const coldStartDays = daysParam ? Math.min(Math.max(parseInt(daysParam, 10) || 90, 1), 480) : 90

  const supabase = adminClient()
  const { data: conns } = await supabase
    .from('gsc_connections')
    .select('project_id')
    .neq('last_sync_error', 'refresh_token_revoked')

  const results: Array<{ projectId: string; ok: boolean; rows?: number; error?: string }> = []
  for (const { project_id } of conns ?? []) {
    try {
      const r = await runGscSync(project_id, coldStartDays)
      results.push({ projectId: project_id, ok: true, rows: r.rowsInserted })
    } catch (err) {
      results.push({ projectId: project_id, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return Response.json({ ran: results.length, results })
}
