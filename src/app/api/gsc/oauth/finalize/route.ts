import { createClient } from '@/lib/supabase/server'
import { decryptJson, encryptJson, toBytea, fromBytea } from '@/lib/crypto/encrypt'

export const runtime = 'nodejs'

type Envelope = {
  userId: string
  accessToken: string
  refreshToken: string
  expiresAt: number
  googleEmail: string
  projectId: string
}

export async function POST(req: Request) {
  const form = await req.formData()
  const envelopeRaw = form.get('envelope')
  const propertyUrl = form.get('propertyUrl')
  if (typeof envelopeRaw !== 'string' || typeof propertyUrl !== 'string') {
    return new Response('bad request', { status: 400 })
  }

  let envelope: Envelope
  try {
    envelope = decryptJson<Envelope>(fromBytea(envelopeRaw))
  } catch {
    return new Response('invalid envelope', { status: 400 })
  }

  if (Date.now() > envelope.expiresAt - 60_000) {
    return new Response('envelope expired, reconnect', { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  if (envelope.userId !== user.id) {
    return new Response('envelope does not match session', { status: 403 })
  }

  const { data: membership } = await supabase
    .from('tenant_members').select('tenant_id').eq('user_id', user.id).single()
  if (!membership) return new Response('No tenant', { status: 400 })

  const { data: proj } = await supabase
    .from('projects')
    .select('id')
    .eq('id', envelope.projectId)
    .eq('tenant_id', membership.tenant_id)
    .maybeSingle()
  if (!proj) return new Response('forbidden', { status: 403 })

  const refreshCt = toBytea(encryptJson(envelope.refreshToken))
  const accessCt = toBytea(encryptJson(envelope.accessToken))
  const expiresAtIso = new Date(envelope.expiresAt).toISOString()

  const { error } = await supabase.from('gsc_connections').upsert({
    project_id: envelope.projectId,
    tenant_id: membership.tenant_id,
    google_user_email: envelope.googleEmail,
    property_url: propertyUrl,
    refresh_token_encrypted: refreshCt,
    access_token_encrypted: accessCt,
    access_token_expires_at: expiresAtIso,
    last_sync_status: null,
    last_sync_error: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'project_id' })
  if (error) return new Response(`db error: ${error.message}`, { status: 500 })

  return Response.redirect(new URL(`/projects/${envelope.projectId}/settings?gsc=connected`, req.url), 303)
}
