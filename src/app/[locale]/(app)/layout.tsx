import { setRequestLocale } from 'next-intl/server'
import { requireUser } from '@/lib/auth/require-user'
import { AppShell } from '@/components/app-shell'
import { UserMenu } from '@/components/user-menu'

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const user = await requireUser()

  return (
    <AppShell userEmail={user.email ?? undefined} userMenu={<UserMenu />}>
      {children}
    </AppShell>
  )
}
