import type { ReactNode } from 'react'
import { Link } from '@/i18n/routing'
import { ProjectsSidebar } from './projects-sidebar'
import { UserDropdown } from './user-dropdown'

type Project = { id: string; name: string }

export function AppShell({
  children,
  userEmail,
  projects,
}: {
  children: ReactNode
  userEmail?: string
  projects: Project[]
}) {
  return (
    <div className="relative min-h-screen grid grid-cols-[260px_1fr] bg-bg">
      <aside className="sticky top-0 h-screen overflow-y-auto border-r border-rule bg-bg-2/60 p-5 flex flex-col justify-between will-change-transform">
        <div className="space-y-5">
          <Link href="/projects" className="block">
            <div className="font-serif italic text-[26px] leading-none text-ink tracking-tight">Quillo</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-ink-4 mt-1.5">editorial content graph</div>
          </Link>

          <ProjectsSidebar projects={projects} />
        </div>

        {userEmail && (
          <div className="border-t border-rule pt-3 mt-4">
            <UserDropdown email={userEmail} />
          </div>
        )}
      </aside>
      <main className="p-8 min-w-0">{children}</main>
    </div>
  )
}
