'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  author_background: z.string().nullable(),
  reader_persona: z.string().nullable(),
  tone: z.string().nullable(),
  preferred_terms: z.array(z.string()),
  forbidden_terms: z.array(z.string()),
  ee_at_cases: z.string().nullable(),
})

export async function saveBrandAction(projectId: string, payload: z.infer<typeof schema>) {
  const parsed = schema.parse(payload)
  const supabase = await createClient()

  const { error } = await supabase
    .from('brand_materials')
    .update({
      author_background: parsed.author_background || null,
      reader_persona: parsed.reader_persona || null,
      tone: parsed.tone || null,
      preferred_terms: parsed.preferred_terms,
      forbidden_terms: parsed.forbidden_terms,
      ee_at_cases: parsed.ee_at_cases || null,
    })
    .eq('project_id', projectId)

  if (error) throw error
  revalidatePath(`/projects/${projectId}/brand`)
}
