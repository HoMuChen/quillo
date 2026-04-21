'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PlanStep2 } from './_step2'

type OrphanArticle = { id: string; title: string; target_keyword: string | null; slug: string | null }

export function PlanWizard({ projectId, locale, orphanArticles }: { projectId: string; locale: 'zh-TW' | 'en'; orphanArticles: OrphanArticle[] }) {
  const t = useTranslations('planning')
  const [step, setStep] = useState<1 | 2>(1)
  const [topic, setTopic] = useState('')
  const [audience, setAudience] = useState('')
  const [direction, setDirection] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function runStep1() {
    setError(null)
    setDirection('')
    setStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/ai/plan/step1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, topic, audience_supplement: audience || undefined }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw new Error(await res.text())

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        setDirection((prev) => prev + decoder.decode(value, { stream: true }))
      }
    } catch (err) {
      if ((err as { name?: string }).name !== 'AbortError') {
        console.error(err)
        setError(t('error_generic'))
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function cancel() {
    abortRef.current?.abort()
  }

  if (step === 1) {
    return (
      <section className="space-y-5">
        <div className="space-y-1.5">
          <p className="font-serif italic text-[22px] text-ink">{t('step1_heading')}</p>
          <p className="text-[13px] text-ink-3">{t('step1_intro')}</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="topic">{t('topic_label')}</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t('topic_placeholder')}
              disabled={streaming}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audience">{t('audience_label')}</Label>
            <Input
              id="audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder={t('audience_placeholder')}
              disabled={streaming}
            />
          </div>
        </div>

        {direction && (
          <article className="rounded-xl border border-rule bg-bg p-5 shadow-sh-1 whitespace-pre-wrap text-[14px] text-ink leading-[1.6]">
            {direction}
          </article>
        )}

        {error && <p className="text-[12px] text-rust" role="alert">{error}</p>}

        <div className="flex gap-2">
          {!streaming && !direction && (
            <Button variant="primary" disabled={!topic.trim()} onClick={runStep1}>
              ✦ {t('generate')}
            </Button>
          )}
          {!streaming && direction && (
            <>
              <Button variant="default" onClick={runStep1}>{t('regenerate')}</Button>
              <Button variant="primary" onClick={() => setStep(2)}>{t('accept_continue')}</Button>
            </>
          )}
          {streaming && (
            <>
              <span className="inline-flex items-center gap-2 text-[12px] text-ochre-ink">
                <span className="w-2 h-2 rounded-full bg-ochre animate-pulse" />
                {t('generating')}
              </span>
              <Button variant="ghost" onClick={cancel}>{t('cancel')}</Button>
            </>
          )}
        </div>
      </section>
    )
  }

  return <PlanStep2 projectId={projectId} locale={locale} direction={direction} orphanArticles={orphanArticles} />
}
