'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { cn } from '@/lib/utils'

const TABS = [
  { key: 'interview', path: 'interview' },
  { key: 'editor',    path: 'editor'    },
  { key: 'seo',       path: 'seo'       },
  { key: 'publish',   path: 'publish'   },
] as const

export function ArticleTabs({
  projectId,
  articleId,
  status,
}: {
  projectId: string
  articleId: string
  status: string
}) {
  const t = useTranslations('articles')
  const pathname = usePathname()

  return (
    <nav className="flex gap-0 border-b border-rule">
      {TABS.map((tab) => {
        const href = `/projects/${projectId}/articles/${articleId}/${tab.path}`
        const active = pathname.endsWith(`/${tab.path}`) || (tab.path === 'interview' && pathname.endsWith(`/${articleId}`))
        return (
          <Link
            key={tab.key}
            href={href}
            className={cn(
              'px-4 py-2 text-[13px] -mb-px border-b-2 transition-colors',
              active
                ? 'border-ink text-ink font-medium'
                : 'border-transparent text-ink-3 hover:text-ink hover:border-ink-4',
            )}
          >
            {t(`tab_${tab.key}`)}
          </Link>
        )
      })}
      <div className="ml-auto pb-2 flex items-center gap-2">
        <StatusChip status={status} />
      </div>
    </nav>
  )
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    planned:       { label: 'planned',       cls: 'bg-bg border-rule text-ink-3' },
    outlining:     { label: 'outlining',     cls: 'bg-bg-2 border-rule text-ochre-ink' },
    outline_ready: { label: 'outline ready', cls: 'bg-bg border-ochre text-ochre-ink' },
    interviewing:  { label: 'interviewing',  cls: 'bg-bg-2 border-rule text-ochre-ink' },
    drafting:      { label: 'drafting',      cls: 'bg-bg-2 border-rule text-ochre-ink' },
    draft_ready:   { label: 'draft ready',   cls: 'bg-bg border-ochre text-ochre-ink' },
    editing:       { label: 'editing',       cls: 'bg-bg border-ink text-ink' },
  }
  const v = map[status] ?? map.planned
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded border ${v.cls}`}>
      <span className="w-1 h-1 rounded-full bg-current opacity-60" />
      {v.label}
    </span>
  )
}
