import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '@network/core'
import type { Video, Show } from '@network/core'
import { Button } from '@network/ui'
import styles from './ScheduledVideosScreen.module.css'

// ─── Helpers ────────────────────────────────────────────────────────────────

const SPRING = { type: 'spring', bounce: 0, duration: 0.35 } as const

const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

function startOfWeek(d: Date): Date {
  const out = new Date(d)
  const day = out.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday-based week
  out.setDate(out.getDate() + diff)
  out.setHours(0, 0, 0, 0)
  return out
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function daysUntil(iso: string): number {
  const target = new Date(iso)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - TODAY.getTime()) / 86_400_000)
}

// ─── Types ───────────────────────────────────────────────────────────────────

type PreProductionStage = 'idea' | 'scheduled' | 'pre_production'
type WeekRange = 'this_week' | 'next_week' | 'next_4_weeks' | 'all'

interface VideoWithShow extends Video {
  shows: { name: string } | null
}

// ─── Stage display constants ─────────────────────────────────────────────────

const PRE_PROD_STAGES: PreProductionStage[] = ['idea', 'scheduled', 'pre_production']

const STAGE_LABELS: Record<PreProductionStage, string> = {
  idea: 'Idea',
  scheduled: 'Scheduled',
  pre_production: 'Pre-Production',
}

const STAGE_CLASS: Record<PreProductionStage, string> = {
  idea: styles.stageIdea,
  scheduled: styles.stageScheduled,
  pre_production: styles.stagePreProduction,
}

