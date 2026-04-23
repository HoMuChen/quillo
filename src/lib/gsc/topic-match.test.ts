import { describe, it, expect } from 'vitest'
import { tokenizeTopic } from './topic-match'

describe('tokenizeTopic', () => {
  it('lowercases, splits whitespace, dedupes', () => {
    expect(tokenizeTopic('SEO Tool for Shopify')).toEqual(['seo', 'tool', 'for', 'shopify'])
  })
  it('handles CJK terms as individual tokens', () => {
    expect(tokenizeTopic('電商 SEO 策略')).toEqual(['電商', 'seo', '策略'])
  })
  it('dedupes', () => {
    expect(tokenizeTopic('seo seo tools')).toEqual(['seo', 'tools'])
  })
  it('strips punctuation', () => {
    expect(tokenizeTopic('seo: tools, for startups.')).toEqual(['seo', 'tools', 'for', 'startups'])
  })
  it('returns empty array for blank input', () => {
    expect(tokenizeTopic('')).toEqual([])
    expect(tokenizeTopic('   ')).toEqual([])
  })
})
