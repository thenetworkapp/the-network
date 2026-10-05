import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@network/core'
import type { Platform } from '@network/core'
import styles from './ClipMetricsScreen.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShowRow {
  id: string
  name: string
}

interface MetricsSnapshotRow {
  metrics: unknown
}

interface ClipForMetrics {
  id: string
  video_id: string
  start_s: number
  end_s: number
  score: number | null
  source: string
  hook: string | null
  videos: { title: string; show_id: string | null } | null
}

interface PackageWithClip {
  id: string
  platform: Platform
  clip_id: string | null
  status: string
  clips: ClipForMetrics | null
  metrics_snapshots: MetricsSnapshotRow[]
}

interface PlatformStat {
  platform: Platform
  clipsPosted: number
  totalViews: number
  totalLikes: number
  avgViewsPerClip: number
}

interface TopClipRow {
  clipId: string
  videoTitle: string
  duration: string
  hook: string
  platform: Platform
  views: number
  likes: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractMetric(raw: unknown, key: string): number {
  const m = raw as Record<string, unknown>
  const val = m[key]
  return typeof val === 'number' ? val : Number(val) || 0
}

function latestSnapshot(snapshots: MetricsSnapshotRow[]): MetricsSnapshotRow | null {
  return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
}

const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  spotify: 'Spotify',
  apple_podcasts: 'Apple Podcasts',
  rss: 'RSS',
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
  sub?: string
}

