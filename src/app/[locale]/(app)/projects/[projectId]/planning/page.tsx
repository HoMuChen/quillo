import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

type Props = { params: Promise<{ locale: string; projectId: string }> }

const PILLAR_COLORS = ['p1', 'p2', 'p3'] as const
const bgMap = { p1: 'bg-p1-tint border-p1', p2: 'bg-p2-tint border-p2', p3: 'bg-p3-tint border-p3' }
const textMap = { p1: 'text-p1', p2: 'text-p2', p3: 'text-p3' }

export default async function PlanningPage({ params }: Props) {
  const { locale, projectId } = await params
  setRequestLocale(locale)
  const t = await getTranslations('planning')
  const tp = await getTranslations('projects')

  const supabase = await createClient()
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id,name')
    .eq('id', projectId)
    .single()
  if (projectError || !project) notFound()

  const { data: pillars } = await supabase
    .from('pillars')
    .select('id,title,description,target_keyword,search_intent,position')
    .eq('project_id', projectId)
    .order('position')

  const pillarIds = (pillars ?? []).map((p) => p.id)
  const { data: articles } = pillarIds.length
    ? await supabase
        .from('articles')
        .select('id,title,target_keyword,role,status,position,pillar_id')
        .in('pillar_id', pillarIds)
        .order('position')
    : { data: [] as Array<{ id: string; title: string; target_keyword: string | null; role: string | null; status: string; position: number; pillar_id: string | null }> }

  const byPillar = new Map<string, typeof articles>()
  for (const a of articles ?? []) {
    const key = a.pillar_id ?? ''
    if (!byPillar.has(key)) byPillar.set(key, [])
    byPillar.get(key)!.push(a)
  }

  if (!pillars || pillars.length === 0) {
    return (
      <div className="space-y-6 max-w-3xl">
        <h1 className="font-serif italic text-[32px] text-ink leading-tight">{tp('nav_planning')}</h1>
        <div className="rounded-xl border border-rule border-dashed bg-bg/60 p-10 text-center shadow-sh-1 space-y-4">
          <p className="font-serif italic text-[22px] text-ink">{t('empty_title')}</p>
          <p className="text-[13px] text-ink-3 max-w-md mx-auto">{t('empty_body')}</p>
          <Link href={`/projects/${projectId}/planning/new`} className="inline-block">
            <Button variant="primary" size="lg">✦ {t('empty_cta')}</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="flex items-start justify-between gap-6">
        <h1 className="font-serif italic text-[32px] text-ink leading-tight">{tp('nav_planning')}</h1>
        <Link href={`/projects/${projectId}/planning/new`}>
          <Button variant="default">{t('plan_new_button')}</Button>
        </Link>
      </header>

      <div className="space-y-4">
        {pillars.map((pillar, i) => {
          const color = PILLAR_COLORS[i % PILLAR_COLORS.length]
          const pillarArticles = byPillar.get(pillar.id) ?? []
          return (
            <article key={pillar.id} className={`rounded-xl border ${bgMap[color]} p-5 shadow-sh-1`}>
              <header className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className={`font-serif italic text-[24px] leading-tight ${textMap[color]}`}>{pillar.title}</h2>
                  {pillar.target_keyword && (
                    <p className="font-mono text-[11px] text-ink-3 mt-1">{pillar.target_keyword}</p>
                  )}
                </div>
                {pillar.search_intent && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3 whitespace-nowrap">
                    {pillar.search_intent}
                  </span>
                )}
              </header>

              {pillar.description && (
                <p className="text-[13px] text-ink-2 leading-[1.55] mb-3">{pillar.description}</p>
              )}

              <ul className="space-y-0 border-t border-rule/60 divide-y divide-rule/60">
                {pillarArticles.map((article) => (
                  <li key={article.id}>
                    <Link
                      href={`/projects/${projectId}/articles/${article.id}`}
                      className="flex items-start justify-between gap-3 py-2 -mx-2 px-2 rounded-md hover:bg-mist transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-ink font-medium truncate">{article.title}</div>
                        {article.target_keyword && (
                          <div className="font-mono text-[10px] text-ink-3 truncate">{article.target_keyword}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        {article.role && (
                          <span className={`font-mono text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border ${
                            article.role === 'hub' ? 'bg-ink text-bg border-ink' : 'bg-bg border-rule text-ink-3'
                          }`}>
                            {article.role}
                          </span>
                        )}
                        <StatusChip status={article.status} />
                      </div>
                    </Link>
                  </li>
                ))}
                {pillarArticles.length === 0 && (
                  <li className="py-2 text-[12px] text-ink-4">{t('pillar_no_articles')}</li>
                )}
              </ul>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function StatusChip({ status }: { status: string }) {
  // Map backend status → display label + color
  const map: Record<string, { label: string; cls: string }> = {
    planned:       { label: 'planned',       cls: 'bg-bg border-rule text-ink-3' },
    outlining:     { label: 'outlining',     cls: 'bg-bg-2 border-rule text-ochre-2' },
    outline_ready: { label: 'outline',       cls: 'bg-bg border-ochre text-ochre-2' },
    interviewing:  { label: 'interview',     cls: 'bg-bg-2 border-rule text-ochre-2' },
    drafting:      { label: 'drafting',      cls: 'bg-bg-2 border-rule text-ochre-2' },
    draft_ready:   { label: 'draft',         cls: 'bg-bg border-ochre text-ochre-2' },
    editing:       { label: 'editing',       cls: 'bg-bg border-ink text-ink' },
  }
  const v = map[status] ?? map.planned
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border ${v.cls}`}>
      <span className="w-1 h-1 rounded-full bg-current opacity-50" />
      {v.label}
    </span>
  )
}
