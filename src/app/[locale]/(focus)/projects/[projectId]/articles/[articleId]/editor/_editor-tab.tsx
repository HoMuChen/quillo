'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Sparkles } from 'lucide-react'
import { TiptapEditor } from '@/components/tiptap/editor'
import { saveArticleBodyAction } from './actions'
import { getUploadUrlAction, saveImageAction, updateImageAltByUrlAction } from './upload-actions'

/**
 * The editor phase of the article page — just the Tiptap surface.
 * Draft generation (formerly "state A" here) now lives in InterviewTab,
 * which owns the whole pre-body flow (outline → questions → generate).
 * When the draft is created, router.refresh() makes body non-null and
 * the parent page renders this component instead.
 */
export function EditorTab({
  projectId,
  articleId,
  bodyMarkdown,
  bodyTiptap,
}: {
  projectId: string
  articleId: string
  bodyMarkdown: string | null
  bodyTiptap: unknown
}) {
  const t = useTranslations('articles')

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

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Link
          href={`/projects/${projectId}/articles/${articleId}?view=interview`}
          className="inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ochre-ink transition-colors"
        >
          <Sparkles className="w-3 h-3" />
          {t('editor_use_interview')}
        </Link>
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
    </div>
  )
}
