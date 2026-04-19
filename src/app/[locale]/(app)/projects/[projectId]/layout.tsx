import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string; projectId: string }>
}

export default async function ProjectLayout({ children, params }: Props) {
  const { locale, projectId } = await params
  setRequestLocale(locale)

  const supabase = await createClient()
  const { data: project, error } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single()

  if (error || !project) notFound()

  return <>{children}</>
}
