'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'

type Project = {
  id: string
  name: string
  domain: string | null
  audience: string | null
  updated_at: string
  content_locale: string
}

export function ProjectsList({ projects }: { projects: Project[] }) {
  const t = useTranslations('projects')

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-rule border-dashed bg-bg/60 p-10 text-center shadow-sh-1">
        <p className="font-serif italic text-[20px] text-ink">{t('empty_title')}</p>
        <p className="text-[13px] text-ink-3 mt-2 max-w-md mx-auto">{t('empty_body')}</p>
      </div>
    )
  }

  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((p) => (
        <li key={p.id}>
          <Link
            href={`/projects/${p.id}/planning`}
            className="block rounded-xl border border-rule bg-bg p-5 shadow-sh-1 hover:shadow-sh-2 hover:border-ink-3 transition-all"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-serif italic text-[22px] text-ink truncate">{p.name}</h3>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-4">{p.content_locale}</span>
            </div>
            {p.domain && <p className="text-[12px] text-ink-3 mt-1 truncate">{p.domain}</p>}
            {p.audience && <p className="text-[12px] text-ink-3 mt-3 line-clamp-2">{p.audience}</p>}
          </Link>
        </li>
      ))}
    </ul>
  )
}