const WEEK_RANGE_LABELS: Record<WeekRange, string> = {
  this_week: 'This week',
  next_week: 'Next week',
  next_4_weeks: 'Next 4 weeks',
  all: 'All upcoming',
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ScheduledVideosScreen(): JSX.Element {
  const [videos, setVideos] = useState<VideoWithShow[]>([])
  const [shows, setShows] = useState<Show[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilter, setShowFilter] = useState<string>('all')
  const [stageFilter, setStageFilter] = useState<PreProductionStage | 'all'>('all')
  const [weekRange, setWeekRange] = useState<WeekRange>('this_week')
  const [sortAsc, setSortAsc] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  async function loadData(): Promise<void> {
    setLoading(true)
    const [vidRes, showRes] = await Promise.all([
      supabase
        .from('videos')
        .select('*, shows(name)')
        .in('stage', ['idea', 'scheduled', 'pre_production'])
        .gte('record_at', new Date().toISOString())
        .order('record_at', { ascending: true }),
      supabase.from('shows').select('*').eq('archived', false),
    ])
    if (vidRes.data) setVideos(vidRes.data as VideoWithShow[])
    if (showRes.data) setShows(showRes.data as Show[])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  // ── Compute date window from weekRange ──────────────────────────────────────

  const dateWindow = useMemo((): { from: Date; to: Date } | null => {
    const thisMonday = startOfWeek(TODAY)
    switch (weekRange) {
      case 'this_week':
        return { from: thisMonday, to: addDays(thisMonday, 7) }
      case 'next_week':
        return { from: addDays(thisMonday, 7), to: addDays(thisMonday, 14) }
      case 'next_4_weeks':
        return { from: thisMonday, to: addDays(thisMonday, 28) }
      case 'all':
        return null
    }
  }, [weekRange])

  // ── Filter + sort ───────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = videos.filter(v => {
      if (showFilter !== 'all' && v.show_id !== showFilter) return false
      if (stageFilter !== 'all' && v.stage !== stageFilter) return false
      if (dateWindow && v.record_at) {
        const recAt = new Date(v.record_at)
        if (recAt < dateWindow.from || recAt >= dateWindow.to) return false
      }
      return true
    })

    result = [...result].sort((a, b) => {
      const aTime = a.record_at ? new Date(a.record_at).getTime() : 0
      const bTime = b.record_at ? new Date(b.record_at).getTime() : 0
      return sortAsc ? aTime - bTime : bTime - aTime
    })

    return result
  }, [videos, showFilter, stageFilter, dateWindow, sortAsc])

  return (
    <div className={styles.screen}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <select
          className={styles.filterSelect}
          value={showFilter}
          onChange={e => setShowFilter(e.target.value)}
          aria-label="Filter by show"
        >
          <option value="all">All shows</option>
          {shows.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select
          className={styles.filterSelect}
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value as PreProductionStage | 'all')}
          aria-label="Filter by stage"
        >
          <option value="all">All Pre-Production</option>
          {PRE_PROD_STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>

        <div className={styles.weekButtons}>
          {(Object.keys(WEEK_RANGE_LABELS) as WeekRange[]).map(w => (
            <button
              key={w}
              className={`${styles.weekBtn} ${weekRange === w ? styles.weekBtnActive : ''}`}
              onClick={() => setWeekRange(w)}
            >
              {WEEK_RANGE_LABELS[w]}
            </button>
          ))}
        </div>

        <div className={styles.spacer} />
        <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>+ New Video</Button>
      </div>

      {/* Table */}
      <div className={styles.table}>
        <div className={`${styles.thead} ${styles.tableGrid}`}>
          <div className={styles.th}>Show</div>
          <div className={styles.th}>Title</div>
          <div className={styles.th}>Stage</div>
          <button
            className={`${styles.th} ${styles.thSortable}`}
            onClick={() => setSortAsc(a => !a)}
            aria-label={`Sort by recording date ${sortAsc ? 'descending' : 'ascending'}`}
          >
            Records at{sortAsc ? ' ↑' : ' ↓'}
          </button>
          <div className={styles.th}>Days until</div>
        </div>

        {loading ? (
          <div className={styles.emptyState}><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState onNewVideo={() => setModalOpen(true)} />
        ) : (
          filtered.map(video => (
            <VideoRow key={video.id} video={video} />
          ))
        )}
      </div>

      {/* Create Video modal */}
      <AnimatePresence>
        {modalOpen && (
          <CreateVideoModal
            shows={shows}
            onClose={() => setModalOpen(false)}
            onCreated={() => { setModalOpen(false); loadData() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Video row ────────────────────────────────────────────────────────────────

function VideoRow({ video }: { video: VideoWithShow }): JSX.Element {
  const recordAt = video.record_at ?? ''
  const days = recordAt ? daysUntil(recordAt) : 0
  const daysClass = days > 14 ? styles.daysGreen : days >= 7 ? styles.daysAmber : styles.daysRed
  const stage = video.stage as PreProductionStage

  return (
    <motion.div
      className={`${styles.row} ${styles.tableGrid}`}
      whileHover={{ x: 2 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.15 }}
    >
      <div className={styles.td} style={{ fontSize: 12, color: 'var(--color-muted)' }}>
        {video.shows?.name ?? '—'}
      </div>
      <div className={`${styles.td} ${styles.titleCell}`}>
        {video.title}
      </div>
      <div className={styles.td}>
        <span className={`${styles.stagePill} ${STAGE_CLASS[stage] ?? ''}`}>
          {STAGE_LABELS[stage] ?? stage}
        </span>
      </div>
      <div className={styles.td} style={{ fontSize: 12, color: 'var(--color-ink3)', fontVariantNumeric: 'tabular-nums' }}>
        {recordAt ? fmtDateTime(recordAt) : '—'}
      </div>
      <div className={styles.td}>
        {recordAt ? (
          <span className={`${styles.daysBadge} ${daysClass}`}>
            {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
          </span>
        ) : (
          <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>—</span>
        )}
      </div>
    </motion.div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onNewVideo }: { onNewVideo: () => void }): JSX.Element {
  return (
    <div className={styles.emptyState}>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="4" y="8" width="32" height="26" rx="4" stroke="var(--color-line)" strokeWidth="1.5" />
        <path d="M4 15h32" stroke="var(--color-line)" strokeWidth="1.5" />
        <path d="M13 5v6M27 5v6" stroke="var(--color-line)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="20" cy="26" r="5" stroke="var(--color-line)" strokeWidth="1.5" />
        <path d="M20 23v3l2 1" stroke="var(--color-line)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>No upcoming videos</span>
      <Button variant="secondary" size="sm" onClick={onNewVideo}>
        Schedule your first video
      </Button>
    </div>
  )
}

// ─── Create video modal ───────────────────────────────────────────────────────

function CreateVideoModal({
  shows,
  onClose,
  onCreated,
}: {
  shows: Show[]
  onClose: () => void
  onCreated: () => void
}): JSX.Element {
  const [showId, setShowId] = useState<string>(shows[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [recordDate, setRecordDate] = useState<string>('')
  const [recordTime, setRecordTime] = useState<string>('10:00')
  const [stage, setStage] = useState<PreProductionStage>('scheduled')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function buildRecordAt(): string {
    if (!recordDate) return ''
    return new Date(`${recordDate}T${recordTime || '00:00'}`).toISOString()
  }

  async function handleSubmit(): Promise<void> {
    if (!title.trim() || !recordDate || !showId) {
      setError('Please fill in all required fields.')
      return
    }
    setSaving(true)
    setError(null)
    const { error: dbErr } = await supabase.from('videos').insert({
      show_id: showId,
      title: title.trim(),
      record_at: buildRecordAt(),
      stage,
    })
    setSaving(false)
    if (dbErr) {
      setError(dbErr.message)
      return
    }
    onCreated()
  }

  return (
    <>
      <motion.div
        className={styles.backdrop}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={SPRING}
        onClick={onClose}
      />
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={SPRING}
        role="dialog"
        aria-modal="true"
        aria-label="New video"
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>New Video</h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">&#x2715;</button>
        </div>

        <div className={styles.modalBody}>
          {error && <div className={styles.formError}>{error}</div>}

          <label className={styles.label}>
            Show
            <select
              className={styles.input}
              value={showId}
              onChange={e => setShowId(e.target.value)}
            >
              {shows.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>

          <label className={styles.label}>
            Title
            <input
              className={styles.input}
              type="text"
              placeholder="Episode title"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </label>

          <div className={styles.row2}>
            <label className={styles.label}>
              Records at (date)
              <input
                className={styles.input}
                type="date"
                value={recordDate}
                onChange={e => setRecordDate(e.target.value)}
              />
            </label>
            <label className={styles.label}>
              Time
              <input
                className={styles.input}
                type="time"
                value={recordTime}
                onChange={e => setRecordTime(e.target.value)}
              />
            </label>
          </div>

          <label className={styles.label}>
            Stage
            <select
              className={styles.input}
              value={stage}
              onChange={e => setStage(e.target.value as PreProductionStage)}
            >
              {PRE_PROD_STAGES.map(s => (
                <option key={s} value={s}>{STAGE_LABELS[s]}</option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.modalFooter}>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={saving || !title.trim() || !recordDate}
          >
            {saving ? 'Creating…' : 'Create video'}
          </Button>
        </div>
      </motion.div>
    </>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner(): JSX.Element {
  return (
    <>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        border: '2px solid var(--color-line)',
        borderTopColor: 'var(--color-blue)',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}
