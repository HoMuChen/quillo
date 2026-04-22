'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import { Button } from '@/components/ui/button'
import { Sparkles, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { analyzeBrandSchema, type AnalyzeBrandResult } from '@/lib/ai/schemas'

type Article = { id: string; title: string; target_keyword: string | null }

export function AnalyzeFromArticlesButton({
  projectId,
  articles,
  onApply,
}: {
  projectId: string
  articles: Article[]
  onApply: (result: AnalyzeBrandResult) => void
}) {
  const t = useTranslations('brand')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { object, submit, isLoading, error: streamError } = useObject({
    api: '/api/ai/analyze-brand',
    schema: analyzeBrandSchema,
  })

  const allSelected = articles.length > 0 && selected.size === articles.length
  const hasResult = !!object && !isLoading

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(articles.map((a) => a.id)))
  }

  function toggleOne(id: string) {
    const next = new Set(selected)
    if (next.has(id)) { next.delete(id) } else { next.add(id) }
    setSelected(next)
  }

  function analyze() {
    submit({ projectId, articleIds: Array.from(selected) })
  }

  function apply() {
    if (!object) return
    onApply(object as AnalyzeBrandResult)
    setOpen(false)
  }

  function close() {
    if (isLoading) return
    setOpen(false)
  }

  return (
    <>
      <Button type="button" variant="default" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="w-3 h-3 mr-1.5" />
        {t('analyze_btn')}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={close} />

          <div className="relative bg-bg rounded-2xl border border-rule shadow-sh-3 w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden">
            <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-rule shrink-0">
              <div>
                <h2 className="font-serif italic text-[22px] text-ink">{t('analyze_title')}</h2>
                <p className="text-[12px] text-ink-3 mt-0.5">{t('analyze_subtitle')}</p>
              </div>
              <button type="button" onClick={close} className="p-1 text-ink-3 hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="flex-1 overflow-auto p-6 space-y-5">
              {/* Article picker — hide once analysis starts */}
              {!object && !isLoading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-4">
                      {t('analyze_pick')}
                    </p>
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="text-[11px] text-ochre-ink hover:text-ochre cursor-pointer"
                    >
                      {allSelected ? t('analyze_deselect_all') : t('analyze_select_all')}
                    </button>
                  </div>
                  <div className="divide-y divide-rule/60 rounded-xl border border-rule overflow-hidden">
                    {articles.map((a) => (
                      <label
                        key={a.id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-mist cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(a.id)}
                          onChange={() => toggleOne(a.id)}
                          className="accent-ochre w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block truncate text-[13px] text-ink">{a.title}</span>
                          {a.target_keyword && (
                            <span className="font-mono text-[10px] text-ink-4">{a.target_keyword}</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading pulse */}
              {isLoading && !object && (
                <div className="flex items-center gap-2 text-[12px] text-ochre-2">
                  <span className="w-2 h-2 rounded-full bg-ochre animate-pulse" />
                  {t('analyzing')}
                </div>
              )}

              {streamError && (
                <p className="text-[12px] text-rust">{String(streamError)}</p>
              )}

              {/* Streaming / complete result preview */}
              {object && (
                <div className="space-y-4">
                  {isLoading && (
                    <div className="flex items-center gap-2 text-[12px] text-ochre-2">
                      <span className="w-2 h-2 rounded-full bg-ochre animate-pulse" />
                      {t('analyzing')}
                    </div>
                  )}
                  {!isLoading && (
                    <div className="flex items-center gap-1.5 text-[12px] text-sage-ink">
                      <Check className="w-3 h-3" /> {t('analyze_done')}
                    </div>
                  )}

                  {object.tone && (
                    <PreviewField label={t('analyze_tone_preview')} text={object.tone} />
                  )}
                  {object.author_background && (
                    <PreviewField label={t('analyze_background')} text={object.author_background} />
                  )}
                  {object.reader_persona && (
                    <PreviewField label={t('analyze_persona')} text={object.reader_persona} />
                  )}
                  {(object.preferred_terms ?? []).length > 0 && (
                    <PreviewChips label={t('analyze_preferred')} items={(object.preferred_terms ?? []).filter((t): t is string => !!t)} color="ochre" />
                  )}
                  {(object.forbidden_terms ?? []).length > 0 && (
                    <PreviewChips label={t('analyze_forbidden')} items={(object.forbidden_terms ?? []).filter((t): t is string => !!t)} color="rust" />
                  )}
                  {object.ee_at_cases && (
                    <PreviewField label={t('analyze_ee_at')} text={object.ee_at_cases} />
                  )}
                </div>
              )}
            </div>

            <footer className="px-6 py-4 border-t border-rule flex items-center justify-between gap-3 shrink-0">
              <Button variant="default" size="sm" onClick={close} disabled={isLoading}>
                {t('cancel')}
              </Button>
              {!object && !isLoading && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={selected.size === 0}
                  onClick={analyze}
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  {t('analyze_start')} ({selected.size})
                </Button>
              )}
              {hasResult && (
                <Button variant="primary" size="sm" onClick={apply}>
                  <Check className="w-3 h-3 mr-1" />
                  {t('analyze_apply')}
                </Button>
              )}
            </footer>
          </div>
        </div>
      )}
    </>
  )
}

function PreviewField({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-4">{label}</p>
      <p className="text-[13px] text-ink-2 leading-[1.55] whitespace-pre-wrap">{text}</p>
    </div>
  )
}

function PreviewChips({ label, items, color }: { label: string; items: string[]; color: 'ochre' | 'rust' }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-4">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className={cn(
              'font-mono text-[11px] px-2 py-0.5 rounded-md border',
              color === 'rust' ? 'bg-bg-2 border-rule text-rust' : 'bg-bg-2 border-rule text-ochre-ink',
            )}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
