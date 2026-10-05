import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { supabase, useAuth } from '@network/core'
import styles from './TodayScreen.module.css'

type Tab = 'today' | 'approvals' | 'messages' | 'record'

interface CalendarEvent {
  id: string
  show_id: string
  title: string
  starts_at: string
  ends_at: string
  location: string | null
}

interface Video {
  id: string
  show_id: string
  title: string
  records_at: string
  stage: string
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function stageBadgeClass(stage: string): string {
  switch (stage) {
    case 'live': return styles.stageLive
    case 'scheduled': return styles.stageScheduled
    case 'draft': return styles.stageDraft
    default: return styles.stageDefault
  }
}

interface TodayScreenProps {
  onNavigate: (tab: Tab) => void
}

export function TodayScreen({ onNavigate }: TodayScreenProps): JSX.Element {
  const { user } = useAuth()
  const [nextEvent, setNextEvent] = useState<CalendarEvent | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [loadingEvent, setLoadingEvent] = useState(true)
  const [loadingVideos, setLoadingVideos] = useState(true)
  const [markerSet, setMarkerSet] = useState(false)

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  useEffect(() => {
    if (!user) return
    const now = new Date().toISOString()

    supabase
      .from('calendar_events')
      .select('id, show_id, title, starts_at, ends_at, location')
      .gte('starts_at', now)
      .order('starts_at', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        setNextEvent((data as CalendarEvent[] | null)?.[0] ?? null)
        setLoadingEvent(false)
      })
  }, [user])

  useEffect(() => {
    if (!user) return

    supabase
      .from('videos')
      .select('id, show_id, title, records_at, stage')
      .gte('records_at', todayStart.toISOString())
      .lte('records_at', todayEnd.toISOString())
      .order('records_at', { ascending: true })
      .then(({ data }) => {
        setVideos((data as Video[] | null) ?? [])
        setLoadingVideos(false)
      })
  }, [user])

  function handleMarkReady(): void {
    setMarkerSet(true)
    // Optimistic UI — actual marker creation is handled in RecordMarkerScreen
  }

  return (
    <div className={styles.screen}>
      {/* Next Recording */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Next Recording</h2>
        {loadingEvent ? (
          <div className={styles.skeleton} />
        ) : nextEvent ? (
          <div className={styles.eventCard}>
            <div className={styles.eventTime}>{formatTime(nextEvent.starts_at)}</div>
            <div className={styles.eventTitle}>{nextEvent.title}</div>
            {nextEvent.location && (
              <div className={styles.eventMeta}>{nextEvent.location}</div>
            )}
          </div>
        ) : (
          <p className={styles.empty}>No upcoming recordings scheduled.</p>
        )}
      </section>

      {/* My Videos Today */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Videos Today</h2>
        {loadingVideos ? (
          <div className={styles.skeleton} />
        ) : videos.length > 0 ? (
          <div className={styles.videoList}>
            {videos.map(video => (
              <motion.div
                key={video.id}
                className={styles.videoCard}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
              >
                <div className={styles.thumbnail} aria-hidden="true" />
                <div className={styles.videoInfo}>
                  <div className={styles.videoTitle}>{video.title}</div>
                  <div className={styles.videoMeta}>{formatTime(video.records_at)}</div>
                </div>
                <span className={`${styles.stageBadge} ${stageBadgeClass(video.stage)}`}>
                  {video.stage}
                </span>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>No videos scheduled for today.</p>
        )}
      </section>

      {/* Quick Actions */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Quick Actions</h2>
        <div className={styles.quickActions}>
          <button
            className={`${styles.actionBtn} ${markerSet ? styles.actionBtnDone : ''}`}
            onClick={handleMarkReady}
            disabled={markerSet}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6" />
              <path d="M6.5 10l2.5 2.5 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {markerSet ? 'Ready marked' : 'Mark Ready'}
          </button>
          <button
            className={styles.actionBtn}
            onClick={() => onNavigate('record')}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <rect x="2" y="5" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M14 8l4-2v8l-4-2V8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
            View Rundown
          </button>
        </div>
      </section>
    </div>
  )
}
