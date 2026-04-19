import { redirect } from '@/i18n/routing'

type Props = { params: Promise<{ locale: string; projectId: string; articleId: string }> }

export default async function ArticlePage({ params }: Props) {
  const { locale, projectId, articleId } = await params
  redirect({
    href: `/projects/${projectId}/articles/${articleId}/interview`,
    locale: locale as 'zh-TW' | 'en',
  })
}
