import 'server-only'
import GhostAdminAPI from '@tryghost/admin-api'
import { decryptJson, fromBytea } from '@/lib/crypto/encrypt'

export type GhostConfig = { apiUrl: string; apiKey: string }

export function ghostClientFromConfig(config: GhostConfig) {
  return new GhostAdminAPI({
    url: config.apiUrl,
    key: config.apiKey,
    version: 'v5.0',
  })
}

export function ghostClientFromRow(row: { config_encrypted: unknown }) {
  const config = decryptJson<GhostConfig>(fromBytea(row.config_encrypted))
  return ghostClientFromConfig(config)
}
