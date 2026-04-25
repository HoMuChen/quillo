'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import { Button } from '@/components/ui/button'
import { Sparkles, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { organizeOrphansSchema, type OrganizePlan } from '@/lib/ai/schemas'
import type { OrphanArticle } from '@/lib/planning'
import { applyOrganizeAction } from './planning-actions'

type Pillar = {
  id: string
  title: string
  target_keyword: string | null
}

export function OrganizeOrphansButton({
  projectId,
  orphanArticles,
  pillars,
}: {
  projectId: string
  orphanArticles: OrphanArticle[]
  pillars: Pillar[]
}) {
  const t = useTranslations('planning')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [applying, startApply] = useTransition()

  const { object, submit, isLoading, error: streamError } = useObject({
    api: '/api/ai/organize-orphans',
    schema: organizeOrphansSchema,
  })

  const articleById = new Map(orphanArticles.map((a) => [a.id, a]))
  const pillarById = new Map(pillars.map((p) => [p.id, p]))

  const totalAssigned = (object?.new_pillars ?? []).reduce((n, p) => n + (p?.article_ids?.length ?? 0), 0)
    + (object?.existing_assignments ?? []).length

  function start() {
    setOpen(true)
    submit({ projectId, orphanArticles, pillars })
  }

  function apply() {
    if (!object) return
    startApply(async () => {
      try {
        await applyOrganizeAction(projectId, object as OrganizePlan)
        setOpen(false)
        router.refresh()
      } catch (err) {
        console.error(err)
      }
    })
  }

  return (
    <>
      <Button variant="default" onClick={start}>
        <Sparkles className="w-3 h-3 mr-1.5" />
        {t('organize_orphans')}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={() => !isLoading && !applying && setOpen(false)} />

          {/* Modal */}
          <div className="relative bg-bg rounded-2xl border border-rule shadow-sh-3 w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-rule shrink-0">
              <div>
                <h2 className="font-serif italic text-[22px] text-ink">{t('organize_orphans')}</h2>
                <p className="text-[12px] text-ink-3 mt-0.5">{t('organize_orphans_subtitle')}</p>
              </div>
              <button type="button" onClick={() => !isLoading && !applying && setOpen(false)}
                className="p-1 text-ink-3 hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="flex-1 overflow-auto p-6 space-y-5">
              {isLoading && !object && (
                <div className="flex items-center gap-2 text-[12px] text-ochre-2">
                  <span className="w-2 h-2 rounded-full bg-ochre animate-pulse" />
                  {t('generating')}
                </div>
              )}

              {streamError && (
                <p className="text-[12px] text-rust">{t('error_generic')}</p>
              )}

              {/* New pillars */}
              {(object?.new_pillars ?? []).length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-ink-4">{t('organize_new_pillars')}</p>
                  {(object?.new_pillars ?? []).map((p, i) => {
                    if (!p) return null
                    const count = p.article_ids?.length ?? 0
                    const valid = count >= 3
                    return (
                      <div key={i} className={cn('rounded-xl border p-4 space-y-2',
                        valid ? 'border-rule bg-bg' : 'border-rule/40 bg-bg opacity-50')}>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="font-medium text-[14px] text-ink">{p.title ?? '…'}</span>
                            {p.target_keyword && (
                              <span className="ml-2 font-mono text-[10px] text-ink-4">{p.target_keyword}</span>
                            )}
                          </div>
                          <span className={cn('font-mono text-[11px]', valid ? 'text-sage' : 'text-rust')}>
                            {count} 篇{!valid && ' (需 ≥3)'}
                          </span>
                        </div>
                        {(p.article_ids ?? []).length > 0 && (
                          <ul className="space-y-0.5 border-t border-rule/40 pt-2">
                            {(p.article_ids ?? []).map((id) => {
                              const a = id ? articleById.get(id) : undefined
                              return (
                                <li key={i + '-' + id} className="text-[12px] text-ink-2 flex items-center gap-1.5">
                                  <Check className="w-3 h-3 text-sage shrink-0" />
                                  {a?.target_keyword || a?.title || id}
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Existing pillar assignments */}
              {(object?.existing_assignments ?? []).length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-ink-4">{t('organize_existing_pillars')}</p>
                  {(object?.existing_assignments ?? []).map((ea, i) => {
                    if (!ea) return null
                    const a = ea.article_id ? articleById.get(ea.article_id) : undefined
                    const p = ea.pillar_id ? pillarById.get(ea.pillar_id) : undefined
                    return (
                      <div key={i} className="flex items-center gap-2 text-[12px] text-ink-2">
                        <Check className="w-3 h-3 text-sage shrink-0" />
                        <span className="flex-1">{a?.target_keyword || a?.title || ea.article_id}</span>
                        <span className="text-ink-4">→</span>
                        <span className="font-medium text-ink">{p?.title ?? ea.pillar_id}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {!isLoading && object && totalAssigned === 0 && (
                <p className="text-[13px] text-ink-3">{t('organize_nothing')}</p>
              )}
            </div>

            {!isLoading && object && totalAssigned > 0 && (
              <footer className="px-6 py-4 border-t border-rule flex items-center justify-between gap-3 shrink-0">
                <p className="text-[12px] text-ink-4">
                  {t('organize_summary', { count: totalAssigned })}
                </p>
                <div className="flex gap-2">
                  <Button variant="default" onClick={() => setOpen(false)} disabled={applying}>
                    {t('cancel')}
                  </Button>
                  <Button variant="primary" onClick={apply} disabled={applying}>
                    {applying ? '…' : t('organize_apply')}
                  </Button>
                </div>
              </footer>
            )}
          </div>
        </div>
      )}
    </>
  )
}
