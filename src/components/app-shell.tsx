import type { ReactNode } from 'react'
import { Link } from '@/i18n/routing'

export function AppShell({
  children,
  userEmail,
  userMenu,
}: {
  children: ReactNode
  userEmail?: string
  userMenu?: ReactNode
}) {
  return (
    <div className="relative z-10 min-h-screen grid grid-cols-[260px_1fr] bg-bg">
      <aside className="border-r border-rule bg-[rgba(239,234,220,0.45)] p-5 flex flex-col justify-between min-h-screen">
        <div>
          <div className="mb-6">
            <Link href="/projects" className="inline-block">
              <div className="font-serif italic text-[26px] leading-none text-ink tracking-tight">Quillo</div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-ink-4 mt-1.5">editorial content graph</div>
            </Link>
          </div>
          <nav className="space-y-1 text-[13px]">
            <Link
              href="/projects"
              className="block px-2.5 py-1.5 rounded-md hover:bg-mist text-ink transition-colors"
            >
              Projects
            </Link>
          </nav>
        </div>

        {(userEmail || userMenu) && (
          <div className="text-[12px] text-ink-3 border-t border-rule pt-4 mt-4">
            {userEmail && <div className="truncate mb-2">{userEmail}</div>}
            {userMenu}
          </div>
        )}
      </aside>
      <main className="p-8 min-w-0">{children}</main>
    </div>
  )
}
