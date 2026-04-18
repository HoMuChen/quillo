'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { cn } from '@/lib/utils'

export function ProjectNav({ projectId, projectName }: { projectId: string; projectName: string }) {
  const t = useTranslations('projects')
  const tBrand = useTranslations('brand')
  const pathname = usePathname()

  const items = [
    { href: `/projects/${projectId}/planning`, label: t('nav_planning') },
    { href: `/projects/${projectId}/articles`, label: t('nav_articles') },
    { href: `/projects/${projectId}/brand`,    label: tBrand('nav_brand') },
    { href: `/projects/${projectId}/settings`, label: t('nav_settings') },
  ]

  return (
    <aside className="space-y-5">
      <div>
        <Link
          href="/projects"
          className="text-[11px] uppercase tracking-[0.14em] text-ink-4 hover:text-ink-2 transition-colors"
        >
          ← {t('title')}
        </Link>
        <h2 className="font-serif italic text-[22px] text-ink mt-2 leading-tight">{projectName}</h2>
      </div>
      <nav className="space-y-0.5">
        {items.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block px-2.5 py-1.5 rounded-md text-[13px] transition-colors',
                active
                  ? 'bg-ink text-bg font-medium'
                  : 'text-ink-2 hover:bg-mist hover:text-ink',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
