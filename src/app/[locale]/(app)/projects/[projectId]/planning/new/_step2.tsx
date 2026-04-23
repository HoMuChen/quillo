'use client'

import { useMemo, useState, useTransition } from 'react'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import type { DeepPartial } from 'ai'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { pillarPlanSchema, type PillarPlan } from '@/lib/ai/schemas'
import { savePlanAction } from './actions'

type OrphanArticle = { id: string; title: string; target_keyword: string | null; slug: string | null }

export function PlanStep2({
  projectId,
  locale,
  direction,
  pillarCount,
  orphanArticles,
}: {
  projectId: string
  locale: 'zh-TW' | 'en'
  direction: string
  pillarCount: number
  orphanArticles: OrphanArticle[]
}) {
  const t = useTranslations('planning')
  const router = useRouter()
  const [saving, startSaving] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedOrphans, setSelectedOrphans] = useState<Set<string>>(() => new Set())
  const [started, setStarted] = useState(false)

  const { object, submit, isLoading, error: streamError } = useObject({
    api: '/api/ai/plan/step2',
    schema: pillarPlanSchema,
  })

  const orphansById = useMemo(
    () => new Map(orphanArticles.map((o) => [o.id, o])),
    [orphanArticles],
  )

  function toggleOrphan(id: string) {
    setSelectedOrphans((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedOrphans((prev) =>
      prev.size === orphanArticles.length
        ? new Set()
        : new Set(orphanArticles.map((o) => o.id)),
    )
  }

  function startGeneration() {
    const selected = orphanArticles.filter((o) => selectedOrphans.has(o.id))
    submit({
      projectId,
      direction,
      pillarCount,
      orphanArticles: selected.map((o) => ({
        id: o.id,
        title: o.title,
        target_keyword: o.target_keyword ?? undefined,
      })),
    })
    setStarted(true)
  }

  const error = actionError ?? (streamError ? t('error_generic') : null)

  function onSave() {
    if (!object) return
    setActionError(null)
    startSaving(async () => {
      try {
        const parsed = pillarPlanSchema.parse(object)
        await savePlanAction(locale, projectId, parsed)
        router.replace(`/projects/${projectId}/planning`)
      } catch (err) {
        console.error(err)
        setActionError(t('error_generic'))
      }
    })
  }

  const pillars = object?.pillars ?? []

  // --- Pre-generation config screen ---
  if (!started) {
    return (
      <section className="space-y-5">
        <div className="space-y-1.5">
          <p className="font-serif italic text-[22px] text-ink">{t('step2_heading')}</p>
          <p className="text-[13px] text-ink-3">{t('step2_config_intro', { count: pillarCount })}</p>
        </div>

        {orphanArticles.length > 0 && (
          <div className="rounded-xl bg-white p-5 shadow-sh-1 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-ink">{t('orphan_preassign_title')}</p>
                <p className="text-[11px] text-ink-4 mt-0.5">{t('orphan_preassign_help')}</p>
              </div>
              <button
                type="button"
                onClick={toggleAll}
                className="text-[11px] text-ochre-ink hover:text-ochre cursor-pointer"
              >
                {selectedOrphans.size === orphanArticles.length ? t('orphan_deselect_all') : t('orphan_select_all')}
              </button>
            </div>
            <div className="divide-y divide-rule/40 rounded-lg border border-rule overflow-hidden">
              {orphanArticles.map((o) => (
                <label
                  key={o.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-mist cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedOrphans.has(o.id)}
                    onChange={() => toggleOrphan(o.id)}
                    className="accent-ochre w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="flex-1 min-w-0 text-[13px] text-ink truncate">
                    {o.target_keyword || o.title}
                    {o.target_keyword && (
                      <span className="ml-2 font-mono text-[10px] text-ink-4">{o.title}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="primary" onClick={startGeneration}>
            ✦ {t('generate_plan_btn')}
          </Button>
        </div>
      </section>
    )
  }

  // --- Generation / result screen ---
  return (
    <section className="space-y-5">
      <div className="space-y-1.5">
        <p className="font-serif italic text-[22px] text-ink">{t('step2_heading')}</p>
        <p className="text-[13px] text-ink-3">{t('step2_intro')}</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-[12px] text-ochre-ink">
          <span className="w-2 h-2 rounded-full bg-ochre animate-pulse" />
          {t('generating')}
        </div>
      )}

      <div className="space-y-4">
        {pillars.map((p, i) => (
          <PillarCard key={i} index={i} pillar={p} orphansById={orphansById} />
        ))}
      </div>

      {error && <p className="text-[12px] text-rust" role="alert">{error}</p>}

      {!isLoading && object && (
        <div className="flex gap-2">
          <Button variant="primary" onClick={onSave} disabled={saving}>
            {saving ? t('saving_plan') : t('save_plan')}
          </Button>
        </div>
      )}
    </section>
  )
}

const PILLAR_COLORS = ['p1', 'p2', 'p3'] as const

function PillarCard({
  index,
  pillar,
  orphansById,
}: {
  index: number
  pillar: DeepPartial<PillarPlan['pillars'][number]> | undefined
  orphansById: Map<string, OrphanArticle>
}) {
  const color = PILLAR_COLORS[index % PILLAR_COLORS.length]
  const textMap = { p1: 'text-p1', p2: 'text-p2', p3: 'text-p3' }

  if (!pillar) return null

  const existingIds = (pillar.existing_article_ids ?? []).filter((id): id is string => !!id)

  return (
    <article className="rounded-xl bg-white p-5 shadow-sh-1 space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className={`font-serif italic text-[22px] leading-tight ${textMap[color]}`}>
            {pillar.title ?? '…'}
          </h3>
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
        <p className="text-[13px] text-ink-2 leading-[1.55]">{pillar.description}</p>
      )}

      {existingIds.length > 0 && (
        <ul className="space-y-1.5 border-t border-rule/60 pt-3">
          {existingIds.map((id) => {
            const o = orphansById.get(id)
            if (!o) return null
            return (
              <li key={id} className="flex items-start justify-between gap-3 text-[13px]">
                <div className="min-w-0 flex-1">
                  <div className="text-ink font-medium truncate">{o.title}</div>
                  {o.target_keyword && (
                    <div className="font-mono text-[10px] text-ink-3 truncate">{o.target_keyword}</div>
                  )}
                </div>
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border bg-bg-2 border-rule text-ink-3">existing</span>
              </li>
            )
          })}
        </ul>
      )}

      {pillar.articles && pillar.articles.length > 0 && (
        <ul className="space-y-1.5 border-t border-rule/60 pt-3">
          {pillar.articles.map((a, i) => (
            <li key={i} className="flex items-start justify-between gap-3 text-[13px]">
              <div className="min-w-0 flex-1">
                <div className="text-ink font-medium truncate">{a?.title ?? '…'}</div>
                {a?.target_keyword && (
                  <div className="font-mono text-[10px] text-ink-3 truncate">{a.target_keyword}</div>
                )}
              </div>
              {a?.role && (
                <span className={`font-mono text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border ${
                  a.role === 'hub' ? 'bg-ink text-bg border-ink' : 'bg-bg border-rule text-ink-3'
                }`}>{a.role}</span>
              )}
            </li>
          ))}
        </ul>
      )}

    </article>
  )
}
