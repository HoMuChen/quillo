'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusLines } from './_connection-ui'
import { disconnectGscAction, syncGscNowAction } from './gsc-actions'

type GscConn = {
  id: string
  google_user_email: string
  property_url: string
  last_synced_at: string | null
  last_sync_status: string | null
  last_sync_error: string | null
} | null

export function GscConnectionCard({
  projectId,
  initial,
}: {
  projectId: string
  initial: GscConn
}) {
  const t = useTranslations('publish')
  const router = useRouter()

  const [syncMessage, setSyncMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncPending, startSync] = useTransition()
  const [disconnectPending, startDisconnect] = useTransition()

  const isRevoked = initial?.last_sync_error === 'refresh_token_revoked'

  function sync() {
    setSyncMessage(null); setError(null)
    startSync(async () => {
      try {
        const result = await syncGscNowAction(projectId)
        setSyncMessage({ ok: true, text: t('gsc_sync_done', { rows: result.rowsInserted }) })
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sync failed')
      }
    })
  }

  function disconnect() {
    startDisconnect(async () => {
      try {
        await disconnectGscAction(projectId)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Disconnect failed')
      }
    })
  }

  return (
    <section className="space-y-4">
      <h2 className="font-sans font-semibold text-[18px] text-ink tracking-tight">{t('gsc_title')}</h2>

      {initial ? (
        <div className="rounded-xl bg-white p-5 shadow-sh-1 space-y-3">
          {isRevoked && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-800">
              <X className="w-3.5 h-3.5 mt-0.5 flex-none" />
              <span>{t('gsc_reconnect_needed')}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[14px] text-ink font-medium">{initial.google_user_email}</div>
              <div className="text-[11px] text-ink-4 mt-0.5">
                {t('gsc_property', { url: initial.property_url })}
              </div>
              <div className="text-[11px] text-ink-4 mt-0.5">
                {initial.last_synced_at
                  ? t('gsc_last_synced', { when: new Date(initial.last_synced_at).toISOString().slice(0, 16).replace('T', ' ') })
                  : t('gsc_never_synced')}
              </div>
            </div>
            <div className="flex gap-2">
              {isRevoked ? (
                <a
                  href={`/api/gsc/oauth/start?projectId=${projectId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-[13px] font-medium text-bg hover:bg-ink-2 transition-colors"
                >
                  {t('gsc_connect')}
                </a>
              ) : (
                <Button variant="default" size="sm" onClick={sync} disabled={syncPending}>
                  <RefreshCw className={cn('w-3 h-3 mr-1', syncPending && 'animate-spin')} />
                  {syncPending ? t('gsc_syncing') : t('gsc_sync_now')}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={disconnect} disabled={disconnectPending}>
                {t('gsc_disconnect')}
              </Button>
            </div>
          </div>
          <StatusLines
            syncMessage={syncMessage}
            error={error}
            testSuccessLabel=""
            testFailedLabel=""
          />
        </div>
      ) : (
        <div className="rounded-xl bg-white p-5 shadow-sh-1">
          <p className="text-[13px] text-ink-3 mb-3">
            {t('gsc_not_connected_body')}
          </p>
          <a
            href={`/api/gsc/oauth/start?projectId=${projectId}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-[13px] font-medium text-bg hover:bg-ink-2 transition-colors"
          >
            {t('gsc_connect')}
          </a>
        </div>
      )}
    </section>
  )
}
