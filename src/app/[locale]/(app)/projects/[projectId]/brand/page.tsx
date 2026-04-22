import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { BrandForm } from './_brand-form'

type Props = { params: Promise<{ locale: string; projectId: string }> }

export default async function BrandPage({ params }: Props) {
  const { locale, projectId } = await params
  setRequestLocale(locale)
  const t = await getTranslations('brand')

  const supabase = await createClient()
  const [{ data: brand, error }, { data: articlesWithBody }] = await Promise.all([
    supabase
      .from('brand_materials')
      .select('author_background,reader_persona,tone,preferred_terms,forbidden_terms,ee_at_cases')
      .eq('project_id', projectId)
      .single(),
    supabase
      .from('articles')
      .select('id,title,target_keyword')
      .eq('project_id', projectId)
      .not('body_tiptap', 'is', null)
      .order('created_at', { ascending: false }),
  ])

  if (error || !brand) notFound()

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="font-serif italic text-[32px] text-ink leading-tight">{t('title')}</h1>
        <p className="text-[13px] text-ink-3 mt-2">{t('subtitle')}</p>
      </header>
      <BrandForm
        projectId={projectId}
        initial={brand}
        articlesWithBody={articlesWithBody ?? []}
      />
    </div>
  )
}
