import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { SignupForm } from './_signup-form'

export default async function SignupPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('auth')

  return (
    <div className="space-y-6">
      <header className="space-y-1 text-center">
        <h2 className="font-serif italic text-[28px] text-ink leading-tight">{t('signup_title')}</h2>
        <p className="text-[13px] text-ink-3">{t('signup_subtitle')}</p>
      </header>
      <SignupForm />
      <p className="text-center text-[13px] text-ink-3">
        <Link href="/login" className="underline decoration-rule hover:decoration-ink-3 hover:text-ink transition-colors">
          {t('to_login')}
        </Link>
      </p>
    </div>
  )
}
