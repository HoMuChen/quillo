import { createClient } from '@/lib/supabase/server'
import { signState } from '@/lib/gsc/state'
import { buildAuthUrl } from '@/lib/gsc/client'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const projectId = url.searchParams.get('projectId')
  if (!projectId) return new Response('projectId required', { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Verify the user has access to the project. RLS will enforce on actual writes,
  // but an early check avoids leaking OAuth flows for projects the user can't touch.
  const { data: project } = await supabase
    .from('projects').select('id').eq('id', projectId).maybeSingle()
  if (!project) return new Response('Not found', { status: 404 })

  const state = signState(projectId)
  return Response.redirect(buildAuthUrl(state), 302)
}
