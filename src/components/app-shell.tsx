import type { ReactNode } from 'react'
import { Link } from '@/i18n/routing'
import { ProjectsSidebar } from './projects-sidebar'
import { LocaleSwitcher } from './locale-switcher'

type Project = { id: string; name: string }

export function AppShell({
  children,
  userEmail,
  userMenu,
  projects,
}: {
  children: ReactNode
  userEmail?: string
  userMenu?: ReactNode
  projects: Project[]
}) {
  return (
    <div className="relative z-10 min-h-screen grid grid-cols-[260px_1fr] bg-bg">
      <aside className="border-r border-rule bg-[rgba(239,234,220,0.45)] p-5 flex flex-col justify-between min-h-screen">
        <div className="space-y-5">
          <Link href="/projects" className="block">
            <div className="font-serif italic text-[26px] leading-none text-ink tracking-tight">Quillo</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-ink-4 mt-1.5">editorial content graph</div>
          </Link>

          <ProjectsSidebar projects={projects} />
        </div>

        {(userEmail || userMenu) && (
          <div className="text-[12px] text-ink-3 border-t border-rule pt-4 mt-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              {userEmail && <div className="truncate flex-1">{userEmail}</div>}
              <LocaleSwitcher />
            </div>
            {userMenu}
          </div>
        )}
      </aside>
      <main className="p-8 min-w-0 paper-grain">{children}</main>
    </div>
  )
}
