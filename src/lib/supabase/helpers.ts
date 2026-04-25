import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'
import type { ArticleStatus } from '@/lib/article'

type DB = SupabaseClient<Database>
type Project = Database['public']['Tables']['projects']['Row']
type Brand = Database['public']['Tables']['brand_materials']['Row']

export async function fetchProjectContext(
  supabase: DB,
  projectId: string,
): Promise<{ project: Project; brand: Brand | null } | null> {
  const [{ data: project }, { data: brand }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('brand_materials').select('*').eq('project_id', projectId).single(),
  ])
  if (!project) return null
  return { project, brand: brand ?? null }
}

export async function setArticleStatus(
  supabase: DB,
  articleId: string,
  status: ArticleStatus,
): Promise<void> {
  await supabase.from('articles').update({ status }).eq('id', articleId)
}

export function throwIfError<T extends { error: { message: string } | null }>(res: T): T {
  if (res.error) throw res.error
  return res
}
