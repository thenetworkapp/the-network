import { useState, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import { supabase } from '@network/core'
import type { VideoStage, JobKind, JobStatus } from '@network/core'
import styles from './ShowDashboardScreen.module.css'

// ---- Local interfaces ----

interface ShowRow {
  id: string
  name: string
  slug: string
  archived: boolean
}

interface VideoRow {
  id: string
  show_id: string | null
  title: string
  stage: VideoStage
  records_at: string | null
  created_at: string
}

interface ApprovalRow {
  id: string
  subject_type: string
  subject_id: string
  status: string
  assigned_position_id: string
  created_at: string
}

interface PositionRow {
  id: string
  title: string
}

interface CalendarEventRow {
  id: string
  show_id: string
  title: string
  starts_at: string
  kind: string
}

interface JobRow {
  id: string
  kind: JobKind
  video_id: string
  target_device_id: string
  status: JobStatus
  progress: number
  created_at: string
}

// ---- Stage colour mapping ----

const STAGE_LABELS: Record<VideoStage, string> = {
  idea: 'Idea',
  scheduled: 'Scheduled',
  pre_production: 'Pre-Production',
  recording: 'Recording',
  footage_received: 'Footage Received',
  ai_editing: 'AI Editing',
  review: 'Review',
  approved: 'Approved',
  packaging: 'Packaging',
  upload_ready: 'Upload Ready',
  published: 'Published',
  archived: 'Archived',
}

const STAGE_CLASS: Record<VideoStage, string> = {
  idea: styles.stageIdea,
  scheduled: styles.stageScheduled,
  pre_production: styles.stagePreProd,
  recording: styles.stageRecording,
  footage_received: styles.stageFootage,
  ai_editing: styles.stageAiEditing,
  review: styles.stageReview,
  approved: styles.stageApproved,
  packaging: styles.stagePackaging,
  upload_ready: styles.stageUploadReady,
  published: styles.stagePublished,
  archived: styles.stageArchived,
}

const JOB_KIND_LABELS: Record<JobKind, string> = {
  proxy: 'Proxy',
  ai_edit: 'AI Edit',
  render: 'Render',
  clips: 'Clips',
  review_copy: 'Review Copy',
  backup: 'Backup',
}

// ---- Helpers ----

function formatRecordAt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatNextRecord(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function daysAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function shortId(id: string): string {
  return id.slice(0, 8)
}

const SPRING = { type: 'spring', bounce: 0, duration: 0.35 } as const

// ---- Main screen ----

export function ShowDashboardScreen(): JSX.Element {
  // Show selection
  const [shows, setShows] = useState<ShowRow[]>([])
  const [activeShowId, setActiveShowId] = useState<string>(() => {
    return localStorage.getItem('active-show-id') ?? ''
  })

  // Data
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [approvals, setApprovals] = useState<ApprovalRow[]>([])
  const [positions, setPositions] = useState<Map<string, PositionRow>>(new Map())
  const [nextRecord, setNextRecord] = useState<CalendarEventRow | null>(null)
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(false)
  const [monthVideoCount, setMonthVideoCount] = useState(0)

  // Load shows once
  useEffect(() => {
    supabase
      .from('shows')
      .select('id, name, slug, archived')
      .eq('archived', false)
      .order('name')
      .then(({ data }) => {
        if (!data || data.length === 0) return
        const rows = data as ShowRow[]
        setShows(rows)
        const stored = localStorage.getItem('active-show-id')
        if (!stored || !rows.find(s => s.id === stored)) {
          const first = rows[0].id
          setActiveShowId(first)
          localStorage.setItem('active-show-id', first)
        }
      })
  }, [])

  function handleShowChange(id: string): void {
    setActiveShowId(id)
    localStorage.setItem('active-show-id', id)
  }

  const loadShowData = useCallback(async (showId: string): Promise<void> => {
    if (!showId) return
    setLoading(true)

    const now = new Date().toISOString()
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString()

    const [videosRes, calRes] = await Promise.all([
      supabase
        .from('videos')
        .select('id, show_id, title, stage, records_at, created_at')
        .eq('show_id', showId)
        .order('created_at', { ascending: false })
        .limit(12),
      supabase
        .from('calendar_events')
        .select('id, show_id, title, starts_at, kind')
        .eq('show_id', showId)
        .eq('kind', 'record')
        .gte('starts_at', now)
        .order('starts_at', { ascending: true })
        .limit(1),
    ])

    const videoRows = (videosRes.data ?? []) as VideoRow[]
    setVideos(videoRows)
    setNextRecord(((calRes.data ?? []) as CalendarEventRow[])[0] ?? null)

    const videoIds = videoRows.map(v => v.id)

    if (videoIds.length === 0) {
      setApprovals([])
      setJobs([])
      setLoading(false)
      return
    }

    // Count videos this month (need a separate query for the count)
    const [approvalsRes, jobsRes, posRes, monthVideosRes] = await Promise.all([
      supabase
        .from('approvals')
        .select('id, subject_type, subject_id, status, assigned_position_id, created_at')
        .in('subject_id', videoIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('jobs')
        .select('id, kind, video_id, target_device_id, status, progress, created_at')
        .in('video_id', videoIds)
        .in('status', ['queued', 'running']),
      supabase
        .from('positions')
        .select('id, title'),
      supabase
        .from('videos')
        .select('id', { count: 'exact', head: true })
        .eq('show_id', showId)
        .gte('records_at', monthStart)
        .lte('records_at', monthEnd),
    ])

    setApprovals((approvalsRes.data ?? []) as ApprovalRow[])
    setJobs((jobsRes.data ?? []) as JobRow[])

    const posMap = new Map<string, PositionRow>()
    ;((posRes.data ?? []) as PositionRow[]).forEach(p => posMap.set(p.id, p))
    setPositions(posMap)

    // Attach month video count to state separately
    setMonthVideoCount(monthVideosRes.count ?? 0)

    setLoading(false)
  }, [])

  useEffect(() => {
    if (activeShowId) {
      loadShowData(activeShowId)
    }
  }, [activeShowId, loadShowData])

  // Realtime subscription for jobs
  useEffect(() => {
    if (!activeShowId || videos.length === 0) return
    const videoIds = videos.map(v => v.id)

    const channel = supabase
      .channel(`jobs-show-${activeShowId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs', filter: `video_id=in.(${videoIds.join(',')})` },
        () => { loadShowData(activeShowId) }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeShowId, videos, loadShowData])

  const currentShow = shows.find(s => s.id === activeShowId)
  const activeJobs = jobs.filter(j => j.status === 'queued' || j.status === 'running')
  const runningJobs = jobs.filter(j => j.status === 'running' || j.status === 'queued')

  return (
    <div className={styles.screen}>

      {/* Show selector */}
      <div className={styles.topBar}>
        <select
          className={styles.showSelect}
          value={activeShowId}
          onChange={e => handleShowChange(e.target.value)}
          aria-label="Select show"
        >
          {shows.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className={styles.spinner}>
          <div className={styles.spinnerDot} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {!loading && (
        <>
          {/* Summary bar */}
          <div className={styles.summaryBar}>
            <motion.div
              className={styles.statCard}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: 0 }}
            >
              <div className={styles.statValue}>{monthVideoCount}</div>
              <div className={styles.statLabel}>Videos This Month</div>
            </motion.div>

            <motion.div
              className={styles.statCard}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: 0.05 }}
            >
              <div className={styles.statValue}>{approvals.length}</div>
              <div className={styles.statLabel}>Pending Approvals</div>
            </motion.div>

            <motion.div
              className={styles.statCard}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: 0.1 }}
            >
              <div className={styles.statValue}>
                {nextRecord ? formatNextRecord(nextRecord.starts_at) : '—'}
              </div>
              <div className={styles.statLabel}>Next Record</div>
            </motion.div>

            <motion.div
              className={styles.statCard}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: 0.15 }}
            >
              <div className={styles.statValue}>{activeJobs.length}</div>
              <div className={styles.statLabel}>Active Jobs</div>
            </motion.div>
          </div>

          {/* Recent Videos */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Recent Videos</h2>
            {videos.length === 0 ? (
              <p className={styles.emptyText}>No videos for this show yet.</p>
            ) : (
              <div className={styles.videoGrid}>
                {videos.map((video, i) => (
                  <motion.div
                    key={video.id}
                    className={styles.videoCard}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING, delay: i * 0.03 }}
                  >
                    <div className={styles.videoThumb} aria-hidden="true" />
                    <div className={styles.videoMeta}>
                      <span className={styles.videoShow}>{currentShow?.name ?? '—'}</span>
                      <span className={`${styles.stageBadge} ${STAGE_CLASS[video.stage]}`}>
                        {STAGE_LABELS[video.stage]}
                      </span>
                    </div>
                    <div className={styles.videoTitle}>{video.title}</div>
                    <div className={styles.videoDate}>{formatRecordAt(video.records_at)}</div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          {/* Pending Approvals */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Pending Approvals</h2>
            {approvals.length === 0 ? (
              <p className={styles.emptyText}>No pending approvals.</p>
            ) : (
              <div className={styles.list}>
                {approvals.map(approval => (
                  <div key={approval.id} className={styles.listRow}>
                    <div className={styles.listMain}>
                      <div className={styles.listTitle}>
                        Video approval #{shortId(approval.subject_id)}
                      </div>
                      <div className={styles.listSub}>
                        {positions.get(approval.assigned_position_id)?.title ?? 'Unassigned'}
                      </div>
                    </div>
                    <div className={styles.listMeta}>
                      <span className={styles.daysAgo}>{daysAgo(approval.created_at)}</span>
                      <button className={styles.viewLink}>View</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Running Jobs */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Running Jobs</h2>
            {runningJobs.length === 0 ? (
              <p className={styles.emptyText}>No active jobs.</p>
            ) : (
              <div className={styles.list}>
                {runningJobs.map(job => {
                  const video = videos.find(v => v.id === job.video_id)
                  return (
                    <div key={job.id} className={styles.listRow}>
                      <div className={styles.listMain}>
                        <div className={styles.listTitle}>
                          <span className={styles.kindBadge}>{JOB_KIND_LABELS[job.kind]}</span>
                          {video?.title ?? 'Unknown video'}
                        </div>
                        <div className={styles.listSub}>
                          Device {job.target_device_id.slice(0, 8)}…
                        </div>
                        {job.status === 'running' && (
                          <div className={styles.progressBar}>
                            <motion.div
                              className={styles.progressFill}
                              initial={{ width: 0 }}
                              animate={{ width: `${job.progress ?? 0}%` }}
                              transition={SPRING}
                            />
                          </div>
                        )}
                      </div>
                      <div className={styles.listMeta}>
                        <span className={`${styles.statusBadge} ${job.status === 'running' ? styles.statusRunning : styles.statusQueued}`}>
                          {job.status}
                        </span>
                        {job.status === 'running' && (
                          <span className={styles.progressLabel}>{Math.round(job.progress ?? 0)}%</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