function StatCard({ label, value, sub }: StatCardProps): JSX.Element {
  return (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function ClipMetricsScreen(): JSX.Element {
  const [shows, setShows] = useState<ShowRow[]>([])
  const [selectedShow, setSelectedShow] = useState<string>('all')
  const [packagesWithClips, setPackagesWithClips] = useState<PackageWithClip[]>([])
  const [aiClips, setAiClips] = useState<ClipForMetrics[]>([])
  const [loading, setLoading] = useState(false)

  // ── Shows query ───────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.from('shows').select('id, name').then(({ data }) => {
      if (data) setShows(data as ShowRow[])
    })
  }, [])

  // ── Data queries ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (selectedShow === 'all') {
      setPackagesWithClips([])
      setAiClips([])
      return
    }

    setLoading(true)

    void Promise.all([
      // Packages with clips joined (for platform breakdown + top clips table)
      supabase
        .from('packages')
        .select('id, platform, clip_id, status, clips(id, video_id, start_s, end_s, score, source, hook, videos(title, show_id)), metrics_snapshots(metrics)')
        .not('clip_id', 'is', null)
        .eq('status', 'published'),

      // AI clips for avg score — filtered by show via videos join
      supabase
        .from('clips')
        .select('id, video_id, start_s, end_s, score, source, hook, videos(title, show_id)')
        .eq('source', 'ai'),
    ]).then(([pkgClipsRes, clipsRes]) => {
      if (pkgClipsRes.data) {
        const rows = pkgClipsRes.data as unknown as PackageWithClip[]
        // Filter by selected show
        const filtered = rows.filter(p =>
          p.clips?.videos?.show_id === selectedShow,
        )
        setPackagesWithClips(filtered)
      }
      if (clipsRes.data) {
        const all = clipsRes.data as unknown as ClipForMetrics[]
        setAiClips(all.filter(c => c.videos?.show_id === selectedShow))
      }
      setLoading(false)
    })
  }, [selectedShow])

  // ── Summary stats ─────────────────────────────────────────────────────────

  const totalPosted = useMemo(() => packagesWithClips.length, [packagesWithClips])

  const avgAiScore = useMemo((): string => {
    const scored = aiClips.filter(c => c.score != null)
    if (scored.length === 0) return '—'
    const sum = scored.reduce((acc, c) => acc + (c.score ?? 0), 0)
    return (sum / scored.length).toFixed(0)
  }, [aiClips])

  const totalViews = useMemo((): number => {
    return packagesWithClips.reduce((acc, pkg) => {
      const snap = latestSnapshot(pkg.metrics_snapshots)
      return acc + (snap ? extractMetric(snap.metrics, 'views') : 0)
    }, 0)
  }, [packagesWithClips])

  const bestPlatform = useMemo((): string => {
    const byPlatform = new Map<Platform, number>()
    packagesWithClips.forEach(pkg => {
      const snap = latestSnapshot(pkg.metrics_snapshots)
      const views = snap ? extractMetric(snap.metrics, 'views') : 0
      byPlatform.set(pkg.platform, (byPlatform.get(pkg.platform) ?? 0) + views)
    })
    if (byPlatform.size === 0) return '—'
    let best: Platform | null = null
    let bestViews = -1
    byPlatform.forEach((v, p) => {
      if (v > bestViews) { bestViews = v; best = p }
    })
    return best ? PLATFORM_LABELS[best] : '—'
  }, [packagesWithClips])

  // ── Platform breakdown ────────────────────────────────────────────────────

  const platformStats = useMemo((): PlatformStat[] => {
    const map = new Map<Platform, { views: number; likes: number; count: number }>()
    packagesWithClips.forEach(pkg => {
      const snap = latestSnapshot(pkg.metrics_snapshots)
      const views = snap ? extractMetric(snap.metrics, 'views') : 0
      const likes = snap ? extractMetric(snap.metrics, 'likes') : 0
      const prev = map.get(pkg.platform) ?? { views: 0, likes: 0, count: 0 }
      map.set(pkg.platform, {
        views: prev.views + views,
        likes: prev.likes + likes,
        count: prev.count + 1,
      })
    })
    const result: PlatformStat[] = []
    map.forEach((v, platform) => {
      result.push({
        platform,
        clipsPosted: v.count,
        totalViews: v.views,
        totalLikes: v.likes,
        avgViewsPerClip: v.count > 0 ? Math.round(v.views / v.count) : 0,
      })
    })
    return result.sort((a, b) => b.totalViews - a.totalViews)
  }, [packagesWithClips])

  // ── Top 10 clips ──────────────────────────────────────────────────────────

  const topClips = useMemo((): TopClipRow[] => {
    return packagesWithClips
      .map((pkg): TopClipRow | null => {
        const clip = pkg.clips
        if (!clip) return null
        const snap = latestSnapshot(pkg.metrics_snapshots)
        const views = snap ? extractMetric(snap.metrics, 'views') : 0
        const likes = snap ? extractMetric(snap.metrics, 'likes') : 0
        const dur = (clip.end_s - clip.start_s).toFixed(1) + 's'
        return {
          clipId: pkg.id,
          videoTitle: clip.videos?.title ?? '—',
          duration: dur,
          hook: clip.hook ? clip.hook.slice(0, 60) + (clip.hook.length > 60 ? '…' : '') : '—',
          platform: pkg.platform,
          views,
          likes,
        }
      })
      .filter((r): r is TopClipRow => r !== null)
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
  }, [packagesWithClips])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.screen}>
      {/* Show selector */}
      <div className={styles.topBar}>
        <h1 className={styles.heading}>Clip Metrics</h1>
        <select
          className={styles.showSelect}
          value={selectedShow}
          onChange={e => { setSelectedShow(e.target.value) }}
          aria-label="Select show"
        >
          <option value="all">Select a show…</option>
          {shows.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {selectedShow === 'all' ? (
        <div className={styles.emptyState}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect x="5" y="10" width="30" height="22" rx="4" stroke="var(--color-line)" strokeWidth="1.5" />
            <path d="M14 19h12M14 24h8" stroke="var(--color-line)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>Select a show to view clip metrics</span>
        </div>
      ) : loading ? (
        <div className={styles.emptyState}>
          <div className={styles.spinner} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : (
        <div className={styles.content}>

          {/* Summary row */}
          <section className={styles.section}>
            <div className={styles.sectionTitle}>Summary</div>
            <div className={styles.statsRow}>
              <StatCard label="Clips Posted" value={String(totalPosted)} />
              <StatCard label="Avg AI Score" value={avgAiScore} sub={avgAiScore !== '—' ? 'out of 100' : undefined} />
              <StatCard label="Total Views" value={fmtNum(totalViews)} />
              <StatCard label="Best Platform" value={bestPlatform} />
            </div>
          </section>

          {/* Platform breakdown */}
          <section className={styles.section}>
            <div className={styles.sectionTitle}>Platform Breakdown</div>
            <div className={styles.card}>
              <div className={styles.tableWrap}>
                <div className={`${styles.thead} ${styles.platformThead}`}>
                  <div className={styles.th}>Platform</div>
                  <div className={styles.th}>Clips Posted</div>
                  <div className={styles.th}>Total Views</div>
                  <div className={styles.th}>Total Likes</div>
                  <div className={styles.th}>Avg Views / Clip</div>
                </div>
                {platformStats.length === 0 ? (
                  <div className={styles.tableEmpty}>No data</div>
                ) : (
                  platformStats.map(stat => (
                    <div key={stat.platform} className={`${styles.trow} ${styles.platformTrow}`}>
                      <div className={styles.td}>
                        <span className={styles.platformLabel}>{PLATFORM_LABELS[stat.platform]}</span>
                      </div>
                      <div className={styles.td}>{stat.clipsPosted}</div>
                      <div className={styles.td}>{fmtNum(stat.totalViews)}</div>
                      <div className={styles.td}>{fmtNum(stat.totalLikes)}</div>
                      <div className={styles.td}>{fmtNum(stat.avgViewsPerClip)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Top 10 clips */}
          <section className={styles.section}>
            <div className={styles.sectionTitle}>Top 10 Clips by Views</div>
            <div className={styles.card}>
              <div className={styles.tableWrap}>
                <div className={`${styles.thead} ${styles.clipsThead}`}>
                  <div className={styles.th}>Video</div>
                  <div className={styles.th}>Duration</div>
                  <div className={styles.th}>Hook</div>
                  <div className={styles.th}>Platform</div>
                  <div className={styles.th}>Views</div>
                  <div className={styles.th}>Likes</div>
                </div>
                {topClips.length === 0 ? (
                  <div className={styles.tableEmpty}>No clips found</div>
                ) : (
                  topClips.map((row, i) => (
                    <div key={`${row.clipId}-${i}`} className={`${styles.trow} ${styles.clipsTrow}`}>
                      <div className={styles.td}>
                        <div className={styles.cellPrimary}>{row.videoTitle}</div>
                      </div>
                      <div className={styles.td}>
                        <span className={styles.cellMono}>{row.duration}</span>
                      </div>
                      <div className={styles.td}>
                        <div className={styles.hookCell}>{row.hook}</div>
                      </div>
                      <div className={styles.td}>
                        <span className={styles.platformPill}>{PLATFORM_LABELS[row.platform]}</span>
                      </div>
                      <div className={styles.td}>
                        <span className={styles.metricNum}>{fmtNum(row.views)}</span>
                      </div>
                      <div className={styles.td}>
                        <span className={styles.metricNum}>{fmtNum(row.likes)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

        </div>
      )}
    </div>
  )
}
