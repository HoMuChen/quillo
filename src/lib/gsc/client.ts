import 'server-only'

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SC_BASE = 'https://searchconsole.googleapis.com/webmasters/v3'

export class InvalidGrantError extends Error {
  constructor(public readonly raw?: unknown) {
    super('invalid_grant')
    this.name = 'InvalidGrantError'
  }
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} not set`)
  return v
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv('GOOGLE_OAUTH_CLIENT_ID'),
    redirect_uri: requireEnv('GOOGLE_OAUTH_REDIRECT_URL'),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${AUTH_URL}?${params.toString()}`
}

async function postForm(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  })
  const text = await res.text()
  let json: Record<string, unknown> = {}
  if (text) {
    try {
      json = JSON.parse(text) as Record<string, unknown>
    } catch {
      json = { raw: text }
    }
  }
  return { ok: res.ok, status: res.status, json }
}

export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresInSeconds: number
}> {
  const { ok, status, json } = await postForm(TOKEN_URL, {
    code,
    client_id: requireEnv('GOOGLE_OAUTH_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
    redirect_uri: requireEnv('GOOGLE_OAUTH_REDIRECT_URL'),
    grant_type: 'authorization_code',
  })
  if (!ok) throw new Error(`token exchange failed: ${status} ${JSON.stringify(json)}`)
  if (typeof json.refresh_token !== 'string' || !json.refresh_token) {
    throw new Error('no refresh_token returned — user may need to revoke at myaccount.google.com and reconnect')
  }
  return {
    accessToken: json.access_token as string,
    refreshToken: json.refresh_token as string,
    expiresInSeconds: json.expires_in as number,
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  expiresInSeconds: number
}> {
  const { ok, status, json } = await postForm(TOKEN_URL, {
    refresh_token: refreshToken,
    client_id: requireEnv('GOOGLE_OAUTH_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
    grant_type: 'refresh_token',
  })
  if (!ok) {
    if (json.error === 'invalid_grant') throw new InvalidGrantError(json)
    throw new Error(`token refresh failed: ${status} ${JSON.stringify(json)}`)
  }
  return {
    accessToken: json.access_token as string,
    expiresInSeconds: json.expires_in as number,
  }
}

export type SiteEntry = { siteUrl: string; permissionLevel: string }

export async function listSites(accessToken: string): Promise<SiteEntry[]> {
  const res = await fetch(`${SC_BASE}/sites`, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`sites.list failed: ${res.status}`)
  const json = (await res.json()) as { siteEntry?: SiteEntry[] }
  return json.siteEntry ?? []
}

export type SearchAnalyticsParams = {
  startDate: string
  endDate: string
  rowLimit: number
  startRow: number
}

export type SearchAnalyticsRow = {
  date: string
  query: string
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export async function querySearchAnalytics(
  accessToken: string,
  propertyUrl: string,
  params: SearchAnalyticsParams,
): Promise<{ rows: SearchAnalyticsRow[] }> {
  const url = `${SC_BASE}/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: ['date', 'query', 'page'],
      rowLimit: params.rowLimit,
      startRow: params.startRow,
      dataState: 'final',
    }),
  })
  if (!res.ok) throw new Error(`searchAnalytics.query failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as {
    rows?: Array<{
      keys: [string, string, string]
      clicks: number
      impressions: number
      ctr: number
      position: number
    }>
  }
  const rows = (json.rows ?? []).map((r) => ({
    date: r.keys[0],
    query: r.keys[1],
    page: r.keys[2],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }))
  return { rows }
}
