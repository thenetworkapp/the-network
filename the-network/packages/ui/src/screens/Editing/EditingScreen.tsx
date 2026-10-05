import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase, useAuth } from '@network/core'
import type { Job, JobKind, JobStatus, EditDecision, DecisionStatus, Show, Video, Device, EditType } from '@network/core'
import { Button } from '@network/ui'
import styles from './EditingScreen.module.css'

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtSec(s: number): string {
  const m = Math.floor(s / 60)
  return `${m}m${Math.floor(s % 60)}s`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const SPRING = { type: 'spring', bounce: 0, duration: 0.35 } as const

// ─── Jobs tab constants ──────────────────────────────────────────────────────

const JOB_KIND_LABELS: Record<JobKind, string> = {
  proxy: 'Proxy',
  ai_edit: 'AI Edit',
  render: 'Render',
  clips: 'Clips',
  review_copy: 'Review Copy',
  backup: 'Backup',
}

const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

type StatusFilter = 'all' | JobStatus

// ─── Decision / Risk types ───────────────────────────────────────────────────

type RiskKind = 'legal' | 'copyright' | 'language' | 'sensitive'
type RiskStatus = 'open' | 'acknowledged' | 'resolved'

interface RiskFlag {
  id: string
  video_id: string
  kind: RiskKind
  start_s: number
  end_s: number
  note: string
  status: RiskStatus
}

type RiskKindFilter = 'all' | RiskKind
type RiskStatusFilter = 'all' | RiskStatus

// ─── Tab type ────────────────────────────────────────────────────────────────

type Tab = 'jobs' | 'decisions' | 'risk'

// ─── Main component ──────────────────────────────────────────────────────────

export function EditingScreen(): JSX.Element {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('jobs')

  return (
    <div className={styles.screen}>
      <div className={styles.tabs}>
        {(['jobs', 'decisions', 'risk'] as Tab[]).map(tab => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'jobs' ? 'Jobs' : tab === 'decisions' ? 'Decisions' : 'Risk Flags'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'jobs' && (
          <motion.div key="jobs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SPRING}>
            <JobsTab userId={user?.id ?? ''} />
          </motion.div>
        )}
        {activeTab === 'decisions' && (
          <motion.div key="decisions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SPRING}>
            <DecisionsTab />
          </motion.div>
        )}
        {activeTab === 'risk' && (
          <motion.div key="risk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SPRING}>
            <RiskFlagsTab />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOBS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function JobsTab({ userId }: { userId: string }): JSX.Element {
  const [jobs, setJobs] = useState<Job[]>([])
  const [shows, setShows] = useState<Show[]>([])
  const [showFilter, setShowFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // video_id → show name mapping built from jobs + shows
  const [videoShowMap, setVideoShowMap] = useState<Map<string, string>>(new Map())

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true)
    const [jobRes, showRes] = await Promise.all([
      supabase
        .from('jobs')
        .select('*, videos(show_id, title, shows(name))')
        .order('created_at', { ascending: false }),
      supabase.from('shows').select('*').eq('archived', false),
    ])
    if (jobRes.data) {
      const rawJobs = jobRes.data as (Job & { videos: { show_id: string | null; title: string; shows: { name: string } | null } | null })[]
      setJobs(rawJobs.map(j => ({
        id: j.id,
        kind: j.kind,
        video_id: j.video_id,
        target_device_id: j.target_device_id,
        status: j.status,
        progress: j.progress,
        payload: j.payload,
        result: j.result,
        error: j.error,
        created_by: j.created_by,
        created_at: j.created_at,
        updated_at: j.updated_at,
      })))
      const vsm = new Map<string, string>()
      rawJobs.forEach(j => {
        if (j.videos?.shows?.name) vsm.set(j.video_id, j.videos.shows.name)
      })
      setVideoShowMap(vsm)
    }
    if (showRes.data) setShows(showRes.data as Show[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('jobs-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' },
        (_payload: { new: Record<string, unknown> }) => { loadData() })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs' },
        (_payload: { new: Record<string, unknown> }) => { loadData() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadData])

  const filtered = jobs.filter(j => {
    if (showFilter !== 'all') {
      const showName = videoShowMap.get(j.video_id)
      if (showName !== shows.find(s => s.id === showFilter)?.name) return false
    }
    if (statusFilter !== 'all' && j.status !== statusFilter) return false
    return true
  })

  const STATUS_FILTERS: StatusFilter[] = ['all', 'queued', 'running', 'done', 'failed']

  return (
    <div className={styles.tabContent}>
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

        <div className={styles.statusFilters}>
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              className={`${styles.statusFilterBtn} ${statusFilter === f ? styles.statusFilterActive : ''}`}
              onClick={() => setStatusFilter(f)}
            >
              {f === 'all' ? 'All' : JOB_STATUS_LABELS[f]}
            </button>
          ))}
        </div>

        <div className={styles.spacer} />
        <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>Run AI Edit</Button>
      </div>

      <div className={styles.table}>
        <div className={`${styles.thead} ${styles.jobsGrid}`}>
          <div className={styles.th}>Kind</div>
          <div className={styles.th}>Video</div>
          <div className={styles.th}>Status</div>
          <div className={styles.th}>Progress</div>
          <div className={styles.th}>Device</div>
          <div className={styles.th}>Started</div>
          <div className={styles.th}>Updated</div>
        </div>

        {loading ? (
          <div className={styles.emptyState}><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>No jobs found</div>
        ) : (
          filtered.map(job => (
            <JobRow
              key={job.id}
              job={job}
              expanded={expandedId === job.id}
              onToggle={() => setExpandedId(expandedId === job.id ? null : job.id)}
            />
          ))
        )}
      </div>

      <AnimatePresence>
        {modalOpen && (
          <RunAiEditModal
            shows={shows}
            userId={userId}
            onClose={() => setModalOpen(false)}
            onCreated={() => { setModalOpen(false); loadData() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Job row ─────────────────────────────────────────────────────────────────

function JobRow({
  job,
  expanded,
  onToggle,
}: {
  job: Job
  expanded: boolean
  onToggle: () => void
}): JSX.Element {
  return (
    <>
      <motion.div
        className={`${styles.row} ${styles.jobsGrid} ${expanded ? styles.rowExpanded : ''}`}
        onClick={onToggle}
        whileHover={{ x: 2 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.15 }}
      >
        <div className={styles.td}>
          <span className={styles.kindPill}>{JOB_KIND_LABELS[job.kind]}</span>
        </div>
        <div className={styles.td} style={{ fontSize: 12, color: 'var(--color-ink2)' }}>
          {job.video_id.slice(0, 8)}…
        </div>
        <div className={styles.td}>
          <JobStatusBadge status={job.status} />
        </div>
        <div className={styles.td}>
          {job.status === 'running' ? (
            <div className={styles.progressBarWrap}>
              <div className={styles.progressBar} style={{ width: `${Math.min(job.progress, 100)}%` }} />
            </div>
          ) : job.status === 'done' ? (
            <span style={{ fontSize: 12, color: 'var(--color-ok)' }}>{Math.round(job.progress)}%</span>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>—</span>
          )}
        </div>
        <div className={styles.td} style={{ fontSize: 12, color: 'var(--color-muted)' }}>
          {job.target_device_id.slice(0, 8)}…
        </div>
        <div className={styles.td} style={{ fontSize: 12, color: 'var(--color-muted)' }}>
          {fmtDate(job.created_at)}
        </div>
        <div className={styles.td} style={{ fontSize: 12, color: 'var(--color-muted)' }}>
          {fmtDate(job.updated_at)}
        </div>
      </motion.div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className={styles.rowDetail}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING}
          >
            <div className={styles.rowDetailInner}>
              <div className={styles.detailBlock}>
                <div className={styles.detailLabel}>Payload</div>
                <pre className={styles.pre}>{JSON.stringify(job.payload, null, 2)}</pre>
              </div>
              {job.status === 'failed' && job.error && (
                <div className={styles.detailBlock}>
                  <div className={`${styles.detailLabel} ${styles.detailError}`}>Error</div>
                  <pre className={`${styles.pre} ${styles.preError}`}>{job.error}</pre>
                </div>
              )}
              {job.status === 'done' && job.result && (
                <div className={styles.detailBlock}>
                  <div className={styles.detailLabel}>Result</div>
                  <pre className={styles.pre}>{JSON.stringify(job.result, null, 2)}</pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Job status badge ─────────────────────────────────────────────────────────

function JobStatusBadge({ status }: { status: JobStatus }): JSX.Element {
  const classMap: Record<JobStatus, string> = {
    queued: styles.badgeQueued,
    running: styles.badgeRunning,
    done: styles.badgeDone,
    failed: styles.badgeFailed,
    cancelled: styles.badgeCancelled,
  }
  return (
    <span className={`${styles.statusBadge} ${classMap[status]}`}>
      {JOB_STATUS_LABELS[status]}
    </span>
  )
}

// ─── Run AI Edit modal ────────────────────────────────────────────────────────

function RunAiEditModal({
  shows,
  userId,
  onClose,
  onCreated,
}: {
  shows: Show[]
  userId: string
  onClose: () => void
  onCreated: () => void
}): JSX.Element {
  const [selectedShow, setSelectedShow] = useState<string>(shows[0]?.id ?? '')
  const [videos, setVideos] = useState<Video[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [videoId, setVideoId] = useState<string>('')
  const [deviceId, setDeviceId] = useState<string>('')
  const [editType, setEditType] = useState<EditType>('show')
  const [saving, setSaving] = useState(false)
  const [loadingMeta, setLoadingMeta] = useState(false)

  useEffect(() => {
    if (!selectedShow) return
    setLoadingMeta(true)
    Promise.all([
      supabase
        .from('videos')
        .select('*')
        .eq('show_id', selectedShow)
        .eq('stage', 'footage_received'),
      supabase
        .from('devices')
        .select('*'),
    ]).then(([vidRes, devRes]) => {
      const vids = (vidRes.data ?? []) as Video[]
      const devs = (devRes.data ?? []) as Device[]
      setVideos(vids)
      setVideoId(vids[0]?.id ?? '')
      setDevices(devs)
      setDeviceId(devs[0]?.id ?? '')
      setLoadingMeta(false)
    })
  }, [selectedShow])

  async function handleSubmit(): Promise<void> {
    if (!videoId || !deviceId) return
    setSaving(true)
    await supabase.from('jobs').insert({
      kind: 'ai_edit' as JobKind,
      video_id: videoId,
      target_device_id: deviceId,
      status: 'queued' as JobStatus,
      progress: 0,
      payload: { edit_type: editType },
      result: null,
      error: null,
      created_by: userId,
    })
    setSaving(false)
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
        aria-label="Run AI Edit"
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Run AI Edit</h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">&#x2715;</button>
        </div>

        <div className={styles.modalBody}>
          <label className={styles.label}>
            Show
            <select
              className={styles.input}
              value={selectedShow}
              onChange={e => setSelectedShow(e.target.value)}
            >
              {shows.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>

          <label className={styles.label}>
            Video (footage received)
            <select
              className={styles.input}
              value={videoId}
              onChange={e => setVideoId(e.target.value)}
              disabled={loadingMeta || videos.length === 0}
            >
              {videos.length === 0
                ? <option value="">No videos ready</option>
                : videos.map(v => <option key={v.id} value={v.id}>{v.title}</option>)
              }
            </select>
          </label>

          <label className={styles.label}>
            Target device
            <select
              className={styles.input}
              value={deviceId}
              onChange={e => setDeviceId(e.target.value)}
              disabled={loadingMeta || devices.length === 0}
            >
              {devices.length === 0
                ? <option value="">No devices</option>
                : devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)
              }
            </select>
          </label>

          <label className={styles.label}>
            Edit type
            <select
              className={styles.input}
              value={editType}
              onChange={e => setEditType(e.target.value as EditType)}
            >
              <option value="show">Show</option>
              <option value="podcast">Podcast</option>
              <option value="quick">Quick</option>
            </select>
          </label>
        </div>

        <div className={styles.modalFooter}>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={saving || !videoId || !deviceId}
          >
            {saving ? 'Queuing…' : 'Queue job'}
          </Button>
        </div>
      </motion.div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DECISIONS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function DecisionsTab(): JSX.Element {
  const [decisions, setDecisions] = useState<EditDecision[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [videoFilter, setVideoFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  async function loadData(): Promise<void> {
    setLoading(true)
    const [decRes, vidRes] = await Promise.all([
      supabase.from('edit_decisions').select('*').order('start_s', { ascending: true }),
      supabase.from('videos').select('id, title').order('title'),
    ])
    if (decRes.data) setDecisions(decRes.data as EditDecision[])
    if (vidRes.data) setVideos(vidRes.data as Video[])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleApprove(id: string): Promise<void> {
    await supabase.from('edit_decisions').update({ status: 'approved' as DecisionStatus }).eq('id', id)
    await loadData()
  }

  async function handleReject(id: string): Promise<void> {
    await supabase.from('edit_decisions').update({ status: 'rejected' as DecisionStatus }).eq('id', id)
    await loadData()
  }

  const videoMap = new Map(videos.map(v => [v.id, v.title]))

  // Only show videos that have decisions
  const videoIdsWithDecisions = [...new Set(decisions.map(d => d.video_id))]
  const videosWithDecisions = videos.filter(v => videoIdsWithDecisions.includes(v.id))

  const filtered = decisions.filter(d =>
    videoFilter === 'all' || d.video_id === videoFilter
  )

  const DECISION_KIND_CLASS: Record<EditDecision['kind'], string> = {
    cut: styles.decisionCut,
    reorder: styles.decisionReorder,
    cold_open: styles.decisionColdOpen,
  }

  const STATUS_CLASS: Record<DecisionStatus, string> = {
    pending: styles.decisionPending,
    approved: styles.decisionApproved,
    rejected: styles.decisionRejected,
    applied: styles.decisionApplied,
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.toolbar}>
        <select
          className={styles.filterSelect}
          value={videoFilter}
          onChange={e => setVideoFilter(e.target.value)}
          aria-label="Filter by video"
        >
          <option value="all">All videos</option>
          {videosWithDecisions.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
        </select>
        <div className={styles.spacer} />
      </div>

      <div className={styles.table}>
        <div className={`${styles.thead} ${styles.decisionsGrid}`}>
          <div className={styles.th}>Kind</div>
          <div className={styles.th}>Video</div>
          <div className={styles.th}>Timecodes</div>
          <div className={styles.th}>Reason</div>
          <div className={styles.th}>Status</div>
          <div className={styles.th}></div>
        </div>

        {loading ? (
          <div className={styles.emptyState}><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>No edit decisions found</div>
        ) : (
          filtered.map(d => (
            <div key={d.id} className={`${styles.row} ${styles.decisionsGrid}`}>
              <div className={styles.td}>
                <span className={`${styles.kindPill} ${DECISION_KIND_CLASS[d.kind]}`}>
                  {d.kind === 'cold_open' ? 'Cold open' : d.kind.charAt(0).toUpperCase() + d.kind.slice(1)}
                </span>
              </div>
              <div className={styles.td} style={{ fontSize: 12 }}>
                {videoMap.get(d.video_id) ?? d.video_id.slice(0, 8) + '…'}
              </div>
              <div className={styles.td} style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--color-muted)' }}>
                {fmtSec(d.start_s)}&thinsp;→&thinsp;{fmtSec(d.end_s)}
              </div>
              <div className={`${styles.td} ${styles.reasonCell}`} title={d.reason}>
                {d.reason}
              </div>
              <div className={styles.td}>
                <span className={`${styles.statusBadge} ${STATUS_CLASS[d.status]}`}>
                  {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                </span>
              </div>
              <div className={`${styles.td} ${styles.actionCell}`}>
                {d.status === 'pending' && (
                  <>
                    <button
                      className={`${styles.inlineBtn} ${styles.inlineBtnApprove}`}
                      onClick={() => handleApprove(d.id)}
                    >
                      Approve
                    </button>
                    <button
                      className={`${styles.inlineBtn} ${styles.inlineBtnReject}`}
                      onClick={() => handleReject(d.id)}
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// RISK FLAGS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function RiskFlagsTab(): JSX.Element {
  const [flags, setFlags] = useState<RiskFlag[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [kindFilter, setKindFilter] = useState<RiskKindFilter>('all')
  const [statusFilter, setStatusFilter] = useState<RiskStatusFilter>('open')
  const [loading, setLoading] = useState(true)

  async function loadData(): Promise<void> {
    setLoading(true)
    const [flagRes, vidRes] = await Promise.all([
      supabase.from('risk_flags').select('*').order('start_s', { ascending: true }),
      supabase.from('videos').select('id, title').order('title'),
    ])
    if (flagRes.data) setFlags(flagRes.data as RiskFlag[])
    if (vidRes.data) setVideos(vidRes.data as Video[])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleAcknowledge(id: string): Promise<void> {
    await supabase.from('risk_flags').update({ status: 'acknowledged' as RiskStatus }).eq('id', id)
    await loadData()
  }

  async function handleResolve(id: string): Promise<void> {
    await supabase.from('risk_flags').update({ status: 'resolved' as RiskStatus }).eq('id', id)
    await loadData()
  }

  const videoMap = new Map(videos.map(v => [v.id, v.title]))

  const filtered = flags.filter(f => {
    if (kindFilter !== 'all' && f.kind !== kindFilter) return false
    if (statusFilter !== 'all' && f.status !== statusFilter) return false
    return true
  })

  const KIND_LABEL: Record<RiskKind, string> = {
    legal: 'Legal',
    copyright: 'Copyright',
    language: 'Language',
    sensitive: 'Sensitive',
  }

  const KIND_CLASS: Record<RiskKind, string> = {
    legal: styles.riskLegal,
    copyright: styles.riskCopyright,
    language: styles.riskLanguage,
    sensitive: styles.riskSensitive,
  }

  const RISK_KIND_FILTERS: RiskKindFilter[] = ['all', 'legal', 'copyright', 'language', 'sensitive']
  const RISK_STATUS_FILTERS: RiskStatusFilter[] = ['all', 'open', 'acknowledged', 'resolved']

  return (
    <div className={styles.tabContent}>
      <div className={styles.toolbar}>
        <div className={styles.statusFilters}>
          {RISK_KIND_FILTERS.map(k => (
            <button
              key={k}
              className={`${styles.statusFilterBtn} ${kindFilter === k ? styles.statusFilterActive : ''}`}
              onClick={() => setKindFilter(k)}
            >
              {k === 'all' ? 'All' : KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <div className={styles.statusFilters}>
          {RISK_STATUS_FILTERS.map(s => (
            <button
              key={s}
              className={`${styles.statusFilterBtn} ${statusFilter === s ? styles.statusFilterActive : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className={styles.spacer} />
      </div>

      <div className={styles.table}>
        <div className={`${styles.thead} ${styles.riskGrid}`}>
          <div className={styles.th}>Kind</div>
          <div className={styles.th}>Video</div>
          <div className={styles.th}>Timecodes</div>
          <div className={styles.th}>Note</div>
          <div className={styles.th}>Status</div>
          <div className={styles.th}></div>
        </div>

        {loading ? (
          <div className={styles.emptyState}><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>No risk flags found</div>
        ) : (
          filtered.map(f => (
            <div key={f.id} className={`${styles.row} ${styles.riskGrid}`}>
              <div className={styles.td}>
                <span className={`${styles.kindPill} ${KIND_CLASS[f.kind]}`}>
                  {KIND_LABEL[f.kind]}
                </span>
              </div>
              <div className={styles.td} style={{ fontSize: 12 }}>
                {videoMap.get(f.video_id) ?? f.video_id.slice(0, 8) + '…'}
              </div>
              <div className={styles.td} style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--color-muted)' }}>
                {fmtSec(f.start_s)}&thinsp;→&thinsp;{fmtSec(f.end_s)}
              </div>
              <div className={`${styles.td} ${styles.reasonCell}`} title={f.note}>
                {f.note}
              </div>
              <div className={styles.td}>
                <span className={`${styles.statusBadge} ${f.status === 'open' ? styles.badgeFailed : f.status === 'acknowledged' ? styles.badgeQueued : styles.badgeDone}`}>
                  {f.status.charAt(0).toUpperCase() + f.status.slice(1)}
                </span>
              </div>
              <div className={`${styles.td} ${styles.actionCell}`}>
                {f.status === 'open' && (
                  <button
                    className={`${styles.inlineBtn} ${styles.inlineBtnNeutral}`}
                    onClick={() => handleAcknowledge(f.id)}
                  >
                    Acknowledge
                  </button>
                )}
                {f.status === 'acknowledged' && (
                  <button
                    className={`${styles.inlineBtn} ${styles.inlineBtnApprove}`}
                    onClick={() => handleResolve(f.id)}
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
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
