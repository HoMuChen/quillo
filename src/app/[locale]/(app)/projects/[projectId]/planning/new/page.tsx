import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { PlanWizard } from './_wizard'

type Props = { params: Promise<{ locale: string; projectId: string }> }

export default async function NewPlanPage({ params }: Props) {
  const { locale, projectId } = await params
  setRequestLocale(locale)
  const t = await getTranslations('planning')

  const supabase = await createClient()
  const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).single()
  if (!project) notFound()

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="font-serif italic text-[32px] text-ink leading-tight">{t('new_title')}</h1>
      </header>
      <PlanWizard projectId={projectId} locale={locale as 'zh-TW' | 'en'} />
    </div>
  )
}
