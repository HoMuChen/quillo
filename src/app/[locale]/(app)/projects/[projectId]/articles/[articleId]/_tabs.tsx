'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { ArticleStatusChip } from '@/components/ui/chip'
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
        <ArticleStatusChip status={status} />
      </div>
    </nav>
  )
}
