'use server'

import type { PillarPlan } from '@/lib/ai/schemas'

export async function savePlanAction(
  _locale: 'zh-TW' | 'en',
  _projectId: string,
  _plan: PillarPlan,
) {
  // Task 29 implements this.
  throw new Error('savePlanAction not yet implemented — Task 29')
}
