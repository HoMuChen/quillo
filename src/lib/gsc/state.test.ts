import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  process.env.OAUTH_STATE_SECRET = Buffer.from('x'.repeat(32)).toString('base64')
})

describe('gsc state', () => {
  it('round-trips a projectId', async () => {
    const { signState, verifyState } = await import('./state')
    const state = signState('proj-123')
    expect(verifyState(state)).toEqual({ projectId: 'proj-123' })
  })

  it('rejects tampered state', async () => {
    const { signState, verifyState } = await import('./state')
    const state = signState('proj-123')
    const [payload, sig] = state.split('.')
    const tampered = `${payload}X.${sig}`
    expect(() => verifyState(tampered)).toThrow()
  })

  it('rejects expired state (>10 min)', async () => {
    vi.useFakeTimers()
    const { signState, verifyState } = await import('./state')
    const state = signState('proj-123')
    vi.advanceTimersByTime(11 * 60 * 1000)
    expect(() => verifyState(state)).toThrow()
    vi.useRealTimers()
  })

  it('throws when OAUTH_STATE_SECRET is not 32 bytes', async () => {
    process.env.OAUTH_STATE_SECRET = Buffer.from('x'.repeat(16)).toString('base64')
    const { signState } = await import('./state')
    expect(() => signState('proj-123')).toThrow(/32 bytes/)
  })
})
