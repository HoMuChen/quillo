'use client'

import { useRef, useState, useTransition } from 'react'
import NextImage from 'next/image'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { ImageIcon, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUploadUrlAction, saveImageAction, clearFeatureImageAction } from './editor/upload-actions'

export function FeatureImage({
  projectId,
  articleId,
  featureImageUrl,
}: {
  projectId: string
  articleId: string
  featureImageUrl: string | null
}) {
  const t = useTranslations('articles')
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null); setUploading(true)
    try {
      const { path, signedUrl, token } = await getUploadUrlAction(articleId, file.type, file.size, 'feature')
      const res = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type, Authorization: `Bearer ${token}` },
        body: file,
      })
      if (!res.ok) throw new Error(await res.text())
      await saveImageAction(projectId, articleId, path, 'feature')
    } catch (err) {
      console.error(err)
      setError(t('feature_image_error'))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function clear() {
    startTransition(async () => {
      try { await clearFeatureImageAction(projectId, articleId) }
      catch (err) { console.error(err) }
    })
  }

  return (
    <div className="rounded-xl border border-rule bg-bg p-3 shadow-sh-1">
      {featureImageUrl ? (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-lg aspect-[16/9]">
            <NextImage src={featureImageUrl} alt="" fill className="object-cover" unoptimized />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[0.14em] text-ink-4">{t('feature_image')}</span>
            <div className="flex gap-2">
              <Button variant="default" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
                {t('feature_image_replace')}
              </Button>
              <Button variant="ghost" size="sm" onClick={clear} disabled={pending}>
                <X className="w-3 h-3 mr-1" />
                {t('feature_image_remove')}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            'w-full aspect-[16/5] rounded-lg border border-dashed border-rule flex flex-col items-center justify-center gap-2 text-ink-3 hover:bg-mist hover:text-ink transition-colors',
            uploading && 'opacity-50',
          )}
          disabled={uploading}
        >
          <ImageIcon className="w-5 h-5" />
          <span className="text-[12px]">{uploading ? t('feature_image_uploading') : t('feature_image_upload')}</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={handlePick}
      />
      {error && <p className="text-[11px] text-rust mt-2" role="alert">{error}</p>}
    </div>
  )
}
