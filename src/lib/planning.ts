// An article that exists but has no pillar assigned, as rendered on the
// planning board (page.tsx, _graph.tsx, _organize-button.tsx). Carries
// enough fields to render its current state.
export type OrphanArticle = {
  id: string
  title: string
  target_keyword: string | null
  slug: string | null
  tags: string[]
  status: string
  source: string
}

// Slim shape used by the planning/new wizard — only the fields needed to
// pick orphans and feed them to the AI assignment endpoint.
export type OrphanArticleInput = Pick<
  OrphanArticle,
  'id' | 'title' | 'target_keyword' | 'slug'
>
