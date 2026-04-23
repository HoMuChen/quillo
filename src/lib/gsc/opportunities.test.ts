// src/lib/gsc/opportunities.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

function makeRpc(data: unknown, error: unknown = null) {
  return { data, error }
}

function makeClient(rpcResult: ReturnType<typeof makeRpc>) {
  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
  }
}

beforeEach(() => vi.clearAllMocks())

describe('getStrikingDistance', () => {
  it('returns data array on success', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    const row = { query: 'seo tool', normalized_page_url: 'https://x.com/a', clicks: 5, impressions: 200, avg_position: 12, matching_article_id: null }
    vi.mocked(createClient).mockResolvedValue(makeClient(makeRpc([row])) as never)
    const { getStrikingDistance } = await import('./opportunities')
    const result = await getStrikingDistance('proj-1')
    expect(result).toEqual([row])
  })

  it('returns [] when data is null', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeClient(makeRpc(null)) as never)
    const { getStrikingDistance } = await import('./opportunities')
    expect(await getStrikingDistance('proj-1')).toEqual([])
  })

  it('throws on error', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeClient(makeRpc(null, { message: 'db error' })) as never)
    const { getStrikingDistance } = await import('./opportunities')
    await expect(getStrikingDistance('proj-1')).rejects.toMatchObject({ message: 'db error' })
  })
})

describe('getRisingQueries', () => {
  it('returns data array on success', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeClient(makeRpc([{ query: 'ai seo', current_impressions: 200, previous_impressions: 100, growth: 100 }])) as never)
    const { getRisingQueries } = await import('./opportunities')
    const result = await getRisingQueries('proj-1')
    expect(result).toHaveLength(1)
  })

  it('throws on error', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeClient(makeRpc(null, { message: 'fail' })) as never)
    const { getRisingQueries } = await import('./opportunities')
    await expect(getRisingQueries('proj-1')).rejects.toMatchObject({ message: 'fail' })
  })
})

describe('getDecayingPages', () => {
  it('returns data array on success', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeClient(makeRpc([{ normalized_page_url: 'https://x.com/a', current_clicks: 10, previous_clicks: 80, decline_pct: 0.875, matching_article_id: null }])) as never)
    const { getDecayingPages } = await import('./opportunities')
    const result = await getDecayingPages('proj-1')
    expect(result).toHaveLength(1)
  })

  it('throws on error', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeClient(makeRpc(null, { message: 'fail' })) as never)
    const { getDecayingPages } = await import('./opportunities')
    await expect(getDecayingPages('proj-1')).rejects.toMatchObject({ message: 'fail' })
  })
})
