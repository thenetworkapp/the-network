import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase, useAuth } from '@network/core'
import type { CalendarEvent, EventKind, Video } from '@network/core'
import styles from './CalendarScreen.module.css'

// ---- Constants ----

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const KIND_COLOURS: Record<EventKind, string> = {
  record:   '#1C3FCB',
  publish:  '#16A34A',
  review:   '#D97706',
  meeting:  '#7C3AED',
  deadline: '#DC2626',
}

const SPRING = { type: 'spring' as const, bounce: 0, duration: 0.35 }

// ---- Types ----

interface VideoWithShow extends Video {
  shows?: { name: string } | null
}

interface CalendarEventWithVideo extends CalendarEvent {
  videos?: {
    title: string
    show_id: string | null
    shows?: { name: string } | null
  } | null
}

interface SyntheticEvent {
  id: string
  kind: EventKind
  title: string
  starts_at: string
  ends_at: string
  video_id: string | null
  attendee_ids: string[]
  videos?: {
    title: string
    show_id: string | null
    shows?: { name: string } | null
  } | null
}

type AnyEvent = CalendarEventWithVideo | SyntheticEvent

// ---- Helpers ----

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatEventDateTime(starts_at: string, ends_at: string): string {
  const start = new Date(starts_at)
  const end = new Date(ends_at)
  const weekday = start.toLocaleDateString('en-GB', { weekday: 'short' })
  const day = start.getDate()
  const month = MONTHS_SHORT[start.getMonth()]
  const startTime = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  const endTime = end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${weekday} ${day} ${month} · ${startTime}–${endTime}`
}

function getMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startPad = (first.getDay() + 6) % 7 // Mon = 0
  const days: Date[] = []
  for (let i = startPad; i > 0; i--) {
    days.push(new Date(year, month, 1 - i))
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d))
  }
  while (days.length % 7 !== 0) {
    const prev = days[days.length - 1]
    days.push(new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1))
  }
  return days
}

// ---- Sub-components ----

interface EventPillProps {
  event: AnyEvent
  onClick: (e: AnyEvent) => void
}

function EventPill({ event, onClick }: EventPillProps): JSX.Element {
  return (
    <button
      className={styles.pill}
      style={{ background: KIND_COLOURS[event.kind] }}
      onClick={ev => { ev.stopPropagation(); onClick(event) }}
      title={event.title}
    >
      {event.title}
    </button>
  )
}

// ---- Event Detail Modal ----

interface DetailModalProps {
  event: AnyEvent
  onClose: () => void
}

function DetailModal({ event, onClose }: DetailModalProps): JSX.Element {
  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={SPRING}
      >
        <div className={styles.modalHeader}>
          <span
            className={styles.kindBadge}
            style={{ background: KIND_COLOURS[event.kind] }}
          >
            {event.kind}
          </span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <h2 className={styles.modalTitle}>{event.title}</h2>

        <p className={styles.modalMeta}>
          {formatEventDateTime(event.starts_at, event.ends_at)}
        </p>

        {event.videos && (
          <div className={styles.modalVideoLink}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M9 5.5l4-2v7l-4-2V5.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            <span>{event.videos.title}</span>
            {event.videos.shows && (
              <span className={styles.modalShowName}>— {event.videos.shows.name}</span>
            )}
          </div>
        )}

        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose}>Close</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ---- Add Event Modal ----

interface VideoOption {
  id: string
  title: string
}

interface AddEventModalProps {
  onClose: () => void
  onSaved: () => void
}

function AddEventModal({ onClose, onSaved }: AddEventModalProps): JSX.Element {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<EventKind>('meeting')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [videoId, setVideoId] = useState('')
  const [videos, setVideos] = useState<VideoOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('videos')
      .select('id, title')
      .order('title')
      .then(({ data }) => {
        if (data) setVideos(data as VideoOption[])
      })
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (!title.trim() || !startsAt || !endsAt) return
    setSaving(true)
    setError(null)

    const { error: err } = await supabase.from('calendar_events').insert({
      title: title.trim(),
      kind,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      video_id: videoId || null,
      attendee_ids: [],
    })

    if (err) {
      setError(err.message)
      setSaving(false)
    } else {
      onSaved()
    }
  }

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={SPRING}
      >
        <h2 className={styles.modalTitle}>Add Event</h2>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="ae-title">Title</label>
            <input
              id="ae-title"
              className={styles.input}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Event title"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="ae-kind">Kind</label>
            <select
              id="ae-kind"
              className={styles.select}
              value={kind}
              onChange={e => setKind(e.target.value as EventKind)}
            >
              {(['record', 'publish', 'review', 'meeting', 'deadline'] as EventKind[]).map(k => (
                <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="ae-starts">Starts at</label>
              <input
                id="ae-starts"
                type="datetime-local"
                className={styles.input}
                value={startsAt}
                onChange={e => setStartsAt(e.target.value)}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="ae-ends">Ends at</label>
              <input
                id="ae-ends"
                type="datetime-local"
                className={styles.input}
                value={endsAt}
                onChange={e => setEndsAt(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="ae-video">Video (optional)</label>
            <select
              id="ae-video"
              className={styles.select}
              value={videoId}
              onChange={e => setVideoId(e.target.value)}
            >
              <option value="">No video linked</option>
              {videos.map(v => (
                <option key={v.id} value={v.id}>{v.title}</option>
              ))}
            </select>
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={saving || !title.trim() || !startsAt || !endsAt}
            >
              {saving ? 'Saving…' : 'Add Event'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ---- Main Screen ----

export function CalendarScreen(): JSX.Element {
  useAuth()
  const today = new Date()
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [events, setEvents] = useState<CalendarEventWithVideo[]>([])
  const [videos, setVideos] = useState<VideoWithShow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<AnyEvent | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const year = current.getFullYear()
  const month = current.getMonth()

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true)

    // Range: first visible day (up to 6 days before month start) minus 1 week buffer
    const rangeStart = new Date(year, month, 1)
    rangeStart.setDate(rangeStart.getDate() - ((rangeStart.getDay() + 6) % 7) - 7)
    const rangeEnd = new Date(year, month + 1, 0)
    // Extend to end of last grid row + 1 week buffer
    while (rangeEnd.getDay() !== 0) rangeEnd.setDate(rangeEnd.getDate() + 1)
    rangeEnd.setDate(rangeEnd.getDate() + 7)

    const [evtRes, vidRes] = await Promise.all([
      supabase
        .from('calendar_events')
        .select('*, videos(title, show_id, shows(name))')
        .gte('starts_at', rangeStart.toISOString())
        .lte('starts_at', rangeEnd.toISOString())
        .order('starts_at'),
      supabase
        .from('videos')
        .select('*, shows(name)')
        .or(
          `record_at.gte.${new Date(year, month, 1).toISOString()},record_at.lte.${new Date(year, month + 1, 0, 23, 59, 59).toISOString()},` +
          `publish_at.gte.${new Date(year, month, 1).toISOString()},publish_at.lte.${new Date(year, month + 1, 0, 23, 59, 59).toISOString()}`
        ),
    ])

    if (evtRes.data) setEvents(evtRes.data as unknown as CalendarEventWithVideo[])
    if (vidRes.data) setVideos(vidRes.data as unknown as VideoWithShow[])
    setLoading(false)
  }, [year, month])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Build synthetic events from videos that don't have matching calendar events
  const allEvents: AnyEvent[] = (() => {
    const real = events as AnyEvent[]

    const synths: SyntheticEvent[] = []

    for (const v of videos) {
      if (v.record_at) {
        const synthId = `synthetic-${v.id}-record`
        const alreadyExists = events.some(
          e => e.video_id === v.id && e.kind === 'record'
        )
        if (!alreadyExists) {
          const start = new Date(v.record_at)
          const end = new Date(start.getTime() + 3 * 60 * 60 * 1000)
          synths.push({
            id: synthId,
            kind: 'record',
            title: v.title,
            starts_at: start.toISOString(),
            ends_at: end.toISOString(),
            video_id: v.id,
            attendee_ids: [],
            videos: {
              title: v.title,
              show_id: v.show_id,
              shows: (v as unknown as { shows?: { name: string } | null }).shows ?? null,
            },
          })
        }
      }
      if (v.publish_at) {
        const synthId = `synthetic-${v.id}-publish`
        const alreadyExists = events.some(
          e => e.video_id === v.id && e.kind === 'publish'
        )
        if (!alreadyExists) {
          const start = new Date(v.publish_at)
          const end = new Date(start.getTime() + 60 * 60 * 1000)
          synths.push({
            id: synthId,
            kind: 'publish',
            title: v.title,
            starts_at: start.toISOString(),
            ends_at: end.toISOString(),
            video_id: v.id,
            attendee_ids: [],
            videos: {
              title: v.title,
              show_id: v.show_id,
              shows: (v as unknown as { shows?: { name: string } | null }).shows ?? null,
            },
          })
        }
      }
    }

    return [...real, ...synths]
  })()

  function getEventsForDay(date: Date): AnyEvent[] {
    return allEvents
      .filter(e => isSameDay(new Date(e.starts_at), date))
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
  }

  function navigate(delta: number): void {
    setCurrent(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  const monthDays = getMonthGrid(year, month)
  const periodLabel = `${MONTHS[month]} ${year}`

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.toolbar}>
        <button className={styles.navBtn} onClick={() => navigate(-1)} aria-label="Previous month">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Prev
        </button>

        <h1 className={styles.periodLabel}>{periodLabel}</h1>

        <button className={styles.navBtn} onClick={() => navigate(1)} aria-label="Next month">
          Next
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className={styles.spacer} />

        {loading && (
          <div className={styles.spinner} aria-label="Loading" />
        )}

        <button
          className={styles.btnPrimary}
          onClick={() => setShowAddModal(true)}
        >
          Add Event
        </button>
      </div>

      {/* Calendar grid */}
      <div className={styles.grid}>
        {/* Day headers */}
        <div className={styles.dayHeaders}>
          {DAYS_SHORT.map(d => (
            <div key={d} className={styles.dayHeaderCell}>{d}</div>
          ))}
        </div>

        {/* Weeks */}
        <div className={styles.gridBody}>
          {Array.from({ length: monthDays.length / 7 }, (_, wi) => (
            <div key={wi} className={styles.weekRow}>
              {monthDays.slice(wi * 7, wi * 7 + 7).map((date, di) => {
                const dayEvents = getEventsForDay(date)
                const isOtherMonth = date.getMonth() !== month
                const isToday = isSameDay(date, today)
                const visible = dayEvents.slice(0, 3)
                const overflow = dayEvents.length - 3

                return (
                  <div
                    key={di}
                    className={[
                      styles.dayCell,
                      isOtherMonth ? styles.otherMonth : '',
                    ].join(' ')}
                  >
                    <span className={[styles.dayNum, isToday ? styles.dayNumToday : ''].join(' ')}>
                      {date.getDate()}
                    </span>

                    {visible.map(ev => (
                      <EventPill key={ev.id} event={ev} onClick={setSelectedEvent} />
                    ))}

                    {overflow > 0 && (
                      <span className={styles.overflowLabel}>+{overflow} more</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {selectedEvent && (
          <DetailModal
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddModal && (
          <AddEventModal
            onClose={() => setShowAddModal(false)}
            onSaved={() => {
              setShowAddModal(false)
              loadData()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
