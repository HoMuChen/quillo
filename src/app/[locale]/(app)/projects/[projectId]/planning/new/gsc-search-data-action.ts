'use server'

import { createClient } from '@/lib/supabase/server'
import { getSearchDataForTopic } from '@/lib/gsc/topic-match'

export async function fetchGscSearchDataAction(projectId: string, topic: string) {
  const supabase = await createClient()
  const { data: conn } = await supabase
    .from('gsc_connections')
    .select('last_synced_at')
    .eq('project_id', projectId)
    .maybeSingle()
  // Only inject if GSC is connected AND has been synced at least once
  if (!conn || !conn.last_synced_at) return []
  return getSearchDataForTopic(projectId, topic)
}
