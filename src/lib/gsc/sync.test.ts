import { describe, it, expect } from 'vitest'
import { computeSyncWindow } from './sync'

describe('computeSyncWindow', () => {
  const TODAY = '2026-04-23'

  it('uses 90-day cold start (default) when last_synced_at is null', () => {
    const w = computeSyncWindow(null, new Date(TODAY))
    expect(w.startDate).toBe('2026-01-23') // today - 90
    expect(w.endDate).toBe('2026-04-22')   // today - 1
  })

  it('respects custom coldStartDays', () => {
    const w = computeSyncWindow(null, new Date(TODAY), 16)
    expect(w.startDate).toBe('2026-04-07') // today - 16
    expect(w.endDate).toBe('2026-04-22')
  })

  it('uses last_synced_at - 3 days for warm runs', () => {
    const w = computeSyncWindow('2026-04-18T00:00:00Z', new Date(TODAY))
    expect(w.startDate).toBe('2026-04-15')
    expect(w.endDate).toBe('2026-04-22')
  })

  it('caps warm start at coldStartDays when last_synced_at is much earlier', () => {
    const w = computeSyncWindow('2026-01-01T00:00:00Z', new Date(TODAY), 90)
    expect(w.startDate).toBe('2026-01-23') // today - 90
  })
})
