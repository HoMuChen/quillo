'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'

export function EditorTab({
  projectId: _projectId,
  articleId,
  status,
  bodyMarkdown,
  bodyTiptap,
}: {
  projectId: string
  articleId: string
  status: string
  bodyMarkdown: string | null
  bodyTiptap: unknown
}) {
  const t = useTranslations('articles')
  const router = useRouter()
  const [streaming, setStreaming] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function generateDraft() {
    setError(null)
    setStreaming(true)
    setStreamedText('')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ articleId }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw new Error(await res.text())
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        setStreamedText((prev) => prev + decoder.decode(value, { stream: true }))
      }
      // Once stream ends, server-side onFinish persists body_markdown + status.
      router.refresh()
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

  // State 1: no body yet → generate view (or in-progress)
  if (!bodyMarkdown && !bodyTiptap) {
    return (
      <section className="space-y-5">
        <div>
          <h2 className="font-serif italic text-[22px] text-ink">{t('draft_title')}</h2>
          <p className="text-[12px] text-ink-3">{t('draft_subtitle')}</p>
        </div>

        {!streaming && !streamedText && (
          <Button variant="primary" size="lg" onClick={generateDraft} disabled={status === 'drafting'}>
            <Sparkles className="w-4 h-4 mr-2" />
            {t('draft_generate')}
          </Button>
        )}

        {streaming && (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 text-[12px] text-ochre-2">
              <span className="w-2 h-2 rounded-full bg-ochre animate-pulse" />
              {t('generating')} — {t('draft_generating_warning')}
            </span>
            <Button variant="ghost" size="sm" onClick={cancel}>{t('cancel')}</Button>
          </div>
        )}

        {streamedText && (
          <article className="rounded-xl border border-rule bg-bg p-5 shadow-sh-1 whitespace-pre-wrap font-mono text-[12px] text-ink leading-[1.65]">
            {streamedText}
          </article>
        )}

        {error && <p className="text-[12px] text-rust" role="alert">{error}</p>}
      </section>
    )
  }

  // State 2: body_markdown exists but body_tiptap null → show preview and "enter editor" CTA
  if (bodyMarkdown && !bodyTiptap) {
    return (
      <section className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif italic text-[22px] text-ink">{t('draft_ready_title')}</h2>
            <p className="text-[12px] text-ink-3">{t('draft_ready_subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="default" onClick={generateDraft}>{t('draft_regenerate')}</Button>
            <EnterEditorCTA disabled />
          </div>
        </div>

        <article className="rounded-xl border border-rule bg-bg p-6 shadow-sh-1 max-h-[60vh] overflow-auto">
          <MarkdownPreview md={bodyMarkdown} />
        </article>

        <p className="text-[11px] text-ink-4 uppercase tracking-[0.14em]">
          {t('editor_coming_soon')}
        </p>
      </section>
    )
  }

  // State 3: both exist → editor (placeholder; Task 43-44 replaces)
  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-serif italic text-[22px] text-ink">{t('editor_title')}</h2>
      </div>
      <div className="rounded-xl border border-rule border-dashed bg-bg p-10 text-center text-ink-3">
        <p className="text-[13px]">Tiptap editor — coming in Task 43-44</p>
        <p className="text-[11px] text-ink-4 mt-1 font-mono">body_markdown length: {(bodyMarkdown ?? '').length}</p>
      </div>
    </section>
  )
}

function EnterEditorCTA({ disabled }: { disabled?: boolean }) {
  const t = useTranslations('articles')
  return (
    <Button variant="primary" disabled={disabled} title={disabled ? 'Task 43-44' : undefined}>
      {t('enter_editor')}
    </Button>
  )
}

// Very light markdown preview — real Tiptap in Task 43-44 supersedes this.
function MarkdownPreview({ md }: { md: string }) {
  // Split by ## headings for readability
  const parts = md.split(/\n(?=## )/)
  return (
    <div className="space-y-4">
      {parts.map((part, i) => {
        const m = part.match(/^## (.+)\n([\s\S]*)/)
        if (!m) {
          return (
            <p key={i} className="text-[14px] leading-[1.7] text-ink-2 whitespace-pre-wrap">{part.trim()}</p>
          )
        }
        const [, title, body] = m
        return (
          <div key={i}>
            <h3 className="font-serif italic text-[22px] text-ink mt-4 mb-2">{title}</h3>
            <div className="text-[14px] leading-[1.7] text-ink-2 whitespace-pre-wrap">{body.trim()}</div>
          </div>
        )
      })}
    </div>
  )
}
