import { setRequestLocale } from 'next-intl/server'
import { requireUser } from '@/lib/auth/require-user'
import { AppShell } from '@/components/app-shell'
import { createClient } from '@/lib/supabase/server'

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

  const supabase = await createClient()
  const { data: projects } = await supabase
    .from('projects')
    .select('id,name')
    .order('updated_at', { ascending: false })

  return (
    <AppShell
      userEmail={user.email ?? undefined}
      projects={projects ?? []}
    >
      {children}
    </AppShell>
  )
}
