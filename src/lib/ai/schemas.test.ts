import { describe, it, expect } from 'vitest'
import {
  pillarPlanSchema,
  outlineSchema,
  interviewSchema,
  metaSchema,
} from './schemas'

const fiveArticles = Array.from({ length: 5 }, (_, i) => ({
  title: `Article ${i}`,
  target_keyword: `kw-${i}`,
  lsi_keywords: ['a'],
  search_intent: 'informational' as const,
  word_count_target: 1200,
  role: i === 0 ? 'hub' as const : 'supporting' as const,
}))

describe('pillarPlanSchema', () => {
  it('accepts minimal 3 pillars × 5 articles', () => {
    const plan = {
      pillars: Array.from({ length: 3 }, (_, i) => ({
        title: `Pillar ${i}`,
        description: `desc ${i}`,
        target_keyword: `kw-${i}`,
        search_intent: 'informational',
        articles: fiveArticles,
      })),
    }
    expect(() => pillarPlanSchema.parse(plan)).not.toThrow()
  })

  it('rejects when fewer than 3 pillars', () => {
    const bad = { pillars: [] }
    expect(() => pillarPlanSchema.parse(bad)).toThrow()
  })

  it('rejects when pillar has fewer than 5 articles', () => {
    const bad = {
      pillars: Array.from({ length: 3 }, () => ({
        title: 't', description: 'd', target_keyword: 'k',
        search_intent: 'informational',
        articles: fiveArticles.slice(0, 4),
      })),
    }
    expect(() => pillarPlanSchema.parse(bad)).toThrow()
  })

  it('rejects when article has 4 lsi_keywords', () => {
    const bad = {
      pillars: Array.from({ length: 3 }, () => ({
        title: 't', description: 'd', target_keyword: 'k',
        search_intent: 'informational',
        articles: [
          ...fiveArticles.slice(0, 4),
          { ...fiveArticles[0], lsi_keywords: ['a', 'b', 'c', 'd'] },
        ],
      })),
    }
    expect(() => pillarPlanSchema.parse(bad)).toThrow()
  })
})

describe('outlineSchema', () => {
  const base = [
    { id: 'a', title: 't', purpose: 'p', needs_interview: false },
    { id: 'b', title: 't', purpose: 'p', needs_interview: false },
    { id: 'c', title: 't', purpose: 'p', needs_interview: true },
  ]

  it('accepts valid outline', () => {
    expect(() => outlineSchema.parse({ sections: base })).not.toThrow()
  })

  it('rejects id with uppercase', () => {
    const bad = { sections: [{ ...base[0], id: 'Has Space' }, base[1], base[2]] }
    expect(() => outlineSchema.parse(bad)).toThrow()
  })

  it('rejects fewer than 3 sections', () => {
    expect(() => outlineSchema.parse({ sections: base.slice(0, 2) })).toThrow()
  })
})

describe('interviewSchema', () => {
  it('accepts up to 8 questions', () => {
    const questions = Array.from({ length: 8 }, (_, i) => ({
      section_id: `s-${i}`, question: `q ${i}`,
    }))
    expect(() => interviewSchema.parse({ questions })).not.toThrow()
  })

  it('rejects when more than 8 questions', () => {
    const questions = Array.from({ length: 9 }, (_, i) => ({
      section_id: `s-${i}`, question: 'q',
    }))
    expect(() => interviewSchema.parse({ questions })).toThrow()
  })

  it('accepts empty questions array', () => {
    expect(() => interviewSchema.parse({ questions: [] })).not.toThrow()
  })
})

describe('metaSchema', () => {
  it('accepts valid', () => {
    expect(() => metaSchema.parse({
      meta_title: 'A compelling title here',
      meta_description: 'x'.repeat(80),
    })).not.toThrow()
  })

  it('rejects meta_title too short', () => {
    expect(() => metaSchema.parse({ meta_title: 'short', meta_description: 'x'.repeat(80) })).toThrow()
  })

  it('rejects meta_description too short', () => {
    expect(() => metaSchema.parse({ meta_title: 'Compelling title x', meta_description: 'short' })).toThrow()
  })

  it('rejects meta_title too long', () => {
    expect(() => metaSchema.parse({
      meta_title: 'x'.repeat(61),
      meta_description: 'x'.repeat(80),
    })).toThrow()
  })
})
