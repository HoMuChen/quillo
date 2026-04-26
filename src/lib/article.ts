// Article workflow status. Mirrors the CHECK constraint on `articles.status`
// in supabase/migrations/20260426000000_simplify_article_status.sql.
export const ARTICLE_STATUSES = [
  'planning',
  'drafting',
  'editing',
  'published',
] as const

export type ArticleStatus = (typeof ARTICLE_STATUSES)[number]
