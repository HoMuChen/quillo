'use client'

import {
  useCallback, useEffect, useMemo, useRef, useState, useTransition,
} from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2, RefreshCw, Plus, X } from 'lucide-react'
import {
  updatePillar, deletePillar, addArticle,
  assignOrphanToPillarAction, createPillarAndAssignAction,
} from './planning-actions'
import { RegenerateClusterOverlay } from './_regenerate-cluster'

type Pillar = {
  id: string
  title: string
  description: string | null
  target_keyword: string | null
  search_intent: string | null
  position: number
}

type Article = {
  id: string
  title: string
  target_keyword: string | null
  search_intent: string | null
  role: string | null
  status: string
  position: number
  pillar_id: string | null
}

type OrphanArticle = {
  id: string
  title: string
  target_keyword: string | null
  slug: string | null
  tags: string[]
  status: string
  source: string
}

type PublishTarget = {
  article_id: string
  remote_status: string | null
}

type VisualStatus = 'published' | 'draft' | 'empty'

const COLOR_IDX = [0, 1, 2] as const

function articleVisualStatus(article: Article, target: PublishTarget | undefined): VisualStatus {
  if (target?.remote_status === 'published') return 'published'
  if (target?.remote_status === 'draft' || target?.remote_status === 'scheduled') return 'draft'
  if (article.status === 'editing' || article.status === 'draft_ready') return 'draft'
  return 'empty'
}

function pillarVisualStatus(statuses: VisualStatus[]): VisualStatus {
  if (statuses.some((s) => s === 'published')) return 'published'
  if (statuses.some((s) => s === 'draft')) return 'draft'
  return 'empty'
}

const COLOR_HEX = {
  0: { main: '#a85a2d', tint: '#f4ddd0' },
  1: { main: '#2d4a66', tint: '#e4eaf0' },
  2: { main: '#4a6a3f', tint: '#e3ead9' },
} as const

const ORPHAN_HEX = {
  main: '#73756b',
  bright: '#8d9085',
} as const

function cardSpan(tier: 'hero' | 'secondary' | 'standard') {
  if (tier === 'hero') return 'lg:col-span-2'
  if (tier === 'secondary') return 'lg:col-span-2'
  return ''
}

function statusTone(status: VisualStatus, hex: { main: string; tint: string }) {
  if (status === 'published') return hex.main
  if (status === 'draft') return `color-mix(in oklab, ${hex.main} 72%, var(--color-bg))`
  return `color-mix(in oklab, ${hex.main} 34%, var(--color-bg))`
}

