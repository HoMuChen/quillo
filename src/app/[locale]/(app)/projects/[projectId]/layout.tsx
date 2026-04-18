import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { ProjectNav } from './_project-nav'

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
    .select('id,name,content_locale')
    .eq('id', projectId)
    .single()

  if (error || !project) notFound()

  return (
    <div className="grid grid-cols-[220px_1fr] gap-10 max-w-6xl">
      <ProjectNav projectId={project.id} projectName={project.name} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
