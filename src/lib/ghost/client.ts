import 'server-only'
import GhostAdminAPI from '@tryghost/admin-api'
import { decryptJson } from '@/lib/crypto/encrypt'

export type GhostConfig = { apiUrl: string; apiKey: string }

export function ghostClientFromConfig(config: GhostConfig) {
  return new GhostAdminAPI({
    url: config.apiUrl,
    key: config.apiKey,
    version: 'v5.0',
  })
}

export function ghostClientFromRow(row: { config_encrypted: Buffer | Uint8Array }) {
  const buf = Buffer.isBuffer(row.config_encrypted)
    ? row.config_encrypted
    : Buffer.from(row.config_encrypted)
  const config = decryptJson<GhostConfig>(buf)
  return ghostClientFromConfig(config)
}
