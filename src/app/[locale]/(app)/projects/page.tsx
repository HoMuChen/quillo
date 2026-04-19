import { setRequestLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { ProjectsList } from './_projects-list'
import { NewProjectDialog } from './_new-project-dialog'

type Props = { params: Promise<{ locale: string }> }

export default async function ProjectsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('projects')

  const supabase = await createClient()
  const { data: projects } = await supabase
    .from('projects')
    .select('id,name,domain,audience,updated_at,content_locale')
    .order('updated_at', { ascending: false })

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-serif italic text-[40px] leading-none text-ink tracking-tight">{t('title')}</h1>
          <p className="text-[13px] text-ink-3 mt-2">{t('subtitle')}</p>
        </div>
        <NewProjectDialog locale={locale as 'zh-TW' | 'en'} />
      </header>
      <ProjectsList projects={projects ?? []} />
    </div>
  )
}
