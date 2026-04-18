import { getRequestConfig } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from './routing'

const namespaces = ['common', 'auth', 'projects', 'planning', 'articles', 'editor', 'publish'] as const

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale
  if (!locale || !(routing.locales as readonly string[]).includes(locale)) {
    notFound()
  }

  const messages: Record<string, unknown> = {}
  for (const ns of namespaces) {
    try {
      messages[ns] = (await import(`../../messages/${locale}/${ns}.json`)).default
    } catch {
      messages[ns] = {}
    }
  }
  return { locale: locale!, messages }
})
