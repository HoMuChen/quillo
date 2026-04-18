import { describe, it, expect } from 'vitest'
import { normalizeUrl } from './normalize'

describe('normalizeUrl', () => {
  it.each([
    ['HTTPS://Site.com/Post/?utm=x#top', 'https://site.com/post'],
    ['https://x.com/a/', 'https://x.com/a'],
    ['https://x.com/a', 'https://x.com/a'],
    ['https://x.com/a///', 'https://x.com/a'],
    ['https://x.com/', 'https://x.com'],
    ['https://x.com/a/b/c/', 'https://x.com/a/b/c'],
    ['https://x.com/a#section', 'https://x.com/a'],
    ['https://x.com/a?q=1', 'https://x.com/a'],
    ['https://x.com/a?q=1#f', 'https://x.com/a'],
    ['', null],
    [null as unknown as string, null],
    [undefined as unknown as string, null],
  ] as [string, string | null][])('normalizes %s → %s', (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected)
  })
})
