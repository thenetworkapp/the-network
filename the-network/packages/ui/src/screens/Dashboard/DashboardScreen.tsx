import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth, supabase } from '@network/core'
import styles from './DashboardScreen.module.css'

// ---- Helpers ----

function formatRel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  )
}

function Spinner(): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
      <div className={styles.widgetSpinner} />
    </div>
  )
}

function Empty({ text }: { text: string }): JSX.Element {
  return <p className={styles.widgetEmpty}>{text}</p>
}

// ---- Widget definitions ----

type WidgetSize = 'S' | 'M' | 'Tall' | 'L' | 'Wide'

interface WidgetDef {
  id: string
  title: string
  defaultSize: WidgetSize
  component: () => JSX.Element
}

function ActivityFeed(): JSX.Element {
  const [items, setItems] = useState<{ action: string; subject_type: string; at: string }[] | null>(null)

  useEffect(() => {
    supabase
      .from('audit_log')
      .select('action, subject_type, at')
      .order('at', { ascending: false })
      .limit(8)
      .then(({ data }) => setItems(data ?? []))
  }, [])

  if (items === null) return <Spinner />
  if (!items.length) return <Empty text="No recent activity" />

  return (
    <div>
      {items.map((item, i) => (
        <div key={i} className={styles.row}>
          <span className={`${styles.dot} ${styles.dotOk}`} aria-hidden="true" />
          <span className={styles.rowLabel}>
            {item.action.replace(/_/g, ' ')} · {item.subject_type}
          </span>
          <span className={styles.rowMeta}>{formatRel(item.at)}</span>
        </div>
      ))}
    </div>
  )
}

function ApprovalQueue(): JSX.Element {
  const [items, setItems] = useState<
    {
      id: string
      subject_type: string
      required_permission: string
      escalates_at: string | null
      positions: { title: string } | null
    }[] | null
  >(null)

  useEffect(() => {
    supabase
      .from('approvals')
      .select('id, subject_type, required_permission, escalates_at, positions!assigned_position_id(title)')
      .eq('status', 'pending')
      .order('escalates_at', { ascending: true, nullsFirst: false })
      .limit(5)
      .then(({ data }) => setItems((data as any) ?? []))
  }, [])

  if (items === null) return <Spinner />
  if (!items.length) return <Empty text="No pending approvals" />

  return (
    <div>
      {items.map(item => (
        <div key={item.id} className={styles.row}>
          <span
            className={`${styles.dot} ${item.escalates_at ? styles.dotWarn : styles.dotOk}`}
            aria-hidden="true"
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.rowLabel}>
              {item.subject_type} · {item.required_permission.replace(/_/g, ' ')}
            </div>
            <div className={styles.rowMeta}>{item.positions?.title ?? 'Unassigned'}</div>
          </div>
          <button
            style={{
              height: 24, padding: '0 10px',
              borderRadius: 'var(--radius-control)',
              background: 'var(--color-blue)', color: '#fff',
              border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Review
          </button>
        </div>
      ))}
    </div>
  )
}

function UpcomingRecords(): JSX.Element {
  const [items, setItems] = useState<
    { id: string; title: string; starts_at: string; videos: { title: string; shows: { name: string } | null } | null }[] | null
  >(null)

  useEffect(() => {
    supabase
      .from('calendar_events')
      .select('id, title, starts_at, videos(title, shows(name))')
      .eq('kind', 'record')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(5)
      .then(({ data }) => setItems((data as any) ?? []))
  }, [])

  if (items === null) return <Spinner />
  if (!items.length) return <Empty text="No upcoming recordings" />

  return (
    <div>
      {items.map(item => (
        <div key={item.id} className={styles.row}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.rowLabel}>
              {item.videos?.shows?.name ?? item.videos?.title ?? item.title}
            </div>
            <div className={styles.rowMeta}>{formatDate(item.starts_at)}</div>
          </div>
          <span className={`${styles.dot} ${styles.dotOk}`} aria-hidden="true" />
        </div>
      ))}
    </div>
  )
}

