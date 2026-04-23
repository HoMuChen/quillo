import 'server-only'
import { createClient } from '@/lib/supabase/server'

export const DEFAULT_WINDOW = 28

export async function getStrikingDistance(projectId: string, windowDays = DEFAULT_WINDOW) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('gsc_striking_distance', {
    p_project: projectId, p_window_days: windowDays,
  })
  if (error) throw error
  return data ?? []
}

export async function getRisingQueries(projectId: string, windowDays = DEFAULT_WINDOW) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('gsc_rising_queries', {
    p_project: projectId, p_window_days: windowDays,
  })
  if (error) throw error
  return data ?? []
}

export async function getDecayingPages(projectId: string, windowDays = DEFAULT_WINDOW) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('gsc_decaying_pages', {
    p_project: projectId, p_window_days: windowDays,
  })
  if (error) throw error
  return data ?? []
}
