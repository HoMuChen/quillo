'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, X, ExternalLink } from 'lucide-react'

type Connection = {
  id: string
  name: string
  platform: string
  last_tested_at: string | null
  last_test_ok: boolean | null
}

type Target = {
  id: string
  remote_post_id: string | null
  remote_url: string | null
  remote_status: string | null
  published_at: string | null
  scheduled_for: string | null
} | null

type Log = {
  id: string
  action: string
  status: string
  error_message: string | null
  created_at: string
}

export function PublishPanel({
  articleId,
  articleStatus,
  connection,
  target,
  logs,
  settingsHref,
}: {
  articleId: string
  articleStatus: string
  connection: Connection
  target: Target
  logs: Log[]
  settingsHref: string
}) {
  const t = useTranslations('publish')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function publish(action: 'publish' | 'draft' | 'unpublish') {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/publish/ghost', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ articleId, connectionId: connection.id, action }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'publish failed')
        setMessage(action === 'unpublish' ? t('msg_unpublished') : t('msg_published'))
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : t('error_generic'))
      }
    })
  }

  const contentReady = articleStatus === 'editing' || articleStatus === 'draft_ready'
  const hasRemote = Boolean(target?.remote_post_id && target.remote_status !== 'unpublished')

  return (
    <section className="space-y-6 max-w-3xl">
      <div>
        <h2 className="font-sans font-semibold text-[18px] text-ink tracking-tight">{t('tab_title')}</h2>
        <p className="text-[12px] text-ink-3">{t('tab_subtitle')}</p>
      </div>

      {/* Connection bar */}
      <div className="rounded-xl border border-rule bg-bg p-4 shadow-sh-1 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-4">Ghost</div>
          <div className="text-[13px] text-ink font-medium">{connection.name}</div>
        </div>
        <Link href={settingsHref} className="text-[11px] text-ink-3 underline hover:text-ink">
          {t('manage_connection')}
        </Link>
      </div>

      {/* Status card */}
      <div className="rounded-xl border border-rule bg-bg p-5 shadow-sh-1 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-ink-4">{t('status')}</div>
            <RemoteStatusChip target={target} />
          </div>
          {target?.remote_url && (
            <a
              href={target.remote_url}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 text-[12px] text-ochre-ink hover:underline"
            >
              {t('view_live')} <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        {target?.published_at && (
          <div className="font-mono text-[11px] text-ink-3">
            {t('published_at')}: {new Date(target.published_at).toISOString().slice(0, 16).replace('T', ' ')}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {!contentReady && (
          <p className="text-[12px] text-rust">{t('warning_not_ready')}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            disabled={!contentReady || pending}
            onClick={() => publish('publish')}
          >
            {pending ? '...' : hasRemote ? t('republish') : t('publish')}
          </Button>
          <Button
            variant="default"
            disabled={!contentReady || pending}
            onClick={() => publish('draft')}
          >
            {pending ? '...' : t('save_as_draft')}
          </Button>
          {hasRemote && (
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => publish('unpublish')}
            >
              {pending ? '...' : t('unpublish')}
            </Button>
          )}
          <Button variant="ghost" disabled title="Coming in M2">
            {t('schedule')} <span className="ml-1 font-mono text-[10px] opacity-60">M2</span>
          </Button>
        </div>
        {message && <p className="text-[12px] text-sage">{message}</p>}
        {error && <p className="text-[12px] text-rust" role="alert">{error}</p>}
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-[0.14em] text-ink-4">{t('logs_title')}</h3>
          <ul className="rounded-xl border border-rule bg-bg shadow-sh-1 divide-y divide-rule/60">
            {logs.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-3 px-4 py-2 text-[12px]">
                <div className="flex items-center gap-3">
                  {log.status === 'success' ? (
                    <Check className="w-3 h-3 text-sage" />
                  ) : (
                    <X className="w-3 h-3 text-rust" />
                  )}
                  <span className="font-mono text-[11px] text-ink-3 uppercase tracking-[0.1em]">{log.action}</span>
                  {log.error_message && (
                    <span className="text-[11px] text-rust truncate max-w-[320px]" title={log.error_message}>
                      {log.error_message}
                    </span>
                  )}
                </div>
                <span className="font-mono text-[11px] text-ink-4">
                  {new Date(log.created_at).toISOString().slice(0, 16).replace('T', ' ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function RemoteStatusChip({ target }: { target: Target }) {
  const t = useTranslations('publish')
  if (!target || !target.remote_status || target.remote_status === 'unpublished') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.14em] px-2 py-0.5 rounded-full border border-rule bg-bg text-ink-3">
        <span className="w-1.5 h-1.5 rounded-full bg-ink-3" />
        {t('status_not_published')}
      </span>
    )
  }
  const cls = {
    draft:     'bg-bg-2 border-rule text-ochre-ink',
    published: 'bg-ink text-bg border-ink',
    scheduled: 'bg-bg border-ochre text-ochre-ink',
  }[target.remote_status] ?? 'bg-bg border-rule text-ink-3'
  const dot = target.remote_status === 'published' ? 'bg-ochre' : 'bg-ochre'
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.14em] px-2 py-0.5 rounded-full border',
      cls,
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />
      {target.remote_status}
    </span>
  )
}
