import { describe, it, expect } from 'vitest'
import { generateSeasonSchedule, detectClashes } from './scheduling'

describe('generateSeasonSchedule', () => {
  it('generates the correct number of episodes', () => {
    const entries = generateSeasonSchedule({
      recordRule: 'WEEKLY:THU',
      publishRule: 'WEEKLY:SAT',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
      skipDates: [],
    })
    expect(entries.length).toBeGreaterThan(10)
    expect(entries.every((e) => e.record_at.getDay() === 4)).toBe(true) // Thursday
    expect(entries.every((e) => e.publish_at.getDay() === 6)).toBe(true) // Saturday
  })

  it('skips specified dates', () => {
    const entries = generateSeasonSchedule({
      recordRule: 'WEEKLY:THU',
      publishRule: 'WEEKLY:SAT',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
      skipDates: ['2026-01-08'],
    })
    const dates = entries.map((e) => e.record_at.toISOString().slice(0, 10))
    expect(dates).not.toContain('2026-01-08')
  })

  it('assigns sequential episode numbers', () => {
    const entries = generateSeasonSchedule({
      recordRule: 'WEEKLY:MON',
      publishRule: 'WEEKLY:WED',
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-02-28'),
      skipDates: [],
      startEpisode: 10,
    })
    entries.forEach((e, i) => {
      expect(e.episode_no).toBe(10 + i)
    })
  })
})

describe('detectClashes', () => {
  it('detects overlapping events', () => {
    const events = [
      { id: 'a', starts_at: '2026-01-01T10:00:00Z', ends_at: '2026-01-01T12:00:00Z' },
      { id: 'b', starts_at: '2026-01-01T11:00:00Z', ends_at: '2026-01-01T13:00:00Z' },
      { id: 'c', starts_at: '2026-01-01T14:00:00Z', ends_at: '2026-01-01T16:00:00Z' },
    ]
    const clashes = detectClashes(events)
    expect(clashes).toHaveLength(1)
    expect(clashes[0]).toContain('a')
    expect(clashes[0]).toContain('b')
  })

  it('returns empty array when no clashes', () => {
    const events = [
      { id: 'a', starts_at: '2026-01-01T10:00:00Z', ends_at: '2026-01-01T11:00:00Z' },
      { id: 'b', starts_at: '2026-01-01T12:00:00Z', ends_at: '2026-01-01T13:00:00Z' },
    ]
    expect(detectClashes(events)).toHaveLength(0)
  })
})
