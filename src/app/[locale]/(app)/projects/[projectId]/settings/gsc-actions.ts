'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { runGscSync } from '@/lib/gsc/sync'

export async function disconnectGscAction(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: proj } = await supabase
    .from('projects').select('id').eq('id', projectId).maybeSingle()
  if (!proj) throw new Error('Project not found')
  const { error } = await supabase.from('gsc_connections').delete().eq('project_id', projectId)
  if (error) {
    console.error('[gsc] disconnect failed', error)
    throw new Error('Failed to disconnect Google Search Console')
  }
  revalidatePath(`/projects/${projectId}/settings`)
}

export async function syncGscNowAction(projectId: string): Promise<{ rowsInserted: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: proj } = await supabase
    .from('projects').select('id').eq('id', projectId).maybeSingle()
  if (!proj) throw new Error('Project not found')

  // Rate limit: 1 manual run per hour per project
  const { data: lastRun } = await supabase
    .from('gsc_sync_runs')
    .select('started_at')
    .eq('project_id', projectId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastRun && Date.now() - new Date(lastRun.started_at).getTime() < 60 * 60 * 1000) {
    throw new Error('A sync ran recently. Please wait an hour before syncing again.')
  }

  const result = await runGscSync(projectId)
  revalidatePath(`/projects/${projectId}/settings`)
  return { rowsInserted: result.rowsInserted }
}
