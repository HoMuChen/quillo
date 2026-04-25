// Article workflow status. Mirrors the CHECK constraint on `articles.status`
// in supabase/migrations/20260418000000_init.sql.
export const ARTICLE_STATUSES = [
  'planned',
  'outlining',
  'outline_ready',
  'interviewing',
  'drafting',
  'draft_ready',
  'editing',
] as const

export type ArticleStatus = (typeof ARTICLE_STATUSES)[number]
