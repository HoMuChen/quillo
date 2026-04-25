import { z } from 'zod'

export async function validateBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<{ data: T } | Response> {
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad request', { status: 400 })
  return { data: parsed.data }
}