export function PlanningGraph({
  projectId,
  pillars,
  articles,
  publishTargets,
  orphanArticles,
}: {
  projectId: string
  pillars: Pillar[]
  articles: Article[]
  publishTargets: PublishTarget[]
  orphanArticles: OrphanArticle[]
}) {
  const [selectedPillarId, setSelectedPillarId] = useState<string | null>(null)
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)

  const articlesByPillar = useMemo(() => {
    const m = new Map<string, Article[]>()
    for (const a of articles) {
      if (!a.pillar_id) continue
      if (!m.has(a.pillar_id)) m.set(a.pillar_id, [])
      m.get(a.pillar_id)!.push(a)
    }
    return m
  }, [articles])

  const targetsByArticle = useMemo(() => {
    const m = new Map<string, PublishTarget>()
    for (const t of publishTargets) m.set(t.article_id, t)
    return m
  }, [publishTargets])

  const pillarCards = useMemo(() => pillars.map((pillar, i) => {
    const articlesForPillar = articlesByPillar.get(pillar.id) ?? []
    const colorIdx = COLOR_IDX[i % COLOR_IDX.length]
    const hex = COLOR_HEX[colorIdx]
    const statuses = articlesForPillar.map((a) => articleVisualStatus(a, targetsByArticle.get(a.id)))
    const visualStatus = pillarVisualStatus(statuses)
    const publishedCount = statuses.filter((s) => s === 'published').length
    const draftCount = statuses.filter((s) => s === 'draft').length
    const emptyCount = statuses.filter((s) => s === 'empty').length
    const sortedArticles = [...articlesForPillar].sort((a, b) => {
      if ((a.role === 'hub') !== (b.role === 'hub')) return a.role === 'hub' ? -1 : 1
      return a.position - b.position
    })
    return {
      pillar, articles: sortedArticles, colorIdx, hex, visualStatus,
      publishedCount, draftCount, emptyCount,
    }
  }), [pillars, articlesByPillar, targetsByArticle])

  const arrangedPillarCards = useMemo(() => {
    if (pillarCards.length === 0) return []

    const ranked = [...pillarCards].sort((a, b) => {
      const countDiff = b.articles.length - a.articles.length
      if (countDiff !== 0) return countDiff
      return a.pillar.position - b.pillar.position
    })

    const heroId = ranked[0]?.pillar.id
    const secondaryIds = new Set(
      ranked
        .slice(1, 3)
        .filter((card) => card.articles.length >= 6)
        .map((card) => card.pillar.id),
    )

    const hero = heroId ? pillarCards.find((card) => card.pillar.id === heroId) : undefined
    const rest = pillarCards.filter((card) => card.pillar.id !== heroId)

    return [
      ...(hero ? [{ ...hero, tier: 'hero' as const }] : []),
      ...rest.map((card) => ({
        ...card,
        tier: secondaryIds.has(card.pillar.id) ? 'secondary' as const : 'standard' as const,
      })),
    ]
  }, [pillarCards])

  const selectedPillar = selectedPillarId ? (pillars.find((p) => p.id === selectedPillarId) ?? null) : null
  const selectedPillarArticles = selectedPillar ? (articlesByPillar.get(selectedPillar.id) ?? []) : []

  const selectedArticle = selectedArticleId
    ? (articles.find((a) => a.id === selectedArticleId) ?? orphanArticles.find((o) => o.id === selectedArticleId) ?? null)
    : null
  const isOrphanSelected = selectedArticleId ? orphanArticles.some((o) => o.id === selectedArticleId) : false

  // Keep last-seen values so the panel content stays visible during the close animation
  const lastPillarRef = useRef(selectedPillar)
  const lastPillarArticlesRef = useRef(selectedPillarArticles)
  if (selectedPillar) { lastPillarRef.current = selectedPillar; lastPillarArticlesRef.current = selectedPillarArticles }

  const lastArticleRef = useRef(selectedArticle)
  const lastIsOrphanRef = useRef(isOrphanSelected)
  if (selectedArticle) { lastArticleRef.current = selectedArticle; lastIsOrphanRef.current = isOrphanSelected }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="grid gap-6 lg:grid-cols-4 auto-rows-[minmax(220px,auto)]">
          {arrangedPillarCards.map(({ pillar, articles: pillarArticles, hex, tier, publishedCount, draftCount, emptyCount }, i) => {
            const isSelected = selectedPillarId === pillar.id
            const totalCount = pillarArticles.length
            const indexLabel = String(i + 1).padStart(2, '0')
            return (
              <section
                key={pillar.id}
                className={cn(
                  'relative overflow-hidden rounded-[16px] p-6 text-left transition-all shadow-sh-1',
                  cardSpan(tier),
                  isSelected ? 'ring-2 ring-[var(--color-ochre)]' : '',
                )}
                style={{
                  background: 'white',
                }}
              >
                <div className="pointer-events-none absolute right-5 top-5 text-right leading-none">
                  <div
                    className="font-serif italic text-[36px] leading-none tracking-tight tabular-nums"
                    style={{ color: hex.main }}
                  >
                    {totalCount === 0 ? '—' : String(totalCount).padStart(2, '0')}
                  </div>
                  <div className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-4">
                    clusters
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPillarId(pillar.id === selectedPillarId ? null : pillar.id)}
                  className="mb-4 block pr-24 text-left cursor-pointer"
                >
                  <div className="flex items-baseline gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-4">
                    <span>pillar</span>
                    <span className="font-serif italic normal-case tracking-normal text-[13px] text-ink-3 tabular-nums">
                      {indexLabel}
                    </span>
                  </div>
                  <h3 className="mt-2 text-[20px] font-semibold leading-[1.25] tracking-tight text-ink">{pillar.title}</h3>
                  {pillar.target_keyword && (
                    <p className="mt-2 font-mono text-[11px] text-ink-3">{pillar.target_keyword}</p>
                  )}
                  {pillar.description && (
                    <p className="mt-3 line-clamp-2 max-w-[62ch] text-[13px] leading-[1.55] text-ink-2">{pillar.description}</p>
                  )}
                </button>

                {totalCount > 0 && (
                  <div className="mb-4">
                    <div
                      className="flex h-1.5 w-full gap-px overflow-hidden rounded-full"
                      style={{ background: `color-mix(in oklab, ${hex.main} 8%, var(--color-rule))` }}
                    >
                      {publishedCount > 0 && (
                        <div style={{ width: `${(publishedCount / totalCount) * 100}%`, background: statusTone('published', hex) }} />
                      )}
                      {draftCount > 0 && (
                        <div style={{ width: `${(draftCount / totalCount) * 100}%`, background: statusTone('draft', hex) }} />
                      )}
                      {emptyCount > 0 && (
                        <div style={{ width: `${(emptyCount / totalCount) * 100}%`, background: statusTone('empty', hex) }} />
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-ink-3 tabular-nums">
                      {publishedCount > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusTone('published', hex) }} />
                          {publishedCount} published
                        </span>
                      )}
                      {draftCount > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusTone('draft', hex) }} />
                          {draftCount} draft
                        </span>
                      )}
                      {emptyCount > 0 && (
                        <span className="flex items-center gap-1">
                          <span
                            className="h-1.5 w-1.5 rounded-full border"
                            style={{ borderColor: `color-mix(in oklab, ${hex.main} 32%, var(--color-rule))`, background: 'transparent' }}
                          />
                          {emptyCount} planned
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                  {pillarArticles.map((article) => {
                    const articleStatus = articleVisualStatus(article, targetsByArticle.get(article.id))
                    const selected = selectedArticleId === article.id
                    const isPlanning = articleStatus === 'empty'
                    return (
                      <button
                        key={article.id}
                        type="button"
                        onClick={() => setSelectedArticleId(article.id === selectedArticleId ? null : article.id)}
                        className={cn(
                          'rounded-[12px] border px-3 py-3 text-left transition-all cursor-pointer',
                          isPlanning && 'border-dashed',
                          selected && 'ring-2 ring-[var(--color-ochre)]',
                        )}
                        style={{
                          borderColor: 'var(--color-rule)',
                          background: 'var(--color-bg)',
                          opacity: isPlanning ? 0.65 : 1,
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: statusTone(articleStatus, hex) }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className={cn(
                              'truncate text-[13px] font-medium leading-[1.4]',
                              isPlanning ? 'text-ink-2' : 'text-ink',
                            )}>
                              {article.title}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {article.role && (
                                <span className="rounded-full border border-rule/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-ink-3">
                                  {article.role}
                                </span>
                              )}
                              {article.target_keyword && (
                                <span className={cn(
                                  'truncate font-mono text-[10px]',
                                  isPlanning ? 'text-ink-4' : 'text-ink-3',
                                )}>
                                  {article.target_keyword}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                  {pillarArticles.length === 0 && (
                    <div className="rounded-[12px] border border-dashed border-rule/80 bg-bg/55 px-3 py-6 text-center text-[12px] text-ink-4">
                      No clusters yet
                    </div>
                  )}
                </div>
              </section>
            )
          })}

          <section
            className={cn(
              'relative overflow-hidden rounded-[16px] p-6 shadow-sh-1',
              orphanArticles.length > 8 ? 'lg:col-span-2' : '',
            )}
            style={{ background: 'white' }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-4">unassigned</div>
                <h3 className="mt-2 text-[20px] font-semibold leading-[1.25] tracking-tight text-ink">Cluster Inbox</h3>
                <p className="mt-2 text-[13px] text-ink-3">Articles waiting to be assigned to a pillar.</p>
              </div>
              <span className="rounded-full border border-rule bg-bg px-3 py-1 font-mono text-[10px] tracking-[0.04em] text-ink-3 shadow-sm">
                {orphanArticles.length} items
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {orphanArticles.map((article) => {
                const selected = selectedArticleId === article.id
                return (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() => setSelectedArticleId(article.id === selectedArticleId ? null : article.id)}
                    className={cn(
                      'rounded-[12px] border px-3 py-3 text-left transition-all cursor-pointer',
                      selected && 'ring-2 ring-[var(--color-ochre)]',
                    )}
                    style={{
                      borderColor: 'var(--color-rule)',
                      background: 'white',
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ORPHAN_HEX.main }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-ink">{article.title}</div>
                        {article.target_keyword && (
                          <div className="mt-1 truncate font-mono text-[10px] text-ink-3">{article.target_keyword}</div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
              {orphanArticles.length === 0 && (
                <div className="rounded-[12px] border border-dashed border-rule/80 bg-bg/55 px-3 py-8 text-center text-[12px] text-ink-4 sm:col-span-2 xl:col-span-3">
                  All clusters are already assigned.
                </div>
              )}
            </div>
          </section>
        </div>

      </div>

      {lastPillarRef.current && (
        <PillarDetail
          open={selectedPillar !== null}
          projectId={projectId}
          pillar={lastPillarRef.current}
          articles={lastPillarArticlesRef.current}
          onClose={() => setSelectedPillarId(null)}
        />
      )}

      {lastArticleRef.current && (
        <ArticlePanel
          open={selectedArticle !== null}
          projectId={projectId}
          article={lastArticleRef.current}
          isOrphan={lastIsOrphanRef.current}
          pillars={pillars}
          onClose={() => setSelectedArticleId(null)}
        />
      )}
    </div>
  )
}

function PillarDetail({
  open,
  projectId,
  pillar,
  articles,
  onClose,
}: {
  open: boolean
  projectId: string
  pillar: Pillar
  articles: Article[]
  onClose: () => void
}) {
  const t = useTranslations('planning')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm-delete' | 'add-article'>('view')

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])
  const [regenerating, setRegenerating] = useState(false)
  const canRegenerate = articles.every((a) => a.status === 'planned')

  const refresh = useCallback(() => {
    router.refresh()
  }, [router])

  function onDelete() {
    startTransition(async () => {
      try {
        await deletePillar(projectId, pillar.id)
        onClose()
      } catch (err) { console.error(err) }
    })
  }

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-ink-shade backdrop-blur-[1px] transition-opacity',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
      />
      <aside className={cn(
        'fixed top-0 right-0 bottom-0 z-50 w-[480px] max-w-[92vw] flex flex-col border-l border-rule bg-bg shadow-sh-3 overflow-hidden',
        'transition-transform duration-300 ease-out',
        open ? 'translate-x-0' : 'translate-x-full',
      )}>
      <header className="flex items-start justify-between gap-2 px-5 py-4 border-b border-rule shrink-0">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-4">{t('pillar_label')}</div>
          <h3 className="font-serif italic text-[24px] text-ink leading-tight truncate">{pillar.title}</h3>
          {pillar.target_keyword && (
            <p className="font-mono text-[11px] text-ink-3 mt-1 truncate">{pillar.target_keyword}</p>
          )}
        </div>
        <button type="button" onClick={onClose} className="p-1 text-ink-3 hover:text-ink cursor-pointer shrink-0">
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {mode === 'view' && (
          <>
            {pillar.description && (
              <p className="text-[13px] text-ink-2 leading-[1.55]">{pillar.description}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="default" size="sm" onClick={() => setMode('edit')}>
                <Pencil className="w-3 h-3 mr-1" /> {t('edit')}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => canRegenerate && setRegenerating(true)}
                disabled={!canRegenerate}
                title={canRegenerate ? t('regenerate_tooltip') : t('regenerate_blocked')}
              >
                <RefreshCw className="w-3 h-3 mr-1" /> {t('regenerate_tooltip')}
              </Button>
              <Button variant="default" size="sm" onClick={() => setMode('add-article')}>
                <Plus className="w-3 h-3 mr-1" /> {t('add_article')}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setMode('confirm-delete')}>
                <Trash2 className="w-3 h-3 mr-1" /> {t('delete')}
              </Button>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-ink-4 mb-2">
                {t('article_count', { count: articles.length })}
              </div>
              <ul className="divide-y divide-rule/60 rounded-lg border border-rule overflow-hidden">
                {articles.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => { window.location.href = `/projects/${projectId}/articles/${a.id}` }}
                      className="w-full text-left px-3 py-2 hover:bg-mist transition-colors flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="text-[13px] text-ink truncate">{a.title}</span>
                      {a.role === 'hub' && (
                        <span className="font-mono text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border bg-ink text-bg border-ink">hub</span>
                      )}
                    </button>
                  </li>
                ))}
                {articles.length === 0 && (
                  <li className="px-3 py-3 text-[12px] text-ink-4">{t('pillar_no_articles')}</li>
                )}
              </ul>
            </div>
          </>
        )}

        {mode === 'edit' && (
          <PillarEditInline
            pillar={pillar}
            onCancel={() => setMode('view')}
            onDone={() => { setMode('view'); refresh() }}
            projectId={projectId}
          />
        )}

        {mode === 'add-article' && (
          <ArticleAddInline
            pillarId={pillar.id}
            onCancel={() => setMode('view')}
            onDone={() => { setMode('view'); refresh() }}
            projectId={projectId}
          />
        )}

        {mode === 'confirm-delete' && (
          <div className="rounded-lg border border-rust bg-bg p-3 space-y-3">
            <p className="text-[13px] text-rust">{t('confirm_delete_pillar')}</p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setMode('view')} disabled={pending}>
                {t('cancel')}
              </Button>
              <Button variant="destructive" size="sm" onClick={onDelete} disabled={pending}>
                {pending ? '...' : t('delete')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {regenerating && (
        <RegenerateClusterOverlay
          projectId={projectId}
          pillarId={pillar.id}
          pillarTitle={pillar.title}
          onClose={() => { setRegenerating(false); refresh() }}
        />
      )}
    </aside>
    </>
  )
}

function PillarEditInline({
  pillar, onCancel, onDone, projectId,
}: {
  pillar: Pillar
  onCancel: () => void
  onDone: () => void
  projectId: string
}) {
  const t = useTranslations('planning')
  const [title, setTitle] = useState(pillar.title)
  const [description, setDescription] = useState(pillar.description ?? '')
  const [keyword, setKeyword] = useState(pillar.target_keyword ?? '')
  const [intent, setIntent] = useState(pillar.search_intent ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        await updatePillar(projectId, pillar.id, {
          title: title.trim(),
          description: description || null,
          target_keyword: keyword || null,
          search_intent: (intent || null) as 'informational' | 'commercial' | 'transactional' | null,
        })
        onDone()
      } catch (err) {
        console.error(err)
        setError(t('error_generic'))
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <FieldInline label={t('form_pillar_title')}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className="inp" />
      </FieldInline>
      <FieldInline label={t('form_pillar_description')}>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          className="inp min-h-[60px]" />
      </FieldInline>
      <FieldInline label={t('form_target_keyword')}>
        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} className="inp" />
      </FieldInline>
      <FieldInline label={t('form_search_intent')}>
        <select value={intent} onChange={(e) => setIntent(e.target.value)} className="inp">
          <option value="">—</option>
          <option value="informational">informational</option>
          <option value="commercial">commercial</option>
          <option value="transactional">transactional</option>
        </select>
      </FieldInline>

      {error && <p className="text-[12px] text-rust">{error}</p>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          {t('cancel')}
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? '...' : t('save')}
        </Button>
      </div>

      <style>{`.inp{width:100%;padding:6px 10px;border:1px solid var(--color-rule);border-radius:8px;background:var(--color-bg);font-size:13px;color:var(--color-ink);outline:none}`}</style>
    </form>
  )
}

function ArticleAddInline({
  pillarId, onCancel, onDone, projectId,
}: {
  pillarId: string
  onCancel: () => void
  onDone: () => void
  projectId: string
}) {
  const t = useTranslations('planning')
  const [title, setTitle] = useState('')
  const [keyword, setKeyword] = useState('')
  const [role, setRole] = useState<'hub' | 'supporting' | 'comparison'>('supporting')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        await addArticle(projectId, pillarId, {
          title: title.trim(),
          target_keyword: keyword || null,
          lsi_keywords: [],
          search_intent: null,
          word_count_target: null,
          role,
        })
        onDone()
      } catch (err) {
        console.error(err)
        setError(t('error_generic'))
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <FieldInline label={t('form_article_title')}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className="inp" autoFocus />
      </FieldInline>
      <FieldInline label={t('form_target_keyword')}>
        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} className="inp" />
      </FieldInline>
      <FieldInline label={t('form_role')}>
        <select value={role} onChange={(e) => setRole(e.target.value as 'hub' | 'supporting' | 'comparison')} className="inp">
          <option value="hub">hub</option>
          <option value="supporting">supporting</option>
          <option value="comparison">comparison</option>
        </select>
      </FieldInline>

      {error && <p className="text-[12px] text-rust">{error}</p>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          {t('cancel')}
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? '...' : t('save')}
        </Button>
      </div>

      <style>{`.inp{width:100%;padding:6px 10px;border:1px solid var(--color-rule);border-radius:8px;background:var(--color-bg);font-size:13px;color:var(--color-ink);outline:none}`}</style>
    </form>
  )
}

function ArticlePanel({
  open,
  projectId,
  article,
  isOrphan,
  pillars,
  onClose,
}: {
  open: boolean
  projectId: string
  article: Article | OrphanArticle
  isOrphan: boolean
  pillars: Pillar[]
  onClose: () => void
}) {
  const t = useTranslations('planning')
  const router = useRouter()
  const [mode, setMode] = useState<'assign' | 'new-pillar'>('assign')
  const [assignPillarId, setAssignPillarId] = useState(pillars[0]?.id ?? '')
  const [newTitle, setNewTitle] = useState('')
  const [newKeyword, setNewKeyword] = useState(article.target_keyword ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const tags = 'tags' in article ? (article as OrphanArticle).tags : []
  const role = 'role' in article ? (article as Article).role : null

  function assign() {
    if (!assignPillarId) return
    setError(null)
    startTransition(async () => {
      try {
        await assignOrphanToPillarAction(projectId, article.id, assignPillarId)
        onClose()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error')
      }
    })
  }

  function createAndAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        await createPillarAndAssignAction(projectId, article.id, {
          title: newTitle.trim(),
          target_keyword: newKeyword || null,
        })
        onClose()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error')
      }
    })
  }

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-ink-shade backdrop-blur-[1px] transition-opacity',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
      />
      <aside className={cn(
        'fixed top-0 right-0 bottom-0 z-50 w-[480px] max-w-[92vw] flex flex-col border-l border-rule bg-bg shadow-sh-3 overflow-hidden',
        'transition-transform duration-300 ease-out',
        open ? 'translate-x-0' : 'translate-x-full',
      )}>
      <header className="flex items-start justify-between gap-2 px-5 py-4 border-b border-rule shrink-0">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-4 flex items-center gap-2">
            {isOrphan ? 'Ghost' : 'Cluster'}
            {role && <span className="px-1.5 py-0.5 rounded border border-rule bg-bg-2">{role}</span>}
          </div>
          <h3 className="font-serif italic text-[20px] text-ink leading-tight">{article.title}</h3>
          {article.target_keyword && (
            <p className="font-mono text-[11px] text-ink-3 mt-0.5 truncate">{article.target_keyword}</p>
          )}
        </div>
        <button type="button" onClick={onClose} className="p-1 text-ink-3 hover:text-ink cursor-pointer shrink-0">
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span key={tag} className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-rule bg-bg-2 text-ink-3">
                {tag}
              </span>
            ))}
          </div>
        )}

        <Link
          href={`/projects/${projectId}/articles/${article.id}`}
          className="flex items-center justify-center gap-2 w-full rounded-lg border border-rule bg-bg-2 px-4 py-2.5 text-[13px] text-ink hover:bg-mist transition-colors"
        >
          {t('open_editor')}
        </Link>

        {isOrphan && (
          <>
            <div className="border-t border-rule/60 pt-3">
              <p className="text-[11px] text-ink-4 mb-3">{t('orphan_assign')}</p>
              <div className="flex gap-1 rounded-lg border border-rule overflow-hidden text-[11px] mb-3">
                {(['assign', 'new-pillar'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setMode(m)}
                    className={cn('flex-1 px-3 py-1.5 transition-colors cursor-pointer',
                      mode === m ? 'bg-ink text-bg' : 'text-ink-3 hover:bg-mist')}
                  >
                    {m === 'assign' ? t('orphan_assign_existing') : t('orphan_new_pillar')}
                  </button>
                ))}
              </div>

              {mode === 'assign' && (
                <div className="space-y-2">
                  {pillars.length === 0 ? (
                    <p className="text-[12px] text-ink-4">{t('orphan_no_pillars')}</p>
                  ) : (
                    <>
                      <select value={assignPillarId} onChange={(e) => setAssignPillarId(e.target.value)}
                        className="w-full rounded-lg border border-rule bg-bg px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-ink-3">
                        {pillars.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                      <Button variant="primary" disabled={!assignPillarId || pending} onClick={assign} className="w-full">
                        {pending ? '…' : t('orphan_assign_confirm')}
                      </Button>
                    </>
                  )}
                </div>
              )}

              {mode === 'new-pillar' && (
                <form onSubmit={createAndAssign} className="space-y-2">
                  <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required
                    placeholder={t('orphan_pillar_title')}
                    className="w-full rounded-lg border border-rule bg-bg px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-ink-3" />
                  <input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder={t('orphan_pillar_keyword')}
                    className="w-full rounded-lg border border-rule bg-bg px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-ink-3" />
                  <Button type="submit" variant="primary" disabled={!newTitle.trim() || pending} className="w-full">
                    {pending ? '…' : t('orphan_assign_confirm')}
                  </Button>
                </form>
              )}
            </div>
          </>
        )}

        {error && <p className="text-[12px] text-rust">{error}</p>}
      </div>
    </aside>
    </>
  )
}

function FieldInline({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-[0.12em] text-ink-4 font-medium">{label}</div>
      {children}
    </div>
  )
}
