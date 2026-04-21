'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { ChevronDown, FolderPlus } from 'lucide-react'

type Project = { id: string; name: string }

export function ProjectsSidebar({ projects }: { projects: Project[] }) {
  const t = useTranslations('projects')
  const tBrand = useTranslations('brand')
  const pathname = usePathname()

  const match = pathname.match(/^\/projects\/([0-9a-f-]{36})/)
  const currentId = match?.[1] ?? null
  const current = currentId ? projects.find((p) => p.id === currentId) ?? null : null

  const [open, setOpen] = useState(false)
  const [lastPathname, setLastPathname] = useState(pathname)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Close dropdown on pathname change — adjust state during render instead of
  // in an effect to satisfy react-hooks/set-state-in-effect.
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    if (open) setOpen(false)
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', onClick)
      document.addEventListener('keydown', onKey)
      return () => {
        document.removeEventListener('mousedown', onClick)
        document.removeEventListener('keydown', onKey)
      }
    }
  }, [open])

  const triggerLabel = current?.name ?? t('switcher_placeholder')

  const navItems = currentId
    ? [
        { href: `/projects/${currentId}/planning`, label: t('nav_planning') },
        { href: `/projects/${currentId}/articles`, label: t('nav_articles') },
        { href: `/projects/${currentId}/brand`,    label: tBrand('nav_brand') },
        { href: `/projects/${currentId}/settings`, label: t('nav_settings') },
      ]
    : []

  return (
    <div className="space-y-4">
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'w-full flex items-center justify-between gap-2 rounded-lg border border-rule bg-bg px-3 py-2 text-left transition-colors cursor-pointer',
            'hover:border-ink-3',
            open && 'border-ink-3 shadow-sh-1',
          )}
        >
          <span className={cn('truncate text-[13px]', current ? 'text-ink font-medium' : 'text-ink-4')}>
            {triggerLabel}
          </span>
          <ChevronDown className={cn('w-3.5 h-3.5 text-ink-3 transition-transform flex-none', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-20 rounded-lg border border-rule bg-bg shadow-sh-2 overflow-hidden">
            {projects.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-ink-4">{t('switcher_none')}</div>
            ) : (
              <ul className="max-h-64 overflow-auto py-1">
                {projects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}/planning`}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 text-[13px] transition-colors',
                        p.id === currentId
                          ? 'bg-ink text-bg font-medium'
                          : 'text-ink-2 hover:bg-mist hover:text-ink',
                      )}
                    >
                      <span className="truncate">{p.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-rule">
              <Link
                href="/projects"
                className="flex items-center gap-2 px-3 py-2 text-[12px] text-ink-3 hover:bg-mist hover:text-ink transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                {t('switcher_all_projects')}
              </Link>
            </div>
          </div>
        )}
      </div>

      {navItems.length > 0 && (
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
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
      )}
    </div>
  )
}
