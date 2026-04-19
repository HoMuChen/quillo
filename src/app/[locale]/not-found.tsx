import { Link } from '@/i18n/routing'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'

export default async function NotFound() {
  const t = await getTranslations('common')
  return (
    <div className="max-w-md mx-auto mt-20 space-y-4 rounded-xl border border-rule bg-bg p-8 shadow-sh-1 text-center">
      <p className="font-serif italic text-[48px] text-ink leading-none">404</p>
      <h2 className="font-serif italic text-[22px] text-ink">{t('notfound_title')}</h2>
      <p className="text-[13px] text-ink-3">{t('notfound_body')}</p>
      <Link href="/projects">
        <Button variant="primary">{t('notfound_cta')}</Button>
      </Link>
    </div>
  )
}
