import { describe, it, expect } from 'vitest'
import { encryptJson, decryptJson } from './encrypt'

describe('encrypt / decrypt', () => {
  it('round-trips a JSON value', () => {
    const payload = { apiUrl: 'https://blog.example.com', apiKey: 'abc123:def' }
    const enc = encryptJson(payload)
    expect(enc).toBeInstanceOf(Buffer)
    const dec = decryptJson<typeof payload>(enc)
    expect(dec).toEqual(payload)
  })

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const a = encryptJson({ x: 1 })
    const b = encryptJson({ x: 1 })
    expect(Buffer.compare(a, b)).not.toBe(0)
  })

  it('throws on tampered ciphertext', () => {
    // Use a long enough payload so index 40 lies inside the ciphertext
    // region (IV=12 + tag=16 = 28, so 40 is 12 bytes into the ciphertext).
    const enc = encryptJson({ padding: 'xxxxxxxxxxxxxxxxxxxx' })
    enc[40] = enc[40] ^ 0xff // flip a byte after IV + tag
    expect(() => decryptJson(enc)).toThrow()
  })

  it('round-trips unicode', () => {
    const payload = { name: '繁體中文 💡' }
    expect(decryptJson(encryptJson(payload))).toEqual(payload)
  })
})
