'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { TiptapEditor } from '@/components/tiptap/editor'
import { saveArticleBodyAction } from './actions'
import { getUploadUrlAction, saveImageAction, updateImageAltByUrlAction } from './upload-actions'

export function EditorTab({
  projectId,
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

  async function handleImageUpload(file: File): Promise<string> {
    const { path, signedUrl, token } = await getUploadUrlAction(articleId, file.type, file.size, 'inline')
    const upload = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type, Authorization: `Bearer ${token}` },
      body: file,
    })
    if (!upload.ok) throw new Error('upload failed')
    const { url } = await saveImageAction(projectId, articleId, path, 'inline')
    return url
  }

  async function handleRewrite(selectedText: string, instruction: string): Promise<Response> {
    return fetch('/api/ai/rewrite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId, selectedText, instruction }),
    })
  }

  async function handleUpdateImageAlt(src: string, alt: string): Promise<void> {
    await updateImageAltByUrlAction(projectId, articleId, src, alt)
  }

  // State A: no body yet → draft generation flow
  if (!bodyMarkdown && !bodyTiptap) {
    return (
      <section className="space-y-5">
        <div>
          <h2 className="font-sans font-semibold text-[18px] text-ink tracking-tight">{t('draft_title')}</h2>
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
            <span className="inline-flex items-center gap-2 text-[12px] text-ochre-ink">
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

  // State B: body exists → real Tiptap editor
  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-sans font-semibold text-[18px] text-ink tracking-tight">{t('editor_title')}</h2>
          <p className="text-[12px] text-ink-3">{t('editor_subtitle')}</p>
        </div>
        <Button variant="default" onClick={generateDraft} disabled={streaming}>
          <Sparkles className="w-3.5 h-3.5 mr-1" />
          {t('draft_regenerate')}
        </Button>
      </div>

      <TiptapEditor
        initialTiptap={bodyTiptap}
        initialMarkdown={bodyMarkdown}
        onSave={async (tiptapDoc, md) => {
          await saveArticleBodyAction(projectId, articleId, tiptapDoc, md)
        }}
        onUploadImage={handleImageUpload}
        onRewrite={handleRewrite}
        onUpdateImageAlt={handleUpdateImageAlt}
        placeholder={t('editor_placeholder')}
      />
    </section>
  )
}
