'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { syncGhostArticlesAction } from './planning-actions'

export function SyncGhostButton({ projectId }: { projectId: string }) {
  const t = useTranslations('planning')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function sync() {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await syncGhostArticlesAction(projectId)
        setMessage(t('sync_done', { count: result.imported }))
        router.refresh()
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Error')
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="default" onClick={sync} disabled={pending}>
        <RefreshCw className={`w-3 h-3 mr-1.5 ${pending ? 'animate-spin' : ''}`} />
        {pending ? t('syncing') : t('sync_ghost')}
      </Button>
      {message && (
        <span className="text-[11px] text-ink-3">{message}</span>
      )}
    </div>
  )
}
