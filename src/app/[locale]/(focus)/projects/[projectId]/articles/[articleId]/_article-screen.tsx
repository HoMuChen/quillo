'use client'

import { useEffect, useState, useTransition } from 'react'
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronLeft, Settings2, X } from 'lucide-react'

type Connection = {
  id: string
  name: string
  platform: string
}

type Target = {
  id: string
  remote_post_id: string | null
  remote_url: string | null
  remote_status: string | null
  published_at: string | null
} | null

type Log = {
  id: string
  action: string
  status: string
  error_message: string | null
  created_at: string
}

type ConnectionWithTarget = {
  connection: Connection
  target: Target
  logs: Log[]
}

type Article = {
  id: string
  title: string
  status: string
  target_keyword: string | null
  word_count_target: number | null
  role: string | null
}

type Pillar = { title: string; href: string } | null

export function ArticleScreen({
  projectId,
  articleId,
  locale,
  article,
  pillar,
  connections,
  featureImageSlot,
  settingsSlot,
  children,
}: {
  projectId: string
  articleId: string
  locale: string
  article: Article
  pillar: Pillar
  connections: ConnectionWithTarget[]
  featureImageSlot: ReactNode
  settingsSlot: ReactNode
  children: ReactNode
}) {
  const t = useTranslations('articles')
  const tpl = useTranslations('planning')
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Shared active platform state so CornerLeft's "view live" link follows the
  // same platform the user is publishing to from CornerRight.
  const [activePlatform, setActivePlatform] = useState<string | null>(
    connections[0]?.connection.platform ?? null,
  )

  return (
    <div className="min-h-screen">
      {/* FLOATING CONTROLS — fixed to the viewport corners. No bar, no
          background; controls sit in whitespace like Ghost. The wrapper
          is pointer-events-none so clicks pass through to content
          underneath; only the groups opt back in. */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-start justify-between px-7 py-5 pointer-events-none">
        <CornerLeft
          projectId={projectId}
          connections={connections}
          activePlatform={activePlatform}
        />
        <CornerRight
          projectId={projectId}
          articleId={articleId}
          article={article}
          connections={connections}
          activePlatform={activePlatform}
          onSetActivePlatform={setActivePlatform}
          onOpenDrawer={() => setDrawerOpen(true)}
        />
      </div>

      {/* CENTERED CONTENT COLUMN — leaves room at top for the floating controls */}
      <div className="max-w-3xl mx-auto px-6 pt-24 pb-16 space-y-8">
        {/* FEATURE IMAGE — same position as Ghost: above title */}
        {featureImageSlot}

        {/* TITLE + META */}
        <header className="space-y-2">
          {pillar && (
            <div className="text-[12px] text-ink-3">
              <span className="text-ink-4">{tpl('pillar_label')}</span>
              {' · '}
              <Link href={pillar.href} className="hover:text-ink-2 transition-colors">{pillar.title}</Link>
            </div>
          )}
          <h1 className="font-serif italic text-[44px] text-ink leading-tight">{article.title}</h1>
          {(article.target_keyword || article.word_count_target || article.role) && (
            <div className="flex items-center gap-3 text-[12px] text-ink-3">
              {article.target_keyword && <span className="font-mono">{article.target_keyword}</span>}
              {article.word_count_target && <span>·  {article.word_count_target} {t('words')}</span>}
              {article.role && <span>·  {article.role}</span>}
            </div>
          )}
        </header>

        {/* MAIN CONTENT (InterviewTab or EditorTab) */}
        <div>{children}</div>
      </div>

      {/* SETTINGS DRAWER — fixed positioning, covers full viewport */}
      <SettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        connections={connections}
        projectId={projectId}
        locale={locale}
      >
        {settingsSlot}
      </SettingsDrawer>
    </div>
  )
}

/* ========================================================================== */
/* CORNER CONTROLS — Ghost-style floating buttons, no bar, no background      */
/* ========================================================================== */

function CornerLeft({
  projectId,
  connections,
  activePlatform,
}: {
  projectId: string
  connections: ConnectionWithTarget[]
  activePlatform: string | null
}) {
  const t = useTranslations('articles')
  const tp = useTranslations('publish')

  // Prefer the currently active platform's target; otherwise fall back to the
  // first connection that has a live URL so we still surface a "view live"
  // link when possible.
  const activeConn = connections.find((c) => c.connection.platform === activePlatform) ?? null
  const liveConn =
    activeConn?.target?.remote_url
      ? activeConn
      : connections.find((c) => c.target?.remote_url) ?? null
  const anyDraft = connections.some((c) => c.target?.remote_status === 'draft')

  return (
    <div className="flex items-center gap-5 pointer-events-auto">
      <Link
        href={`/projects/${projectId}/planning`}
        className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        {t('back_to_planning')}
      </Link>

      {liveConn?.target?.remote_url ? (
        <a
          href={liveConn.target.remote_url}
          target="_blank"
          rel="noopener"
          className="text-[13px] text-ink-3 hover:text-ink transition-colors"
        >
          {tp('view_live')} ↗
        </a>
      ) : anyDraft ? (
        <span className="text-[13px] text-ink-4">{tp('save_as_draft')}</span>
      ) : null}
    </div>
  )
}

function CornerRight({
  articleId,
  article,
  connections,
  activePlatform,
  onSetActivePlatform,
  onOpenDrawer,
  projectId,
}: {
  projectId: string
  articleId: string
  article: Article
  connections: ConnectionWithTarget[]
  activePlatform: string | null
  onSetActivePlatform: (platform: string) => void
  onOpenDrawer: () => void
}) {
  const t = useTranslations('articles')
  const tp = useTranslations('publish')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const contentReady = article.status === 'editing' || article.status === 'draft_ready'

  const activeConn =
    connections.find((c) => c.connection.platform === activePlatform) ?? connections[0] ?? null
  const hasRemote = Boolean(
    activeConn?.target?.remote_post_id && activeConn.target.remote_status !== 'unpublished',
  )

  function run(action: 'publish' | 'draft' | 'unpublish') {
    if (!activeConn) return
    const platform = activeConn.connection.platform
    const connectionId = activeConn.connection.id
    startTransition(async () => {
      try {
        const res = await fetch(`/api/publish/${platform}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ articleId, connectionId, action }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'publish failed')
        router.refresh()
      } catch (err) {
        console.error(err)
      }
    })
  }

  return (
    <div className="flex items-center gap-5 pointer-events-auto">
      {connections.length === 0 ? (
        <Link
          href={`/projects/${projectId}/settings`}
          className="text-[13px] text-ink-3 hover:text-ink transition-colors"
        >
          {tp('no_connection_cta')}
        </Link>
      ) : (
        <>
          {connections.length > 1 && (
            <div className="flex gap-3 pointer-events-auto">
              {connections.map((c) => (
                <button
                  key={c.connection.platform}
                  type="button"
                  onClick={() => onSetActivePlatform(c.connection.platform)}
                  className={cn(
                    'text-[11px] uppercase tracking-[0.1em] cursor-pointer transition-colors',
                    activePlatform === c.connection.platform
                      ? 'text-ink font-medium'
                      : 'text-ink-4 hover:text-ink',
                  )}
                >
                  {c.connection.platform}
                </button>
              ))}
            </div>
          )}

          <TextAction
            onClick={() => run('publish')}
            disabled={!contentReady || pending}
            emphasis
          >
            {pending ? '…' : hasRemote ? tp('republish') : tp('publish')}
          </TextAction>

          {hasRemote ? (
            <TextAction onClick={() => run('unpublish')} disabled={pending}>
              {tp('unpublish')}
            </TextAction>
          ) : (
            <TextAction onClick={() => run('draft')} disabled={!contentReady || pending}>
              {tp('save_as_draft')}
            </TextAction>
          )}
        </>
      )}

      <button
        type="button"
        onClick={onOpenDrawer}
        title={t('open_settings')}
        aria-label={t('open_settings')}
        className="text-ink-3 hover:text-ink transition-colors p-1 cursor-pointer"
      >
        <Settings2 className="w-4 h-4" />
      </button>
    </div>
  )
}

/**
 * Text-only action button. Primary one uses font-medium + ink color;
 * secondary uses ink-3 with ink on hover. No border, no background —
 * consistent with the frameless corner controls.
 */
function TextAction({
  onClick,
  disabled,
  emphasis,
  children,
}: {
  onClick?: () => void
  disabled?: boolean
  emphasis?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'text-[13px] transition-colors cursor-pointer',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        emphasis
          ? 'text-ink font-medium hover:underline underline-offset-4'
          : 'text-ink-3 hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

/* ========================================================================== */
/* SETTINGS DRAWER — slide-over on the right                                  */
/* ========================================================================== */

function SettingsDrawer({
  open,
  onClose,
  connections,
  projectId,
  locale,
  children,
}: {
  open: boolean
  onClose: () => void
  connections: ConnectionWithTarget[]
  projectId: string
  locale: string
  children: ReactNode
}) {
  const t = useTranslations('articles')
  const tp = useTranslations('publish')

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-ink-shade backdrop-blur-[1px] transition-opacity',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('open_settings')}
        className={cn(
          'fixed top-0 right-0 bottom-0 z-50 w-[520px] max-w-[92vw] bg-bg border-l border-rule shadow-sh-3 flex flex-col',
          'transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header className="flex items-center justify-between gap-3 px-5 h-14 border-b border-rule shrink-0">
          <h2 className="font-sans font-semibold text-[16px] text-ink tracking-tight">{t('open_settings')}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} title={t('close')}>
            <X className="w-4 h-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-auto">
          <section className="p-5">
            {children}
          </section>

          {connections.map(({ connection, target, logs }) => (
            <section key={connection.id} className="p-5 border-t border-rule space-y-3">
              <h3 className="font-sans font-semibold text-[13px] text-ink">{tp('tab_title')}</h3>

              <div className="rounded-lg border border-rule bg-bg-2/50 p-3 text-[12px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-ink-4 uppercase tracking-[0.12em] text-[10px]">
                    {connection.platform.charAt(0).toUpperCase() + connection.platform.slice(1)}
                  </span>
                  <Link
                    href={`/projects/${projectId}/settings`}
                    locale={locale as 'zh-TW' | 'en'}
                    className="text-[11px] text-ink-3 underline underline-offset-2 hover:text-ink"
                  >
                    {tp('manage_connection')}
                  </Link>
                </div>
                <div className="text-ink font-medium">{connection.name}</div>
              </div>

              {target?.published_at && (
                <div className="font-mono text-[11px] text-ink-3">
                  {tp('published_at')}: {new Date(target.published_at).toISOString().slice(0, 16).replace('T', ' ')}
                </div>
              )}

              {logs.length > 0 && (
                <ul className="rounded-lg border border-rule bg-bg divide-y divide-rule/60 max-h-64 overflow-auto">
                  {logs.map((log) => (
                    <li key={log.id} className="flex items-start justify-between gap-3 px-3 py-2 text-[12px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full shrink-0',
                            log.status === 'success' ? 'bg-sage' : 'bg-rust',
                          )}
                          aria-hidden
                        />
                        <span className="font-mono text-[10px] text-ink-3 uppercase tracking-[0.1em]">{log.action}</span>
                        {log.error_message && (
                          <span className="text-[11px] text-rust truncate" title={log.error_message}>
                            {log.error_message}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-ink-4 shrink-0">
                        {new Date(log.created_at).toISOString().slice(5, 16).replace('T', ' ')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </aside>
    </>
  )
}
