import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

const MAX_AGE_MS = 10 * 60 * 1000

function getKey(): Buffer {
  const raw = process.env.OAUTH_STATE_SECRET
  if (!raw) throw new Error('OAUTH_STATE_SECRET not set')
  const buf = Buffer.from(raw, 'base64')
  if (buf.length !== 32) throw new Error('OAUTH_STATE_SECRET must be 32 bytes (base64-encoded)')
  return buf
}

export function signState(projectId: string): string {
  const payload = JSON.stringify({ projectId, issuedAt: Date.now() })
  const b64 = Buffer.from(payload, 'utf-8').toString('base64url')
  const sig = createHmac('sha256', getKey()).update(b64).digest('base64url')
  return `${b64}.${sig}`
}

export function verifyState(state: string): { projectId: string } {
  const [b64, sig] = state.split('.')
  if (!b64 || !sig) throw new Error('invalid state')
  const expected = createHmac('sha256', getKey()).update(b64).digest('base64url')
  const a = Buffer.from(sig, 'base64url')
  const b = Buffer.from(expected, 'base64url')
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('bad signature')
  const parsed = JSON.parse(Buffer.from(b64, 'base64url').toString('utf-8')) as unknown
  if (
    !parsed || typeof parsed !== 'object'
    || typeof (parsed as { projectId?: unknown }).projectId !== 'string'
    || typeof (parsed as { issuedAt?: unknown }).issuedAt !== 'number'
  ) {
    throw new Error('invalid state payload')
  }
  const { projectId, issuedAt } = parsed as { projectId: string; issuedAt: number }
  if (Date.now() - issuedAt > MAX_AGE_MS) throw new Error('state expired')
  return { projectId }
}
