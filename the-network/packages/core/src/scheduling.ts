// Season scheduling helpers — generates record/publish dates from a recurrence rule.
// Rules are stored as cron-like strings: "WEEKLY:MON" or "WEEKLY:THU" etc.

export interface ScheduleEntry {
  record_at: Date
  publish_at: Date
  episode_no: number
}

function nextDayOfWeek(from: Date, dayName: string): Date {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const target = days.indexOf(dayName.toUpperCase())
  if (target === -1) throw new Error(`Unknown day: ${dayName}`)
  const d = new Date(from)
  const diff = (target - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function parseRule(rule: string): { period: 'WEEKLY'; day: string } {
  const [period, day] = rule.split(':')
  if (period !== 'WEEKLY') throw new Error(`Unsupported period: ${period}`)
  return { period: 'WEEKLY', day }
}

export function generateSeasonSchedule(opts: {
  recordRule: string
  publishRule: string
  startDate: Date
  endDate: Date
  skipDates: string[]
  startEpisode?: number
}): ScheduleEntry[] {
  const { recordRule, publishRule, startDate, endDate, skipDates, startEpisode = 1 } = opts
  const recordParsed = parseRule(recordRule)
  const publishParsed = parseRule(publishRule)

  const skipSet = new Set(skipDates.map((d) => d.slice(0, 10)))
  const entries: ScheduleEntry[] = []
  let episodeNo = startEpisode

  let cursor = nextDayOfWeek(new Date(startDate.getTime() - 1), recordParsed.day)
  while (cursor <= endDate) {
    const isoDate = cursor.toISOString().slice(0, 10)
    if (!skipSet.has(isoDate)) {
      const publish = nextDayOfWeek(new Date(cursor.getTime()), publishParsed.day)
      entries.push({ record_at: new Date(cursor), publish_at: publish, episode_no: episodeNo++ })
    }
    cursor = new Date(cursor)
    cursor.setDate(cursor.getDate() + 7)
  }
  return entries
}

export function detectClashes(
  events: Array<{ starts_at: string; ends_at: string; id: string }>,
): Array<[string, string]> {
  const clashes: Array<[string, string]> = []
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i]
      const b = events[j]
      const aStart = new Date(a.starts_at).getTime()
      const aEnd = new Date(a.ends_at).getTime()
      const bStart = new Date(b.starts_at).getTime()
      const bEnd = new Date(b.ends_at).getTime()
      if (aStart < bEnd && bStart < aEnd) {
        clashes.push([a.id, b.id])
      }
    }
  }
  return clashes
}