function UpcomingPublishes(): JSX.Element {
  const [items, setItems] = useState<
    { id: string; title: string; platform: string; publish_at: string }[] | null
  >(null)

  useEffect(() => {
    supabase
      .from('packages')
      .select('id, title, platform, publish_at')
      .in('status', ['ready', 'scheduled'])
      .gte('publish_at', new Date().toISOString())
      .order('publish_at', { ascending: true })
      .limit(5)
      .then(({ data }) => setItems(data ?? []))
  }, [])

  if (items === null) return <Spinner />
  if (!items.length) return <Empty text="No scheduled publishes" />

  return (
    <div>
      {items.map(item => (
        <div key={item.id} className={styles.row}>
          <span className={`${styles.dot} ${styles.dotOk}`} aria-hidden="true" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.rowLabel}>{item.title}</div>
            <div className={styles.rowMeta}>
              {item.platform} · {formatDate(item.publish_at)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

const PLATFORM_NAMES: Record<string, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  spotify: 'Spotify',
  apple_podcasts: 'Apple Podcasts',
  rss: 'RSS',
}

function PlatformHealth(): JSX.Element {
  const [statuses, setStatuses] = useState<Record<string, { connected: boolean }> | null>(null)

  useEffect(() => {
    const api = (window as any).platformAPI
    if (api) {
      api.getStatus().then((s: Record<string, { connected: boolean }>) => setStatuses(s))
    } else {
      setStatuses({})
    }
  }, [])

  if (statuses === null) return <Spinner />

  if (!(window as any).platformAPI) {
    return <Empty text="Platform connections are only available in the desktop app" />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Object.entries(PLATFORM_NAMES).map(([id, name]) => {
        const connected = statuses[id]?.connected ?? false
        return (
          <div key={id} className={styles.row}>
            <span
              className={`${styles.dot} ${connected ? styles.dotOk : styles.dotFaint}`}
              aria-hidden="true"
            />
            <span className={styles.rowLabel}>{name}</span>
            <span className={styles.rowMeta}>{connected ? 'Connected' : 'Not connected'}</span>
          </div>
        )
      })}
    </div>
  )
}

function MetricsOverview(): JSX.Element {
  const [totals, setTotals] = useState<{
    views: number; watchHours: number; subscribers: number; engagement: number
  } | null>(null)

  useEffect(() => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    supabase
      .from('metrics_snapshots')
      .select('metrics')
      .gte('captured_at', since)
      .then(({ data }) => {
        const acc = { views: 0, watchHours: 0, subscribers: 0, engagement: 0, count: 0 }
        data?.forEach(row => {
          const m = (row.metrics as Record<string, number>) ?? {}
          acc.views += m.views ?? 0
          acc.watchHours += m.watch_hours ?? 0
          acc.subscribers += m.subscribers ?? 0
          acc.engagement += m.engagement_rate ?? 0
          acc.count++
        })
        setTotals({
          views: acc.views,
          watchHours: acc.watchHours,
          subscribers: acc.subscribers,
          engagement: acc.count > 0 ? acc.engagement / acc.count : 0,
        })
      })
  }, [])

  if (totals === null) return <Spinner />

  function fmt(n: number): string {
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
    return n === 0 ? '0' : n.toString()
  }

  const metrics = [
    { num: fmt(totals.views), label: 'Total views (30d)' },
    { num: fmt(totals.watchHours) + (totals.watchHours >= 1000 ? '' : ' hrs'), label: 'Watch hours' },
    { num: totals.subscribers > 0 ? `+${fmt(totals.subscribers)}` : '0', label: 'New subscribers' },
    { num: totals.engagement > 0 ? `${totals.engagement.toFixed(1)}%` : '0%', label: 'Avg engagement' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {metrics.map(m => (
        <div key={m.label}>
          <div className={styles.bigNum}>{m.num}</div>
          <div className={styles.bigNumLabel}>{m.label}</div>
        </div>
      ))}
    </div>
  )
}

function TeamAvailability(): JSX.Element {
  const [team, setTeam] = useState<
    {
      id: string
      title: string
      role: string
      profiles: { full_name: string; initials: string; avatar_colour: string | null } | null
    }[] | null
  >(null)

  useEffect(() => {
    supabase
      .from('positions')
      .select('id, title, role, profiles!person_id(full_name, initials, avatar_colour)')
      .not('person_id', 'is', null)
      .limit(8)
      .then(({ data }) => setTeam((data as any) ?? []))
  }, [])

  if (team === null) return <Spinner />
  if (!team.length) return <Empty text="No team members yet" />

  return (
    <div>
      {team.map(m => (
        <div key={m.id} className={styles.row}>
          <div
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: m.profiles?.avatar_colour ?? 'var(--color-surface2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, color: '#fff', flexShrink: 0,
            }}
          >
            {m.profiles?.initials ?? '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.rowLabel}>{m.profiles?.full_name ?? 'Vacant'}</div>
            <div className={styles.rowMeta}>{m.title}</div>
          </div>
          <span className={`${styles.dot} ${styles.dotOk}`} aria-hidden="true" />
        </div>
      ))}
    </div>
  )
}

function ActiveJobs(): JSX.Element {
  const [jobs, setJobs] = useState<
    { id: string; kind: string; status: string; progress: number; videos: { title: string } | null }[] | null
  >(null)

  useEffect(() => {
    supabase
      .from('jobs')
      .select('id, kind, status, progress, videos(title)')
      .in('status', ['queued', 'running'])
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setJobs((data as any) ?? []))
  }, [])

  if (jobs === null) return <Spinner />
  if (!jobs.length) return <Empty text="No active jobs" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {jobs.map(j => (
        <div key={j.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span className={styles.rowLabel}>
              {j.videos?.title ?? j.kind.replace(/_/g, ' ')}
            </span>
            <span className={styles.rowMeta}>{j.progress}%</span>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: `${j.progress}%`,
                background: j.status === 'done' ? 'var(--color-ok)' : 'var(--color-blue)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

const FOOTAGE_STAGE_LABELS: Record<string, string> = {
  pre_production: 'Pre-production',
  recording: 'Recording',
  footage_received: 'Footage received',
  ai_editing: 'AI editing',
}

function FootageStatus(): JSX.Element {
  const [videos, setVideos] = useState<{ id: string; title: string; stage: string }[] | null>(null)

  useEffect(() => {
    supabase
      .from('videos')
      .select('id, title, stage')
      .in('stage', ['pre_production', 'recording', 'footage_received', 'ai_editing'])
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setVideos(data ?? []))
  }, [])

  if (videos === null) return <Spinner />
  if (!videos.length) return <Empty text="No videos in footage stage" />

  return (
    <div>
      {videos.map(v => (
        <div key={v.id} className={styles.row}>
          <span
            className={`${styles.dot} ${v.stage === 'footage_received' ? styles.dotOk : styles.dotWarn}`}
            aria-hidden="true"
          />
          <span className={styles.rowLabel}>{v.title}</span>
          <span className={styles.rowMeta}>{FOOTAGE_STAGE_LABELS[v.stage] ?? v.stage}</span>
        </div>
      ))}
    </div>
  )
}

const VIDEO_STAGE_LABELS: Record<string, string> = {
  idea: 'Idea', scheduled: 'Scheduled', pre_production: 'Pre-production',
  recording: 'Recording', footage_received: 'Footage', ai_editing: 'AI edit',
  review: 'Review', approved: 'Approved', packaging: 'Packaging',
  upload_ready: 'Ready', published: 'Published', archived: 'Archived',
}

function MyVideos(): JSX.Element {
  const { user } = useAuth()
  const [videos, setVideos] = useState<{ id: string; title: string; stage: string }[] | null>(null)

  useEffect(() => {
    if (!user) { setVideos([]); return }
    supabase
      .from('videos')
      .select('id, title, stage')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setVideos(data ?? []))
  }, [user])

  if (videos === null) return <Spinner />
  if (!videos.length) return <Empty text="No videos assigned to you" />

  return (
    <div>
      {videos.map(v => (
        <div key={v.id} className={styles.row}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.rowLabel}>{v.title}</div>
          </div>
          <span className={styles.stagePill}>{VIDEO_STAGE_LABELS[v.stage] ?? v.stage}</span>
        </div>
      ))}
    </div>
  )
}

function MessagesPreview(): JSX.Element {
  const [msgs, setMsgs] = useState<
    {
      id: string
      body: string
      created_at: string
      threads: { title: string } | null
      profiles: { full_name: string; initials: string } | null
    }[] | null
  >(null)

  useEffect(() => {
    supabase
      .from('messages')
      .select('id, body, created_at, threads(title), profiles!author_id(full_name, initials)')
      .eq('is_system', false)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setMsgs((data as any) ?? []))
  }, [])

  if (msgs === null) return <Spinner />
  if (!msgs.length) return <Empty text="No messages yet" />

  return (
    <div>
      {msgs.map(m => (
        <div key={m.id} className={styles.row}>
          <div
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--color-surface2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, color: 'var(--color-ink2)', flexShrink: 0,
            }}
          >
            {m.profiles?.initials ?? '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-ink2)' }}>
              {m.profiles?.full_name ?? 'Unknown'}
            </div>
            <div className={styles.rowLabel} style={{ fontSize: 12 }}>{m.body}</div>
          </div>
          <span className={styles.rowMeta}>{formatRel(m.created_at)}</span>
        </div>
      ))}
    </div>
  )
}

