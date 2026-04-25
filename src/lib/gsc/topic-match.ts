import 'server-only'
import { createClient } from '@/lib/supabase/server'

export function tokenizeTopic(topic: string): string[] {
  const normalized = topic.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ')
  const tokens = normalized.split(/\s+/).filter((t) => t.length > 0)
  return Array.from(new Set(tokens))
}

export type SearchDataRow = {
  query: string
  impressions: number
  clicks: number
  avg_position: number
}

export async function getSearchDataForTopic(
  projectId: string,
  topic: string,
): Promise<SearchDataRow[]> {
  const tokens = tokenizeTopic(topic)
  if (tokens.length === 0) return []

  const supabase = await createClient()
  const orClauses = tokens
    .map((t) => `query.ilike.%${t.replace(/[%_\\]/g, '')}%`)
    .join(',')

  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 90)

  const { data, error } = await supabase
    .from('gsc_query_daily')     // changed from gsc_daily_query_page
    .select('query,impressions,clicks,position')
    .eq('project_id', projectId)
    .gte('date', since.toISOString().slice(0, 10))
    .or(orClauses)

  if (error) throw error

  // Aggregate by query
  const agg = new Map<string, { impressions: number; clicks: number; positionSum: number }>()
  for (const r of data ?? []) {
    const prev = agg.get(r.query) ?? { impressions: 0, clicks: 0, positionSum: 0 }
    prev.impressions += r.impressions
    prev.clicks += r.clicks
    prev.positionSum += r.position * r.impressions
    agg.set(r.query, prev)
  }

  return Array.from(agg.entries())
    .map(([query, v]) => ({
      query,
      impressions: v.impressions,
      clicks: v.clicks,
      avg_position: v.impressions > 0 ? v.positionSum / v.impressions : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 40)
}
