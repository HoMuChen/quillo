'use client'

import { useEffect, useState, useTransition } from 'react'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { clusterArticlesSchema, type ClusterArticles } from '@/lib/ai/schemas'
import { regenerateClusterAction } from './planning-actions'

export function RegenerateClusterOverlay({
  projectId,
  pillarId,
  pillarTitle,
  onClose,
}: {
  projectId: string
  pillarId: string
  pillarTitle: string
  onClose: () => void
}) {
  const t = useTranslations('planning')
  const [saving, startSaving] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const { object, submit, isLoading, error: streamError } = useObject({
    api: '/api/ai/plan/regenerate-cluster',
    schema: clusterArticlesSchema,
  })

  useEffect(() => {
    submit({ projectId, pillarId })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (streamError) setError(t('error_generic'))
  }, [streamError, t])

  function onAccept() {
    if (!object) return
    setError(null)
    startSaving(async () => {
      try {
        const parsed = clusterArticlesSchema.parse(object)
        await regenerateClusterAction(projectId, pillarId, parsed.articles)
        onClose()
      } catch (err) {
        console.error(err)
        setError(t('error_generic'))
      }
    })
  }

  const articles: ClusterArticles['articles'] = (object?.articles as ClusterArticles['articles'] | undefined) ?? []

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-xl border border-rule bg-bg shadow-sh-2 p-6 max-h-[85vh] flex flex-col">
        <header className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-serif italic text-[22px] text-ink">{t('regenerate_title')}</h2>
            <p className="text-[12px] text-ink-3 mt-1">{pillarTitle}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>×</Button>
        </header>

        {isLoading && (
          <div className="flex items-center gap-2 text-[12px] text-ochre-ink mb-3">
            <span className="w-2 h-2 rounded-full bg-ochre animate-pulse" />
            {t('generating')}
          </div>
        )}

        <ul className="flex-1 overflow-auto space-y-1.5 border-t border-rule/60 pt-3">
          {articles.map((a, i) => (
            <li key={i} className="flex items-start justify-between gap-3 py-2 text-[13px]">
              <div className="min-w-0 flex-1">
                <div className="text-ink font-medium truncate">{a?.title ?? '…'}</div>
                {a?.target_keyword && <div className="font-mono text-[10px] text-ink-3 truncate">{a.target_keyword}</div>}
              </div>
              {a?.role && (
                <span className={`font-mono text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border ${
                  a.role === 'hub' ? 'bg-ink text-bg border-ink' : 'bg-bg border-rule text-ink-3'
                }`}>
                  {a.role}
                </span>
              )}
            </li>
          ))}
        </ul>

        {error && <p className="text-[12px] text-rust mt-3" role="alert">{error}</p>}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('cancel')}</Button>
          <Button variant="primary" onClick={onAccept} disabled={isLoading || saving || articles.length === 0}>
            {saving ? '...' : t('accept_regenerate')}
          </Button>
        </div>
      </div>
    </div>
  )
}