const CLIP_STAGES = [
  { key: 'candidate', label: 'Candidates' },
  { key: 'approved', label: 'Approved' },
  { key: 'rendering', label: 'Rendering' },
  { key: 'ready', label: 'Ready' },
  { key: 'posted', label: 'Posted' },
]

function ClipPipeline(): JSX.Element {
  const [counts, setCounts] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    supabase
      .from('clips')
      .select('status')
      .then(({ data }) => {
        const c: Record<string, number> = { candidate: 0, approved: 0, rendering: 0, ready: 0, posted: 0 }
        data?.forEach(clip => { c[clip.status] = (c[clip.status] ?? 0) + 1 })
        setCounts(c)
      })
  }, [])

  if (counts === null) return <Spinner />

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {CLIP_STAGES.map(s => (
        <div
          key={s.key}
          style={{
            flex: '1 1 60px', textAlign: 'center',
            background: 'var(--color-surface2)',
            borderRadius: 'var(--radius-tile)', padding: '10px 8px',
          }}
        >
          <div className={styles.bigNum} style={{ fontSize: 22 }}>{counts[s.key] ?? 0}</div>
          <div className={styles.bigNumLabel}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

function PublishSchedule(): JSX.Element {
  const [schedule, setSchedule] = useState<number[] | null>(null)

  useEffect(() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)

    supabase
      .from('packages')
      .select('publish_at')
      .gte('publish_at', monday.toISOString())
      .lte('publish_at', sunday.toISOString())
      .not('publish_at', 'is', null)
      .then(({ data }) => {
        const counts = [0, 0, 0, 0, 0, 0, 0]
        data?.forEach(pkg => {
          if (!pkg.publish_at) return
          const d = new Date(pkg.publish_at)
          counts[(d.getDay() + 6) % 7]++
        })
        setSchedule(counts)
      })
  }, [])

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  if (schedule === null) return <Spinner />

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {days.map((d, i) => (
        <div key={d} style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--color-muted)', marginBottom: 4 }}>{d}</div>
          <div
            style={{
              height: 36, borderRadius: 6,
              background: schedule[i] > 0 ? 'rgba(28,63,203,.12)' : 'var(--color-surface2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600,
              color: schedule[i] > 0 ? 'var(--color-blue)' : 'var(--color-faint)',
            }}
          >
            {schedule[i] > 0 ? schedule[i] : '·'}
          </div>
        </div>
      ))}
    </div>
  )
}

