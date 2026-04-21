import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { ArticleScreen } from './_article-screen'
import { FeatureImage } from './_feature-image'
import { EditorTab } from './editor/_editor-tab'
import { InterviewTab } from './interview/_interview-tab'
import { SeoTab } from './seo/_seo-tab'

type Props = { params: Promise<{ locale: string; projectId: string; articleId: string }> }

export default async function ArticlePage({ params }: Props) {
  const { locale, projectId, articleId } = await params
  setRequestLocale(locale)

  const supabase = await createClient()

  // Article core — title, status, body, SEO fields, feature image, meta
  const { data: article, error } = await supabase
    .from('articles')
    .select('id,title,status,body_markdown,body_tiptap,feature_image_url,target_keyword,word_count_target,role,pillar_id,meta_title,meta_description,slug,excerpt,canonical_url,focus_keyword,tags,pillars(title)')
    .eq('id', articleId)
    .single()
  if (error || !article) notFound()

  const pillarTitle = (article.pillars as { title: string } | null)?.title ?? null

  // Interview data — only needed when body is empty but we always load;
  // cost is tiny and avoids a second page load transition.
  const hasBody = Boolean(article.body_markdown || article.body_tiptap)

  const [outlineResult, questionsResult] = await Promise.all([
    supabase
      .from('article_outlines')
      .select('sections')
      .eq('article_id', articleId)
      .maybeSingle(),
    supabase
      .from('interview_questions')
      .select('id,section_id,question,answer,status,position')
      .eq('article_id', articleId)
      .order('position'),
  ])

  const sections = (outlineResult.data?.sections ?? []) as Array<{
    id: string; title: string; purpose: string; needs_interview: boolean
  }>
  const questions = (questionsResult.data ?? []) as Array<{
    id: string
    section_id: string
    question: string
    answer: string | null
    status: 'pending' | 'answered' | 'skipped'
    position: number
  }>

  // Ghost connection + target + logs for the top-right publish menu and the
  // drawer's publish section.
  const { data: connection } = await supabase
    .from('site_connections')
    .select('id,name,platform')
    .eq('project_id', projectId)
    .eq('platform', 'ghost')
    .maybeSingle()

  const { data: target } = connection
    ? await supabase
        .from('publish_targets')
        .select('id,remote_post_id,remote_url,remote_status,published_at,scheduled_for')
        .eq('article_id', articleId)
        .eq('connection_id', connection.id)
        .maybeSingle()
    : { data: null }

  const { data: logs } = target
    ? await supabase
        .from('publish_logs')
        .select('id,action,status,error_message,created_at')
        .eq('publish_target_id', target.id)
        .order('created_at', { ascending: false })
        .limit(10)
    : { data: [] as Array<{
        id: string
        action: string
        status: string
        error_message: string | null
        created_at: string
      }> }

  const featureImageSlot = (
    <FeatureImage
      projectId={projectId}
      articleId={articleId}
      featureImageUrl={article.feature_image_url}
    />
  )

  const settingsSlot = (
    <SeoTab
      projectId={projectId}
      articleId={articleId}
      initial={{
        meta_title: article.meta_title ?? '',
        meta_description: article.meta_description ?? '',
        slug: article.slug ?? '',
        excerpt: article.excerpt ?? '',
        canonical_url: article.canonical_url ?? '',
        focus_keyword: article.focus_keyword ?? '',
        tags: article.tags ?? [],
      }}
    />
  )

  return (
    <ArticleScreen
      projectId={projectId}
      articleId={articleId}
      locale={locale}
      article={{
        id: article.id,
        title: article.title,
        status: article.status,
        target_keyword: article.target_keyword,
        word_count_target: article.word_count_target,
        role: article.role,
      }}
      pillar={
        pillarTitle && article.pillar_id
          ? { title: pillarTitle, href: `/projects/${projectId}/planning` }
          : null
      }
      connection={connection ?? null}
      target={target ?? null}
      logs={logs ?? []}
      featureImageSlot={featureImageSlot}
      settingsSlot={settingsSlot}
    >
      {hasBody ? (
        <EditorTab
          projectId={projectId}
          articleId={articleId}
          bodyMarkdown={article.body_markdown}
          bodyTiptap={article.body_tiptap}
        />
      ) : (
        <InterviewTab
          projectId={projectId}
          articleId={articleId}
          status={article.status}
          sections={sections}
          questions={questions}
        />
      )}
    </ArticleScreen>
  )
}
