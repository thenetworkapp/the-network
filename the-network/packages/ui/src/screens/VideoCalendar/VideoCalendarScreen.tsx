import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase, useAuth, generateSeasonSchedule, detectClashes } from '@network/core'
import type { Video, Show } from '@network/core'
import { Button } from '@network/ui'
import styles from './VideoCalendarScreen.module.css'

type ViewMode = 'month' | 'week' | 'season'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function formatShortDate(date: Date): string {
  const d = date.getDate()
  const m = MONTHS[date.getMonth()].slice(0, 3)
  const y = date.getFullYear()
  return `${d} ${m} ${y}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const SHOW_COLOURS = ['#1C3FCB', '#15803D', '#B25E00', '#7C3AED', '#0891B2']

export function VideoCalendarScreen(): JSX.Element {
  const { user } = useAuth()
  const [view, setView] = useState<ViewMode>('month')
  const [current, setCurrent] = useState(new Date())
  const [videos, setVideos] = useState<Video[]>([])
  const [shows, setShows] = useState<Show[]>([])
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [loading, setLoading] = useState(true)

  // Bulk booking form state
  const [bulkShow, setBulkShow] = useState('')
  const [bulkRecordDay, setBulkRecordDay] = useState('THU')
  const [bulkPublishDay, setBulkPublishDay] = useState('SAT')
  const [bulkStart, setBulkStart] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  })
  const [bulkEnd, setBulkEnd] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 3); d.setDate(0); return d.toISOString().slice(0, 10)
  })
  const [bulkSaving, setBulkSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [current, view])

  async function loadData(): Promise<void> {
    setLoading(true)
    const [vidRes, showRes] = await Promise.all([
      supabase.from('videos').select('*').not('record_at', 'is', null),
      supabase.from('shows').select('*').eq('archived', false),
    ])
    if (vidRes.data) setVideos(vidRes.data as Video[])
    if (showRes.data) setShows(showRes.data as Show[])
    setLoading(false)
  }

  // Show colour mapping
  const showColour = useMemo(() => {
    const map = new Map<string, string>()
    shows.forEach((s, i) => map.set(s.id, SHOW_COLOURS[i % SHOW_COLOURS.length]))
    return map
  }, [shows])

  // Month view helpers
  function getMonthDays(): Date[] {
    const year = current.getFullYear()
    const month = current.getMonth()
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    const startPad = (first.getDay() + 6) % 7 // Monday=0
    const days: Date[] = []
    for (let i = startPad; i > 0; i--) {
      days.push(new Date(year, month, 1 - i))
    }
    for (let d = 1; d <= last.getDate(); d++) {
      days.push(new Date(year, month, d))
    }
    while (days.length % 7 !== 0) {
      const lastDay = days[days.length - 1]
      days.push(new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1))
    }
    return days
  }

  function getVideosForDay(date: Date): Video[] {
    return videos.filter(v => v.record_at && isSameDay(new Date(v.record_at), date))
  }

  // Clash detection for displayed videos
  const clashPairs = useMemo(() => {
    const events = videos
      .filter(v => v.record_at)
      .map(v => ({
        id: v.id,
        starts_at: v.record_at!,
        ends_at: new Date(new Date(v.record_at!).getTime() + 3 * 60 * 60 * 1000).toISOString(),
      }))
    return detectClashes(events)
  }, [videos])

  const clashSet = useMemo(() => new Set(clashPairs.flat()), [clashPairs])

  // Bulk booking preview
  const bulkPreview = useMemo(() => {
    if (!bulkStart || !bulkEnd) return []
    try {
      return generateSeasonSchedule({
        recordRule: `WEEKLY:${bulkRecordDay}`,
        publishRule: `WEEKLY:${bulkPublishDay}`,
        startDate: new Date(bulkStart),
        endDate: new Date(bulkEnd),
        skipDates: [],
      })
    } catch { return [] }
  }, [bulkStart, bulkEnd, bulkRecordDay, bulkPublishDay])

  async function handleBulkBook(): Promise<void> {
    if (!bulkShow || bulkPreview.length === 0 || !user) return
    setBulkSaving(true)
    const show = shows.find(s => s.id === bulkShow)
    const rows = bulkPreview.map(entry => ({
      show_id: bulkShow,
      title: `${show?.name ?? 'Episode'} EP${String(entry.episode_no).padStart(2, '0')}`,
      episode_no: entry.episode_no,
      stage: 'scheduled' as const,
      record_at: entry.record_at.toISOString(),
      publish_at: entry.publish_at.toISOString(),
      edit_type: show?.default_edit_type ?? 'show',
      camera_mode: show?.default_camera ?? 'multi',
      created_by: user.id,
    }))
    const { error } = await supabase.from('videos').insert(rows)
    if (!error) {
      setShowBulkModal(false)
      await loadData()
    }
    setBulkSaving(false)
  }

  function navigate(delta: number): void {
    const d = new Date(current)
    if (view === 'month') d.setMonth(d.getMonth() + delta)
    else if (view === 'week') d.setDate(d.getDate() + delta * 7)
    else d.setFullYear(d.getFullYear() + delta)
    setCurrent(d)
  }

  const today = new Date()
  const monthDays = view === 'month' ? getMonthDays() : []
  const weekStart = view === 'week' ? startOfWeek(current) : new Date()
  const weekDays = view === 'week'
    ? Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d })
    : []

  const periodLabel = view === 'month'
    ? `${MONTHS[current.getMonth()]} ${current.getFullYear()}`
    : view === 'week'
    ? `${formatShortDate(weekStart)} – ${formatShortDate(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000))}`
    : `${current.getFullYear()} Season`

  return (
    <div className={styles.screen}>
      <div className={styles.toolbar}>
        <div className={styles.viewToggle}>
          {(['month', 'week', 'season'] as ViewMode[]).map(v => (
            <button key={v} className={`${styles.viewBtn} ${view === v ? styles.active : ''}`} onClick={() => setView(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        <button className={styles.navBtn} onClick={() => navigate(-1)} aria-label="Previous">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
        </button>
        <span className={styles.periodLabel}>{periodLabel}</span>
        <button className={styles.navBtn} onClick={() => navigate(1)} aria-label="Next">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
        </button>

        <div className={styles.spacer} />

        <Button variant="secondary" size="sm" onClick={() => setCurrent(new Date())}>Today</Button>
        <Button variant="primary" size="sm" onClick={() => setShowBulkModal(true)}>Bulk Season Booking</Button>
      </div>

      {/* Month view */}
      {view === 'month' && (
        <div className={styles.monthGrid}>
          <div className={styles.weekHeader}>
            {DAYS.map(d => <div key={d} className={styles.weekHeaderCell}>{d}</div>)}
          </div>
          <div className={styles.monthBody}>
            {Array.from({ length: monthDays.length / 7 }, (_, wi) => (
              <div key={wi} className={styles.weekRow}>
                {monthDays.slice(wi * 7, wi * 7 + 7).map((date, di) => {
                  const dayVideos = getVideosForDay(date)
                  const isOtherMonth = date.getMonth() !== current.getMonth()
                  const isToday = isSameDay(date, today)
                  const hasClash = dayVideos.some(v => clashSet.has(v.id))
                  return (
                    <div key={di} className={`${styles.dayCell} ${isOtherMonth ? styles.otherMonth : ''} ${isToday ? styles.today : ''}`}>
                      <span className={styles.dayNum}>{date.getDate()}</span>
                      {dayVideos.slice(0, 3).map(v => {
                        const colour = v.show_id ? showColour.get(v.show_id) : '#6B7180'
                        return (
                          <span key={v.id} className={styles.eventPill} style={{ background: colour }}>
                            {v.title}
                          </span>
                        )
                      })}
                      {dayVideos.length > 3 && (
                        <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>+{dayVideos.length - 3} more</span>
                      )}
                      {hasClash && <div className={styles.clashIndicator} title="Scheduling clash" />}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week view */}
      {view === 'week' && (
        <div className={styles.weekGrid}>
          <div className={styles.weekDayHeader}>
            <div />
            {weekDays.map(d => (
              <div key={d.toISOString()} className={`${styles.weekDayHeaderCell} ${isSameDay(d, today) ? styles.today : ''}`}>
                <div className={styles.weekDayName}>{DAYS[(d.getDay() + 6) % 7]}</div>
                <div className={styles.weekDayNum}>{d.getDate()}</div>
              </div>
            ))}
          </div>
          <div>
            {[9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(hour => (
              <div key={hour} className={styles.weekEventRow}>
                <div className={styles.weekTimeLabel}>{hour.toString().padStart(2, '0')}:00</div>
                {weekDays.map(d => {
                  const dayVideos = getVideosForDay(d).filter(v => {
                    if (!v.record_at) return false
                    const h = new Date(v.record_at).getHours()
                    return h === hour
                  })
                  return (
                    <div key={d.toISOString()} className={styles.weekDayCell}>
                      {dayVideos.map(v => {
                        const colour = v.show_id ? showColour.get(v.show_id) : '#6B7180'
                        return (
                          <span key={v.id} className={styles.eventPill} style={{ background: colour }}>
                            {v.title}
                          </span>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Season view — list by show */}
      {view === 'season' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {shows.map((show, si) => {
            const showVideos = videos.filter(v => v.show_id === show.id).sort((a, b) => {
              if (!a.record_at) return 1
              if (!b.record_at) return -1
              return new Date(a.record_at).getTime() - new Date(b.record_at).getTime()
            })
            return (
              <div key={show.id} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-line)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--color-line)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: SHOW_COLOURS[si % SHOW_COLOURS.length], flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-display)', fontStretch: '78%', fontSize: 14, fontWeight: 700, color: 'var(--color-ink)' }}>{show.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{showVideos.length} episodes</span>
                </div>
                {showVideos.length === 0 ? (
                  <div style={{ padding: '20px 16px', color: 'var(--color-muted)', fontSize: 13 }}>No episodes scheduled — use Bulk Season Booking to add some.</div>
                ) : (
                  <div>
                    {showVideos.map(v => (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderBottom: '1px solid var(--color-line)' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', width: 40 }}>EP{String(v.episode_no ?? 0).padStart(2, '0')}</span>
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--color-ink)' }}>{v.title}</span>
                        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                          {v.record_at ? `Rec ${new Date(v.record_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                          {v.publish_at ? `Pub ${new Date(v.publish_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 'var(--radius-control)', fontSize: 10, fontWeight: 600, background: 'var(--color-surface2)', color: 'var(--color-ink3)' }}>{v.stage.replace('_', ' ')}</span>
                        {clashSet.has(v.id) && <span style={{ fontSize: 10, color: 'var(--color-bad)', fontWeight: 600 }}>Clash</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Bulk Season Booking Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowBulkModal(false) }}
          >
            <motion.div
              className={styles.modal}
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            >
              <h2 className={styles.modalTitle}>Bulk Season Booking</h2>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="bulk-show">Show</label>
                <select id="bulk-show" className={styles.select} value={bulkShow} onChange={e => setBulkShow(e.target.value)}>
                  <option value="">Select a show…</option>
                  {shows.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="bulk-start">Season start</label>
                  <input id="bulk-start" type="date" className={styles.input} value={bulkStart} onChange={e => setBulkStart(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="bulk-end">Season end</label>
                  <input id="bulk-end" type="date" className={styles.input} value={bulkEnd} onChange={e => setBulkEnd(e.target.value)} />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="bulk-record">Recording day</label>
                  <select id="bulk-record" className={styles.select} value={bulkRecordDay} onChange={e => setBulkRecordDay(e.target.value)}>
                    {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="bulk-publish">Publish day</label>
                  <select id="bulk-publish" className={styles.select} value={bulkPublishDay} onChange={e => setBulkPublishDay(e.target.value)}>
                    {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              {bulkPreview.length > 0 && (
                <>
                  <div>
                    <div className={styles.label} style={{ marginBottom: 6 }}>Preview — {bulkPreview.length} episodes</div>
                    <div className={styles.previewList}>
                      {bulkPreview.slice(0, 10).map(e => (
                        <div key={e.episode_no} className={styles.previewItem}>
                          <span style={{ color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums', width: 30 }}>EP{String(e.episode_no).padStart(2, '0')}</span>
                          <span>Rec {e.record_at.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                          <span style={{ color: 'var(--color-muted)' }}>Pub {e.publish_at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      ))}
                      {bulkPreview.length > 10 && <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>…and {bulkPreview.length - 10} more</div>}
                    </div>
                  </div>
                  {clashPairs.length > 0 && (
                    <div className={styles.clashWarning}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7 1L1 12h12L7 1zm0 3v4m0 2v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" /></svg>
                      {clashPairs.length} clash{clashPairs.length > 1 ? 'es' : ''} detected with existing recordings
                    </div>
                  )}
                </>
              )}

              <div className={styles.modalActions}>
                <Button variant="secondary" size="sm" onClick={() => setShowBulkModal(false)}>Cancel</Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!bulkShow || bulkPreview.length === 0 || bulkSaving}
                  onClick={handleBulkBook}
                >
                  {bulkSaving ? 'Booking…' : `Book ${bulkPreview.length} episodes`}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
