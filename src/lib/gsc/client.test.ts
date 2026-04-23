import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  buildAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  listSites,
  querySearchAnalytics,
  InvalidGrantError,
} from './client'

beforeEach(() => {
  vi.restoreAllMocks()
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'cid'
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'csecret'
  process.env.GOOGLE_OAUTH_REDIRECT_URL = 'https://app/cb'
})

describe('buildAuthUrl', () => {
  it('includes scope, redirect, state, prompt=consent (for refresh_token), access_type=offline', () => {
    const url = new URL(buildAuthUrl('state-xyz'))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('client_id')).toBe('cid')
    expect(url.searchParams.get('redirect_uri')).toBe('https://app/cb')
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/webmasters.readonly')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('state')).toBe('state-xyz')
    expect(url.searchParams.get('response_type')).toBe('code')
  })
})

describe('exchangeCodeForTokens', () => {
  it('posts form body to token endpoint and returns tokens', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      access_token: 'at', refresh_token: 'rt', expires_in: 3600, token_type: 'Bearer',
    }), { status: 200 }))
    const result = await exchangeCodeForTokens('code-abc')
    expect(result.accessToken).toBe('at')
    expect(result.refreshToken).toBe('rt')
    expect(result.expiresInSeconds).toBe(3600)
    const call = fetchMock.mock.calls[0]
    expect(call[0]).toBe('https://oauth2.googleapis.com/token')
    expect(call[1]?.method).toBe('POST')
  })

  it('throws on non-200', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('bad', { status: 400 }))
    await expect(exchangeCodeForTokens('code')).rejects.toThrow()
  })

  it('throws when refresh_token is missing from a 200 response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      access_token: 'at', expires_in: 3600, token_type: 'Bearer',
    }), { status: 200 }))
    await expect(exchangeCodeForTokens('code')).rejects.toThrow(/no refresh_token/)
  })
})

describe('refreshAccessToken', () => {
  it('returns a new access token', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      access_token: 'at2', expires_in: 3599, token_type: 'Bearer',
    }), { status: 200 }))
    const result = await refreshAccessToken('rt')
    expect(result.accessToken).toBe('at2')
  })

  it('throws InvalidGrantError on invalid_grant response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: 'invalid_grant',
    }), { status: 400 }))
    await expect(refreshAccessToken('rt')).rejects.toBeInstanceOf(InvalidGrantError)
  })
})

describe('listSites', () => {
  it('returns the siteEntry array with siteUrl + permissionLevel', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      siteEntry: [
        { siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' },
        { siteUrl: 'https://blog.example.com/', permissionLevel: 'siteFullUser' },
      ],
    }), { status: 200 }))
    const sites = await listSites('at')
    expect(sites).toHaveLength(2)
    expect(sites[0].siteUrl).toBe('sc-domain:example.com')
  })
})

describe('querySearchAnalytics', () => {
  it('POSTs dimensions + dates + rowLimit, returns rows with keys split back out', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      rows: [
        { keys: ['2026-04-20', 'seo tool', 'https://site/a'], clicks: 5, impressions: 100, ctr: 0.05, position: 8.2 },
      ],
    }), { status: 200 }))
    const res = await querySearchAnalytics('at', 'sc-domain:example.com', {
      startDate: '2026-04-01', endDate: '2026-04-20', rowLimit: 25000, startRow: 0,
    })
    expect(res.rows[0]).toEqual({
      date: '2026-04-20', query: 'seo tool', page: 'https://site/a',
      clicks: 5, impressions: 100, ctr: 0.05, position: 8.2,
    })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain(encodeURIComponent('sc-domain:example.com'))
    expect(url).toContain('/searchAnalytics/query')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.dimensions).toEqual(['date', 'query', 'page'])
    expect(body.rowLimit).toBe(25000)
  })
})
