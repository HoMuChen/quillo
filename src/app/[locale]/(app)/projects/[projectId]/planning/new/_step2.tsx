'use client'

import { useEffect, useState, useTransition } from 'react'
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
  orphanArticles,
}: {
  projectId: string
  locale: 'zh-TW' | 'en'
  direction: string
  orphanArticles: OrphanArticle[]
}) {
  const t = useTranslations('planning')
  const router = useRouter()
  const [saving, startSaving] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)

  const { object, submit, isLoading, error: streamError } = useObject({
    api: '/api/ai/plan/step2',
    schema: pillarPlanSchema,
  })

  // orphanAssignments: articleId → pillarIndex (0-based)
  const [orphanAssignments, setOrphanAssignments] = useState<Record<string, number>>({})

  function toggleOrphan(articleId: string, pillarIndex: number) {
    setOrphanAssignments(prev => {
      if (prev[articleId] === pillarIndex) {
        const next = { ...prev }; delete next[articleId]; return next
      }
      return { ...prev, [articleId]: pillarIndex }
    })
  }

  // Kick off generation once on mount
  useEffect(() => {
    submit({ projectId, direction })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const error = actionError ?? (streamError ? t('error_generic') : null)

  function onSave() {
    if (!object) return
    setActionError(null)
    startSaving(async () => {
      try {
        const parsed = pillarPlanSchema.parse(object)
        await savePlanAction(locale, projectId, parsed, orphanAssignments)
        router.replace(`/projects/${projectId}/planning`)
      } catch (err) {
        console.error(err)
        setActionError(t('error_generic'))
      }
    })
  }

  const pillars = object?.pillars ?? []

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
          <PillarCard key={i} index={i} pillar={p} />
        ))}
      </div>

      {orphanArticles.length > 0 && pillars.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sh-1 space-y-3">
          <div>
            <p className="text-[13px] font-medium text-ink">{t('orphan_include_existing')}</p>
            <p className="text-[11px] text-ink-4 mt-0.5">{t('orphan_include_existing_help')}</p>
          </div>
          <div className="space-y-1">
            {orphanArticles.map((o) => (
              <div key={o.id} className="flex items-center gap-3 py-1.5 border-b border-rule/40 last:border-0">
                <span className="flex-1 text-[13px] text-ink truncate">
                  {o.target_keyword || o.title}
                  {o.target_keyword && <span className="ml-2 font-mono text-[10px] text-ink-4 truncate">{o.title}</span>}
                </span>
                <select
                  value={orphanAssignments[o.id] ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setOrphanAssignments(prev => {
                      const next = { ...prev }
                      if (v === '') delete next[o.id]
                      else next[o.id] = Number(v)
                      return next
                    })
                  }}
                  className="rounded-lg border border-rule bg-bg px-2 py-1 text-[12px] text-ink focus:outline-none focus:border-ink-3 min-w-[140px]"
                >
                  <option value="">{t('orphan_no_assign')}</option>
                  {pillars.map((p, i) => (
                    <option key={i} value={i}>{p?.title ?? `Pillar ${i + 1}`}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

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
}: {
  index: number
  pillar: DeepPartial<PillarPlan['pillars'][number]> | undefined
}) {
  const color = PILLAR_COLORS[index % PILLAR_COLORS.length]
  const textMap = { p1: 'text-p1', p2: 'text-p2', p3: 'text-p3' }

  if (!pillar) return null

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
