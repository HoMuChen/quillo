import createMiddleware from 'next-intl/middleware'
import type { NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'
import { updateSession } from '@/lib/supabase/middleware'

const intlMiddleware = createMiddleware(routing)

export async function middleware(request: NextRequest) {
  // 1. Refresh Supabase session (mutates request.cookies, returns a response we'll merge)
  const supabaseResponse = await updateSession(request)

  // 2. Let next-intl produce its response (redirect / rewrite / next)
  const intlResponse = intlMiddleware(request)

  // 3. Copy any cookies Supabase set onto intl's response so they're not lost
  supabaseResponse.cookies.getAll().forEach((c) =>
    intlResponse.cookies.set(c.name, c.value, c),
  )
  return intlResponse
}

export const config = {
  matcher: [
    // Skip API, auth callback, _next internals, favicons, static image assets
    '/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
