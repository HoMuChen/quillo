import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { LoginForm } from './_login-form'

export default async function LoginPage({
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
        <h2 className="font-serif italic text-[28px] text-ink leading-tight">{t('login_title')}</h2>
        <p className="text-[13px] text-ink-3">{t('login_subtitle')}</p>
      </header>
      <LoginForm />
      <p className="text-center text-[13px] text-ink-3">
        <Link href="/signup" className="underline decoration-rule hover:decoration-ink-3 hover:text-ink transition-colors">
          {t('to_signup')}
        </Link>
      </p>
    </div>
  )
}
