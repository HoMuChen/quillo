// Vercel AI Gateway model slugs. Zero markup vs provider list price.
// Versioned slugs use DOTS for versions, not hyphens.
export const MODELS = {
  // Long-form, planning, quality-sensitive generation.
  main: 'anthropic/claude-sonnet-4.6',
  // Short tasks: rewrite, meta suggestions.
  fast: 'anthropic/claude-haiku-4.5',
} as const

export type ModelKey = keyof typeof MODELS
