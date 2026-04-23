import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { encryptJson, decryptJson, toBytea, fromBytea } from '@/lib/crypto/encrypt'
import { refreshAccessToken, InvalidGrantError } from './client'

const REFRESH_BUFFER_MS = 5 * 60 * 1000

/**
 * Returns a valid access token for the given project, refreshing if needed.
 * On refresh_token_revoked, updates the connection row's last_sync_error and rethrows.
 */
// Known: two concurrent callers for the same project may both refresh and write.
// Benign today — Google accepts both, last writer wins with a still-valid token.
// Revisit if multiple concurrent sync/UI callers appear.
export async function getGscAccessToken(projectId: string): Promise<string> {
  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('gsc_connections')
    .select('id,refresh_token_encrypted,access_token_encrypted,access_token_expires_at')
    .eq('project_id', projectId)
    .single()
  if (error || !row) throw new Error('no gsc connection for project')

  const expiresAt = row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : 0
  if (row.access_token_encrypted && expiresAt - Date.now() > REFRESH_BUFFER_MS) {
    return decryptJson<string>(fromBytea(row.access_token_encrypted))
  }

  const refreshToken = decryptJson<string>(fromBytea(row.refresh_token_encrypted))
  try {
    const refreshed = await refreshAccessToken(refreshToken)
    const newExpiry = new Date(Date.now() + refreshed.expiresInSeconds * 1000).toISOString()
    const ciphertext = toBytea(encryptJson(refreshed.accessToken))
    await supabase
      .from('gsc_connections')
      .update({
        access_token_encrypted: ciphertext,
        access_token_expires_at: newExpiry,
        last_sync_error: null,
      })
      .eq('id', row.id)
    return refreshed.accessToken
  } catch (err) {
    if (err instanceof InvalidGrantError) {
      await supabase
        .from('gsc_connections')
        .update({ last_sync_error: 'refresh_token_revoked', last_sync_status: 'error' })
        .eq('id', row.id)
    }
    throw err
  }
}
