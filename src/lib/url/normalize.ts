/**
 * Mirror of the Postgres `public.normalize_url()` function.
 * Same transforms applied in the same order so JS and SQL produce the same output.
 */
export function normalizeUrl(u: string | null | undefined): string | null {
  if (u === null || u === undefined || u === '') return null
  let r = u.toLowerCase()
  r = r.replace(/[#?].*$/, '')
  r = r.replace(/\/+$/, '')
  return r
}
