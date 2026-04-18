'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  meta_title: z.string().nullable(),
  meta_description: z.string().nullable(),
  slug: z.string().nullable(),
  excerpt: z.string().nullable(),
  canonical_url: z.string().nullable(),
  focus_keyword: z.string().nullable(),
  tags: z.array(z.string()),
})

export async function saveSeoAction(
  projectId: string,
  articleId: string,
  input: z.infer<typeof schema>,
) {
  const parsed = schema.parse(input)
  const supabase = await createClient()
  const { error } = await supabase
    .from('articles')
    .update({
      meta_title: parsed.meta_title || null,
      meta_description: parsed.meta_description || null,
      slug: parsed.slug || null,
      excerpt: parsed.excerpt || null,
      canonical_url: parsed.canonical_url || null,
      focus_keyword: parsed.focus_keyword || null,
      tags: parsed.tags,
    })
    .eq('id', articleId)
  if (error) throw error
  revalidatePath(`/projects/${projectId}/articles/${articleId}/seo`)
}
