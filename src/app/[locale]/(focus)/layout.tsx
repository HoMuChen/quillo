import { setRequestLocale } from 'next-intl/server'
import { requireUser } from '@/lib/auth/require-user'

/**
 * Focus-mode layout — used for surfaces that demand the full viewport
 * (article editor, distraction-free writing). Same auth gate as (app),
 * but no sidebar or shell chrome.
 */
export default async function FocusLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireUser()

  return <>{children}</>
}