function ShowProgress(): JSX.Element {
  const [shows, setShows] = useState<
    { id: string; name: string; videos: { stage: string }[] }[] | null
  >(null)

  useEffect(() => {
    supabase
      .from('shows')
      .select('id, name, videos(stage)')
      .eq('archived', false)
      .limit(5)
      .then(({ data }) => setShows((data as any) ?? []))
  }, [])

  if (shows === null) return <Spinner />
  if (!shows.length) return <Empty text="No shows created yet" />

  const ACTIVE = ['recording', 'ai_editing', 'review', 'approved', 'packaging', 'upload_ready', 'published']

  return (
    <div>
      {shows.map(s => {
        const stageCounts: Record<string, number> = {}
        s.videos.forEach(v => {
          if (ACTIVE.includes(v.stage)) stageCounts[v.stage] = (stageCounts[v.stage] ?? 0) + 1
        })
        const hasCounts = Object.keys(stageCounts).length > 0
        return (
          <div key={s.id} className={styles.row}>
            <span className={styles.rowLabel}>{s.name}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {hasCounts ? (
                Object.entries(stageCounts).map(([stage, count]) => (
                  <span key={stage} className={styles.stagePill}>
                    {count} {stage.replace(/_/g, ' ')}
                  </span>
                ))
              ) : (
                <span className={styles.rowMeta}>No active videos</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RecentMetrics(): JSX.Element {
  const [snapshots, setSnapshots] = useState<
    {
      id: string
      platform: string
      captured_at: string
      metrics: Record<string, number>
      packages: { title: string } | null
    }[] | null
  >(null)

  useEffect(() => {
    supabase
      .from('metrics_snapshots')
      .select('id, platform, captured_at, metrics, packages(title)')
      .order('captured_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setSnapshots((data as any) ?? []))
  }, [])

  if (snapshots === null) return <Spinner />
  if (!snapshots.length) return <Empty text="No metrics yet — connect platforms to sync data" />

  function fmt(n: number | undefined): string {
    if (!n) return '0'
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
    return n.toString()
  }

  return (
    <div>
      {snapshots.map(s => (
        <div key={s.id} className={styles.row}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.rowLabel}>{s.packages?.title ?? 'Unknown'}</div>
            <div className={styles.rowMeta}>{PLATFORM_NAMES[s.platform] ?? s.platform}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 13, fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--color-ink)',
              }}
            >
              {fmt(s.metrics.views)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-ok)' }}>views</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function QuickActions(): JSX.Element {
  const actions = ['New Video', 'Schedule Recording', 'Upload Footage', 'Request Footage']
  return (
    <div className={styles.quickGrid}>
      {actions.map(label => (
        <button key={label} className={styles.quickBtn}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ---- Widget registry ----

const WIDGET_REGISTRY: WidgetDef[] = [
  { id: 'activity_feed', title: 'Activity Feed', defaultSize: 'Wide', component: ActivityFeed },
  { id: 'approval_queue', title: 'Approval Queue', defaultSize: 'M', component: ApprovalQueue },
  { id: 'upcoming_records', title: 'Upcoming Records', defaultSize: 'M', component: UpcomingRecords },
  { id: 'upcoming_publishes', title: 'Upcoming Publishes', defaultSize: 'M', component: UpcomingPublishes },
  { id: 'platform_health', title: 'Platform Health', defaultSize: 'M', component: PlatformHealth },
  { id: 'metrics_overview', title: 'Metrics Overview', defaultSize: 'L', component: MetricsOverview },
  { id: 'team_availability', title: 'Team Availability', defaultSize: 'M', component: TeamAvailability },
  { id: 'active_jobs', title: 'Active Jobs', defaultSize: 'L', component: ActiveJobs },
  { id: 'footage_status', title: 'Footage Status', defaultSize: 'M', component: FootageStatus },
  { id: 'my_videos', title: 'My Videos', defaultSize: 'M', component: MyVideos },
  { id: 'messages_preview', title: 'Messages', defaultSize: 'M', component: MessagesPreview },
  { id: 'clip_pipeline', title: 'Clip Pipeline', defaultSize: 'Wide', component: ClipPipeline },
  { id: 'publish_schedule', title: 'Publish Schedule', defaultSize: 'Wide', component: PublishSchedule },
  { id: 'show_progress', title: 'Show Progress', defaultSize: 'Wide', component: ShowProgress },
  { id: 'recent_metrics', title: 'Recent Metrics', defaultSize: 'M', component: RecentMetrics },
  { id: 'quick_actions', title: 'Quick Actions', defaultSize: 'M', component: QuickActions },
]

interface LayoutItem {
  widget: string
  size: WidgetSize
}

const DEFAULT_LAYOUT: LayoutItem[] = [
  { widget: 'activity_feed', size: 'Wide' },
  { widget: 'approval_queue', size: 'M' },
  { widget: 'upcoming_records', size: 'M' },
  { widget: 'platform_health', size: 'M' },
  { widget: 'metrics_overview', size: 'L' },
  { widget: 'active_jobs', size: 'M' },
  { widget: 'my_videos', size: 'M' },
  { widget: 'quick_actions', size: 'M' },
]

// ---- Dashboard ----

export function DashboardScreen(): JSX.Element {
  const { user } = useAuth()
  const [layout, setLayout] = useState<LayoutItem[]>(DEFAULT_LAYOUT)
  const [editMode, setEditMode] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [showPicker, setShowPicker] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('dashboard_layouts')
      .select('layout')
      .eq('person_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.layout && Array.isArray(data.layout) && data.layout.length > 0) {
          setLayout(data.layout as LayoutItem[])
        }
      })
  }, [user])

  async function saveLayout(newLayout: LayoutItem[]): Promise<void> {
    if (!user) return
    await supabase
      .from('dashboard_layouts')
      .upsert({ person_id: user.id, layout: newLayout })
  }

  function handleRemove(idx: number): void {
    const next = layout.filter((_, i) => i !== idx)
    setLayout(next)
    saveLayout(next)
  }

  function handleDragStart(idx: number): void {
    setDragIndex(idx)
  }

  function handleDragOver(e: React.DragEvent, idx: number): void {
    e.preventDefault()
    setDragOverIndex(idx)
  }

  function handleDrop(idx: number): void {
    if (dragIndex === null || dragIndex === idx) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }
    const next = [...layout]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(idx, 0, moved)
    setLayout(next)
    setDragIndex(null)
    setDragOverIndex(null)
    saveLayout(next)
  }

  function handleDone(): void {
    setEditMode(false)
    setShowPicker(false)
    saveLayout(layout)
  }

  function handleAddWidget(widgetId: string): void {
    const def = WIDGET_REGISTRY.find(w => w.id === widgetId)
    if (!def) return
    const next = [...layout, { widget: widgetId, size: def.defaultSize }]
    setLayout(next)
    saveLayout(next)
    setShowPicker(false)
  }

  const activeWidgetIds = new Set(layout.map(l => l.widget))
  const availableWidgets = WIDGET_REGISTRY.filter(w => !activeWidgetIds.has(w.id))

  const sizeClass: Record<WidgetSize, string> = {
    S: styles.sizeS,
    M: styles.sizeM,
    Tall: styles.sizeTall,
    L: styles.sizeL,
    Wide: styles.sizeWide,
  }

  return (
    <div className={`${styles.screen} ${editMode ? styles.editMode : ''}`}>
      <div className={styles.header}>
        <div />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {editMode && availableWidgets.length > 0 && (
            <motion.button
              className={styles.addWidgetBtn}
              onClick={() => setShowPicker(p => !p)}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
            >
              + Add widget
            </motion.button>
          )}
          <motion.button
            className={`${styles.editBtn} ${editMode ? styles.active : ''}`}
            onClick={editMode ? handleDone : () => setEditMode(true)}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
          >
            {editMode ? 'Done' : 'Edit Dashboard'}
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {showPicker && (
          <motion.div
            className={styles.pickerOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPicker(false)}
          >
            <motion.div
              className={styles.picker}
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.28 }}
              onClick={e => e.stopPropagation()}
            >
              <div className={styles.pickerHead}>Add a widget</div>
              <div className={styles.pickerGrid}>
                {availableWidgets.map(w => (
                  <button
                    key={w.id}
                    className={styles.pickerItem}
                    onClick={() => handleAddWidget(w.id)}
                  >
                    <span className={styles.pickerItemName}>{w.title}</span>
                    <span className={styles.pickerItemSize}>{w.defaultSize}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={styles.grid}>
        {layout.map((item, idx) => {
          const def = WIDGET_REGISTRY.find(w => w.id === item.widget)
          if (!def) return null
          const Component = def.component
          return (
            <motion.div
              key={item.widget}
              className={`${styles.widget} ${sizeClass[item.size]} ${dragIndex === idx ? styles.dragging : ''} ${dragOverIndex === idx ? styles.dragOver : ''}`}
              animate={editMode ? { rotate: [-0.25, 0.25, -0.25] } : { rotate: 0 }}
              transition={
                editMode
                  ? { repeat: Infinity, duration: 0.4, ease: 'easeInOut' }
                  : { duration: 0.2 }
              }
              draggable={editMode}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e as unknown as React.DragEvent, idx)}
              onDrop={() => handleDrop(idx)}
            >
              <div className={styles.widgetHeader}>
                <span className={styles.widgetTitle}>{def.title}</span>
                {editMode && (
                  <button
                    className={styles.removeBtn}
                    onClick={() => handleRemove(idx)}
                    aria-label={`Remove ${def.title}`}
                  >
                    ×
                  </button>
                )}
              </div>
              <div className={styles.widgetBody}>
                <Component />
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
