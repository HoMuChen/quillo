import { z } from 'zod'

export const searchIntent = z.enum(['informational', 'commercial', 'transactional'])

export const pillarPlanSchema = z.object({
  pillars: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      target_keyword: z.string(),
      search_intent: searchIntent,
      articles: z
        .array(
          z.object({
            title: z.string(),
            target_keyword: z.string(),
            lsi_keywords: z.array(z.string()).max(3),
            search_intent: searchIntent,
            word_count_target: z.number().int().min(500).max(5000),
            role: z.enum(['hub', 'supporting', 'comparison']),
          }),
        )
        .min(5)
        .max(10),
      existing_article_ids: z.array(z.string().uuid()).optional(),
    }),
  ).min(3).max(6),
})

export type PillarPlan = z.infer<typeof pillarPlanSchema>

export const clusterArticlesSchema = z.object({
  articles: z.array(
    z.object({
      title: z.string(),
      target_keyword: z.string(),
      lsi_keywords: z.array(z.string()).max(3),
      search_intent: searchIntent,
      word_count_target: z.number().int().min(500).max(5000),
      role: z.enum(['hub', 'supporting', 'comparison']),
    }),
  ).min(5).max(10),
})

export type ClusterArticles = z.infer<typeof clusterArticlesSchema>

export const outlineSchema = z.object({
  sections: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]+$/, 'id must be lowercase kebab-case'),
        title: z.string(),
        purpose: z.string(),
        needs_interview: z.boolean(),
      }),
    )
    .min(3)
    .max(15),
})

export type Outline = z.infer<typeof outlineSchema>

export const interviewSchema = z.object({
  questions: z
    .array(
      z.object({
        section_id: z.string(),
        question: z.string(),
      }),
    )
    .max(8),
})

export type InterviewQuestions = z.infer<typeof interviewSchema>

export const planAndQuestionsSchema = z.object({
  sections: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]+$/, 'id must be lowercase kebab-case'),
        title: z.string(),
        purpose: z.string(),
        needs_interview: z.boolean(),
      }),
    )
    .min(3)
    .max(15),
  questions: z
    .array(
      z.object({
        section_id: z.string(),
        question: z.string(),
      }),
    )
    .max(8),
})

export type PlanAndQuestions = z.infer<typeof planAndQuestionsSchema>

export const metaSchema = z.object({
  meta_title: z.string().min(10).max(60),
  meta_description: z.string().min(50).max(160),
})

export type MetaSuggestion = z.infer<typeof metaSchema>

export const seoSuggestionSchema = z.object({
  meta_title: z.string().min(10).max(60),
  meta_description: z.string().min(50).max(160),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be lowercase kebab-case'),
  excerpt: z.string().min(40).max(280),
  focus_keyword: z.string().min(1),
  tags: z.array(z.string()).min(2).max(5),
})

export type SeoSuggestion = z.infer<typeof seoSuggestionSchema>

export const analyzeBrandSchema = z.object({
  tone: z.string().nullable(),
  author_background: z.string().nullable(),
  reader_persona: z.string().nullable(),
  preferred_terms: z.array(z.string()),
  forbidden_terms: z.array(z.string()),
  ee_at_cases: z.string().nullable(),
})
export type AnalyzeBrandResult = z.infer<typeof analyzeBrandSchema>

export const organizeOrphansSchema = z.object({
  new_pillars: z.array(z.object({
    temp_id: z.string(),
    title: z.string(),
    target_keyword: z.string().optional().nullable(),
    article_ids: z.array(z.string()).min(3),
  })),
  existing_assignments: z.array(z.object({
    article_id: z.string(),
    pillar_id: z.string(),
  })).optional(),
})

export type OrganizePlan = z.infer<typeof organizeOrphansSchema>
