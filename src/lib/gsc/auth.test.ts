import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  refreshAccessToken: vi.fn(),
  InvalidGrantError: class InvalidGrantError extends Error { constructor() { super('invalid_grant') } },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/crypto/encrypt', () => ({
  encryptJson: (v: unknown) => Buffer.from(`enc:${JSON.stringify(v)}`),
  decryptJson: (b: Buffer) => JSON.parse(b.toString().replace(/^enc:/, '')),
  toBytea: (b: Buffer) => `\\x${b.toString('hex')}`,
  fromBytea: (v: unknown) => (Buffer.isBuffer(v) ? v : Buffer.from(String(v).replace(/^\\x/, ''), 'hex')),
}))

beforeEach(() => vi.clearAllMocks())

describe('getGscAccessToken', () => {
  it('returns cached access token when not expired', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    const mock = vi.mocked(createClient)
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    mock.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: {
                id: 'c1',
                refresh_token_encrypted: Buffer.from('enc:"rt"'),
                access_token_encrypted: Buffer.from('enc:"at-valid"'),
                access_token_expires_at: future,
              },
              error: null,
            }),
          }),
        }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
    } as never)
    const { getGscAccessToken } = await import('./auth')
    const at = await getGscAccessToken('proj-1')
    expect(at).toBe('at-valid')
  })

  it('refreshes and persists when expired', async () => {
    const { refreshAccessToken } = await import('./client')
    vi.mocked(refreshAccessToken).mockResolvedValue({ accessToken: 'at-new', expiresInSeconds: 3600 })
    const { createClient } = await import('@/lib/supabase/server')
    const past = new Date(Date.now() - 1000).toISOString()
    const updateMock = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }))
    vi.mocked(createClient).mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: {
                id: 'c1',
                refresh_token_encrypted: Buffer.from('enc:"rt"'),
                access_token_encrypted: Buffer.from('enc:"at-old"'),
                access_token_expires_at: past,
              },
              error: null,
            }),
          }),
        }),
        update: updateMock,
      }),
    } as never)
    const { getGscAccessToken } = await import('./auth')
    const at = await getGscAccessToken('proj-1')
    expect(at).toBe('at-new')
    expect(refreshAccessToken).toHaveBeenCalledWith('rt')
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      last_sync_error: null,
      access_token_expires_at: expect.any(String),
      access_token_encrypted: expect.anything(),
    }))
  })

  it('on InvalidGrantError: marks last_sync_error=refresh_token_revoked, last_sync_status=error, and rethrows', async () => {
    const { refreshAccessToken, InvalidGrantError } = await import('./client')
    vi.mocked(refreshAccessToken).mockRejectedValue(new InvalidGrantError())
    const { createClient } = await import('@/lib/supabase/server')
    const past = new Date(Date.now() - 1000).toISOString()
    const updateEq = vi.fn(() => Promise.resolve({ error: null }))
    const updateMock = vi.fn(() => ({ eq: updateEq }))
    vi.mocked(createClient).mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: {
                id: 'c1',
                refresh_token_encrypted: Buffer.from('enc:"rt"'),
                access_token_encrypted: Buffer.from('enc:"at-old"'),
                access_token_expires_at: past,
              },
              error: null,
            }),
          }),
        }),
        update: updateMock,
      }),
    } as never)
    const { getGscAccessToken } = await import('./auth')
    await expect(getGscAccessToken('proj-1')).rejects.toBeInstanceOf(InvalidGrantError)
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      last_sync_error: 'refresh_token_revoked',
      last_sync_status: 'error',
    }))
  })
})
