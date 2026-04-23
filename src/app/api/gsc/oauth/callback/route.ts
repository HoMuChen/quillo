import { createClient } from '@/lib/supabase/server'
import { verifyState } from '@/lib/gsc/state'
import { exchangeCodeForTokens, listSites } from '@/lib/gsc/client'
import { encryptJson, toBytea } from '@/lib/crypto/encrypt'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateParam = url.searchParams.get('state')
  if (!code || !stateParam) return new Response('bad request', { status: 400 })

  let projectId: string
  try {
    projectId = verifyState(stateParam).projectId
  } catch {
    return new Response('invalid state', { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>
  let sites: Awaited<ReturnType<typeof listSites>>
  let googleEmail: string
  try {
    tokens = await exchangeCodeForTokens(code)
    sites = await listSites(tokens.accessToken)
    if (sites.length === 0) {
      return htmlResponse(renderErrorPage(
        'No Search Console properties found for this Google account.',
        projectId,
      ))
    }
    const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    })
    const profile = profileRes.ok ? (await profileRes.json()) as { email?: string } : {}
    googleEmail = profile.email ?? ''
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return htmlResponse(renderErrorPage(
      `Failed to connect to Google: ${msg}`,
      projectId,
    ))
  }

  // Stash tokens in a short-lived encrypted envelope (10-minute TTL enforced by
  // `expiresAt` check in the finalize route). The envelope rides in the picker
  // form as a hidden field so we don't need a session/cookie for OAuth handoff.
  const envelope = toBytea(encryptJson({
    userId: user.id,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresInSeconds * 1000,
    googleEmail,
    projectId,
  }))

  return htmlResponse(renderPickerPage(projectId, googleEmail, sites, envelope))
}

function htmlResponse(html: string) {
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function renderPickerPage(projectId: string, email: string, sites: Array<{ siteUrl: string }>, envelope: string) {
  const options = sites.map((s) => `<option value="${escape(s.siteUrl)}">${escape(s.siteUrl)}</option>`).join('')
  return `<!doctype html>
<html><head><title>Connect GSC</title>
<style>body{font-family:system-ui;max-width:480px;margin:40px auto;padding:20px}
label{display:block;margin-top:12px}select,input[type=submit]{padding:8px;margin-top:4px;width:100%}
</style></head><body>
<h1>Pick a Search Console property</h1>
<p>Connected as <strong>${escape(email)}</strong>.</p>
<form method="post" action="/api/gsc/oauth/finalize">
  <input type="hidden" name="envelope" value="${envelope}" />
  <label>Property<select name="propertyUrl">${options}</select></label>
  <input type="submit" value="Connect" />
</form>
<p><a href="/zh-TW/projects/${escape(projectId)}/settings">Cancel</a></p>
</body></html>`
}

function renderErrorPage(message: string, projectId: string) {
  return `<!doctype html><html><body style="font-family:system-ui;max-width:480px;margin:40px auto;padding:20px">
<h1>Connection failed</h1><p>${escape(message)}</p>
<p><a href="/zh-TW/projects/${escape(projectId)}/settings">Back to settings</a></p>
</body></html>`
}
