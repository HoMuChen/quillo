'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { PublishStatusChip } from '@/components/ui/chip'
import { cn } from '@/lib/utils'
import { ArrowLeft, Settings2, ChevronDown, X, ExternalLink } from 'lucide-react'

type Connection = {
  id: string
  name: string
  platform: string
} | null

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
  connection,
  target,
  logs,
  featureImageSlot,
  settingsSlot,
  children,
}: {
  projectId: string
  articleId: string
  locale: string
  article: Article
  pillar: Pillar
  connection: Connection
  target: Target
  logs: Log[]
  featureImageSlot: ReactNode
  settingsSlot: ReactNode
  children: ReactNode
}) {
  const t = useTranslations('articles')
  const tpl = useTranslations('planning')
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="min-h-screen">
      {/* TOP BAR — full-width sticky bar across the viewport */}
      <div className="sticky top-0 z-30 bg-bg/90 backdrop-blur border-b border-rule">
        <div className="max-w-5xl mx-auto h-14 px-6 flex items-center">
          <TopBar
            projectId={projectId}
            articleId={articleId}
            article={article}
            connection={connection}
            target={target}
            onOpenDrawer={() => setDrawerOpen(true)}
          />
        </div>
      </div>

      {/* CENTERED CONTENT COLUMN */}
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
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
        connection={connection}
        target={target}
        logs={logs}
        projectId={projectId}
        locale={locale}
      >
        {settingsSlot}
      </SettingsDrawer>
    </div>
  )
}

/* ========================================================================== */
/* TOP BAR                                                                    */
/* ========================================================================== */

function TopBar({
  projectId,
  articleId,
  article,
  connection,
  target,
  onOpenDrawer,
}: {
  projectId: string
  articleId: string
  article: Article
  connection: Connection
  target: Target
  onOpenDrawer: () => void
}) {
  const t = useTranslations('articles')
  const tp = useTranslations('publish')
  const contentReady = article.status === 'editing' || article.status === 'draft_ready'
  const hasRemote = Boolean(target?.remote_post_id && target.remote_status !== 'unpublished')

  return (
    <div className="flex items-center justify-between gap-3 w-full">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Link
          href={`/projects/${projectId}/planning`}
          className="inline-flex items-center gap-1.5 text-[12px] text-ink-3 hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="uppercase tracking-[0.14em]">{t('back_to_planning')}</span>
        </Link>

        {target?.remote_status && (
          <div className="ml-2">
            <PublishStatusChip
              status={target.remote_status}
              unpublishedLabel={tp('status_not_published')}
            />
          </div>
        )}

        {target?.remote_url && (
          <a
            href={target.remote_url}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 text-[12px] text-indigo-ink hover:underline underline-offset-2"
          >
            {tp('view_live')} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="flex items-center gap-2 flex-none">
        <Button variant="ghost" size="icon" onClick={onOpenDrawer} title={t('open_settings')}>
          <Settings2 className="w-4 h-4" />
        </Button>

        {connection ? (
          <PublishMenu
            articleId={articleId}
            connectionId={connection.id}
            hasRemote={hasRemote}
            contentReady={contentReady}
          />
        ) : (
          <Link href={`/projects/${projectId}/settings`}>
            <Button variant="default" size="sm">{tp('no_connection_cta')}</Button>
          </Link>
        )}
      </div>
    </div>
  )
}

/* ========================================================================== */
/* PUBLISH MENU — always-visible dropdown                                     */
/* ========================================================================== */

function PublishMenu({
  articleId,
  connectionId,
  hasRemote,
  contentReady,
}: {
  articleId: string
  connectionId: string
  hasRemote: boolean
  contentReady: boolean
}) {
  const t = useTranslations('publish')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    if (open) {
      document.addEventListener('mousedown', onClick)
      document.addEventListener('keydown', onKey)
      return () => {
        document.removeEventListener('mousedown', onClick)
        document.removeEventListener('keydown', onKey)
      }
    }
  }, [open])

  function run(action: 'publish' | 'draft' | 'unpublish') {
    setOpen(false)
    startTransition(async () => {
      try {
        const res = await fetch('/api/publish/ghost', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ articleId, connectionId, action }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'publish failed')
        router.refresh()
      } catch (err) {
        console.error(err)
        // error surfaces via publish logs in drawer
      }
    })
  }

  const primaryLabel = hasRemote ? t('republish') : t('publish')

  return (
    <div ref={wrapRef} className="relative inline-flex">
      {/* Primary publish button — drops its right border/radius so the chevron
          button sits flush beside it; a single divider line (chevron's left
          border) keeps them visually distinct. */}
      <Button
        variant="ochre"
        onClick={() => run('publish')}
        disabled={!contentReady || pending}
        className="rounded-r-none border-r-0"
      >
        {pending ? '...' : primaryLabel}
      </Button>
      <Button
        variant="ochre"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        title={t('more_actions')}
        className="rounded-l-none w-9 px-0 border-l-[#7a4e16]"
      >
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-40 w-56 rounded-lg border border-rule bg-bg shadow-sh-2 overflow-hidden py-1">
          <MenuItem disabled={!contentReady} onClick={() => run('draft')}>
            {t('save_as_draft')}
          </MenuItem>
          <MenuItem disabled title={t('schedule_coming_m2')}>
            {t('schedule')} <span className="ml-auto font-mono text-[10px] text-ink-4">M2</span>
          </MenuItem>
          {hasRemote && (
            <>
              <div className="h-px bg-rule my-1 mx-2" />
              <MenuItem onClick={() => run('unpublish')} danger>
                {t('unpublish')}
              </MenuItem>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({
  onClick, disabled, danger, title, children,
}: {
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
  title?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-[13px] transition-colors text-left',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        danger ? 'text-rust hover:bg-rust/10' : 'text-ink hover:bg-mist',
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
  connection,
  target,
  logs,
  projectId,
  locale,
  children,
}: {
  open: boolean
  onClose: () => void
  connection: Connection
  target: Target
  logs: Log[]
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
          'fixed top-0 right-0 bottom-0 z-50 w-[420px] max-w-[92vw] bg-bg border-l border-rule shadow-sh-3 flex flex-col',
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

          {connection && (
            <section className="p-5 border-t border-rule space-y-3">
              <h3 className="font-sans font-semibold text-[13px] text-ink">{tp('tab_title')}</h3>

              <div className="rounded-lg border border-rule bg-bg-2/50 p-3 text-[12px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-ink-4 uppercase tracking-[0.12em] text-[10px]">Ghost</span>
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
          )}
        </div>
      </aside>
    </>
  )
}
