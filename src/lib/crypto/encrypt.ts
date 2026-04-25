import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALG = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error('ENCRYPTION_KEY not set')
  const buf = Buffer.from(raw, 'base64')
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes (base64-encoded)')
  return buf
}

export function encryptJson(value: unknown): Buffer {
  const key = getKey()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALG, key, iv)
  const pt = Buffer.from(JSON.stringify(value), 'utf-8')
  const ct = Buffer.concat([cipher.update(pt), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct])
}

export function decryptJson<T = unknown>(buf: Buffer): T {
  const key = getKey()
  const iv = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ct = buf.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALG, key, iv)
  decipher.setAuthTag(tag)
  const pt = Buffer.concat([decipher.update(ct), decipher.final()])
  return JSON.parse(pt.toString('utf-8')) as T
}

export function toBytea(buf: Buffer): string {
  return '\\x' + buf.toString('hex')
}

export function decryptConfig<T>(row: { config_encrypted: unknown }): T {
  return decryptJson<T>(fromBytea(row.config_encrypted))
}

export function fromBytea(raw: unknown): Buffer {
  if (Buffer.isBuffer(raw)) return raw
  if (raw instanceof Uint8Array) return Buffer.from(raw)
  if (typeof raw === 'string') {
    const bytes = raw.startsWith('\\x')
      ? Buffer.from(raw.slice(2), 'hex')
      : /^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0
        ? Buffer.from(raw, 'hex')
        : Buffer.from(raw, 'base64')
    // Salvage legacy rows where a Buffer was JSON-serialized into bytea
    // as {"type":"Buffer","data":[...]}
    const head = bytes.subarray(0, 16).toString('utf-8')
    if (head.startsWith('{"type":"Buffer"')) {
      try {
        const parsed = JSON.parse(bytes.toString('utf-8')) as { type: string; data: number[] }
        if (parsed.type === 'Buffer' && Array.isArray(parsed.data)) {
          return Buffer.from(parsed.data)
        }
      } catch {
        /* fall through */
      }
    }
    return bytes
  }
  throw new Error('unsupported bytea value')
}
