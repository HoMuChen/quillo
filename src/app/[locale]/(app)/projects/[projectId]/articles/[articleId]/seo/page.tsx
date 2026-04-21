import { redirect } from '@/i18n/routing'

type Props = { params: Promise<{ locale: string; projectId: string; articleId: string }> }

export default async function SeoRedirect({ params }: Props) {
  const { locale, projectId, articleId } = await params
  redirect({
    href: `/projects/${projectId}/articles/${articleId}`,
    locale: locale as 'zh-TW' | 'en',
  })
}
