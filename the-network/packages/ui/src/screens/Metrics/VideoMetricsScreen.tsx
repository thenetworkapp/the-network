import { useState, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import { supabase } from '@network/core'
import type { Platform, PackageStatus } from '@network/core'
import styles from './VideoMetricsScreen.module.css'

// ---- Types ----

interface ShowRow {
  id: string
  name: string
  archived: boolean
}

interface MetricsSnapshotRow {
  metrics: Record<string, unknown>
  captured_at: string
  platform: Platform
}

interface PackageRow {
  id: string
  video_id: string | null
  platform: Platform
  title: string
  status: PackageStatus
  publish_at: string | null
  videos: { title: string; show_id: string } | null
  metrics_snapshots: MetricsSnapshotRow[]
}

type DateRange = '7d' | '30d' | '90d'

interface PlatformSummary {
  platform: Platform
  totalPackages: number
  totalViews: number
  totalLikes: number
  avgViews: number
}

interface WeeklyRow {
  weekEnding: Date
  videosPublished: number
  totalViews: number
  totalLikes: number
}

// ---- Constants ----

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
}

const DATE_RANGE_DAYS: Record<DateRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  spotify: 'Spotify',
  apple_podcasts: 'Apple Podcasts',
  rss: 'RSS',
}

const SPRING = { type: 'spring', bounce: 0, duration: 0.35 } as const

// ---- Helpers ----

function getMetricNum(metrics: Record<string, unknown>, key: string): number {
  const v = metrics[key]
  return typeof v === 'number' ? v : 0
}

function latestSnapshot(snapshots: MetricsSnapshotRow[]): MetricsSnapshotRow | null {
  if (!snapshots || snapshots.length === 0) return null
  return snapshots.reduce((best, s) =>
    new Date(s.captured_at) > new Date(best.captured_at) ? s : best
  )
}

function formatPublishAt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Mon
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfWeek(weekStart: Date): Date {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

function buildWeeklyRows(packages: PackageRow[]): WeeklyRow[] {
  if (packages.length === 0) return []

  // Build 8 ISO weeks ending on Sunday, going back from today
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const weeks: WeeklyRow[] = []
  for (let i = 0; i < 8; i++) {
    const weekEnd = new Date(today)
    weekEnd.setDate(today.getDate() - i * 7)
    weekEnd.setHours(23, 59, 59, 999)
    const weekStart = new Date(weekEnd)
    weekStart.setDate(weekEnd.getDate() - 6)
    weekStart.setHours(0, 0, 0, 0)
    weeks.push({ weekEnding: weekEnd, videosPublished: 0, totalViews: 0, totalLikes: 0 })

    packages.forEach(pkg => {
      if (!pkg.publish_at) return
      const pub = new Date(pkg.publish_at)
      if (pub >= weekStart && pub <= weekEnd) {
        weeks[i].videosPublished += 1
        const snap = latestSnapshot(pkg.metrics_snapshots)
        if (snap) {
          const m = (snap.metrics ?? {}) as Record<string, number>
          weeks[i].totalViews += getMetricNum(m, 'views')
          weeks[i].totalLikes += getMetricNum(m, 'likes')
        }
      }
    })
  }

  return weeks
}

// ---- Component ----

export function VideoMetricsScreen(): JSX.Element {
  const [shows, setShows] = useState<ShowRow[]>([])
  const [activeShowId, setActiveShowId] = useState<string>(() => {
    return localStorage.getItem('active-show-id') ?? ''
  })
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [packages, setPackages] = useState<PackageRow[]>([])
  const [loading, setLoading] = useState(false)

  // Load shows
  useEffect(() => {
    supabase
      .from('shows')
      .select('id, name, archived')
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

  const loadPackages = useCallback(async (showId: string, range: DateRange): Promise<void> => {
    if (!showId) return
    setLoading(true)

    const days = DATE_RANGE_DAYS[range]
    const dateRangeStart = new Date()
    dateRangeStart.setDate(dateRangeStart.getDate() - days)

    const { data } = await supabase
      .from('packages')
      .select('*, videos!inner(title, show_id), metrics_snapshots(metrics, captured_at, platform)')
      .eq('status', 'published')
      .eq('videos.show_id', showId)
      .gte('publish_at', dateRangeStart.toISOString())
      .order('publish_at', { ascending: false })

    setPackages((data ?? []) as PackageRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (activeShowId) {
      loadPackages(activeShowId, dateRange)
    }
  }, [activeShowId, dateRange, loadPackages])

  // ---- Derived data ----

  // Platform summaries — only show platforms that have published packages
  const platformMap = new Map<Platform, PlatformSummary>()
  packages.forEach(pkg => {
    const snap = latestSnapshot(pkg.metrics_snapshots)
    const m = snap ? ((snap.metrics ?? {}) as Record<string, number>) : {}
    const views = getMetricNum(m, 'views')
    const likes = getMetricNum(m, 'likes')
    const existing = platformMap.get(pkg.platform)
    if (existing) {
      existing.totalPackages += 1
      existing.totalViews += views
      existing.totalLikes += likes
    } else {
      platformMap.set(pkg.platform, {
        platform: pkg.platform,
        totalPackages: 1,
        totalViews: views,
        totalLikes: likes,
        avgViews: 0,
      })
    }
  })
  platformMap.forEach(summary => {
    summary.avgViews = summary.totalPackages > 0
      ? Math.round(summary.totalViews / summary.totalPackages)
      : 0
  })
  const platformSummaries = Array.from(platformMap.values())

  // Table rows — sorted by captured_at desc then views desc
  const tableRows = [...packages].sort((a, b) => {
    const snapA = latestSnapshot(a.metrics_snapshots)
    const snapB = latestSnapshot(b.metrics_snapshots)
    const timeA = snapA ? new Date(snapA.captured_at).getTime() : 0
    const timeB = snapB ? new Date(snapB.captured_at).getTime() : 0
    if (timeB !== timeA) return timeB - timeA
    const mA = snapA ? ((snapA.metrics ?? {}) as Record<string, number>) : {}
    const mB = snapB ? ((snapB.metrics ?? {}) as Record<string, number>) : {}
    return getMetricNum(mB, 'views') - getMetricNum(mA, 'views')
  })

  // Weekly rows
  const weeklyRows = buildWeeklyRows(packages)

  return (
    <div className={styles.screen}>

      {/* Controls */}
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

        <div className={styles.dateRangeGroup} role="group" aria-label="Date range">
          {(['7d', '30d', '90d'] as DateRange[]).map(range => (
            <button
              key={range}
              className={`${styles.dateRangeBtn} ${dateRange === range ? styles.dateRangeBtnActive : ''}`}
              onClick={() => setDateRange(range)}
            >
              {DATE_RANGE_LABELS[range]}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className={styles.spinner}>
          <div className={styles.spinnerDot} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {!loading && (
        <>
          {/* Platform summary cards */}
          {platformSummaries.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Platform Summary</h2>
              <div className={styles.platformGrid}>
                {platformSummaries.map((summary, i) => (
                  <motion.div
                    key={summary.platform}
                    className={styles.platformCard}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING, delay: i * 0.05 }}
                  >
                    <div className={styles.platformName}>
                      {PLATFORM_LABELS[summary.platform]}
                    </div>
                    <div className={styles.platformStats}>
                      <div className={styles.platformStat}>
                        <div className={styles.platformStatValue}>{summary.totalPackages}</div>
                        <div className={styles.platformStatLabel}>Published</div>
                      </div>
                      <div className={styles.platformStat}>
                        <div className={styles.platformStatValue}>{formatNumber(summary.totalViews)}</div>
                        <div className={styles.platformStatLabel}>Views</div>
                      </div>
                      <div className={styles.platformStat}>
                        <div className={styles.platformStatValue}>{formatNumber(summary.totalLikes)}</div>
                        <div className={styles.platformStatLabel}>Likes</div>
                      </div>
                      <div className={styles.platformStat}>
                        <div className={styles.platformStatValue}>{formatNumber(summary.avgViews)}</div>
                        <div className={styles.platformStatLabel}>Avg views</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Published videos table */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Published Videos</h2>
            <div className={styles.table}>
              <div className={styles.thead}>
                <div className={styles.th}>Title</div>
                <div className={styles.th}>Published</div>
                <div className={styles.th}>Platform</div>
                <div className={`${styles.th} ${styles.thNum}`}>Views</div>
                <div className={`${styles.th} ${styles.thNum}`}>Likes</div>
                <div className={`${styles.th} ${styles.thNum}`}>Comments</div>
              </div>

              {tableRows.length === 0 ? (
                <div className={styles.emptyState}>No published packages in this date range.</div>
              ) : (
                tableRows.map(pkg => {
                  const snap = latestSnapshot(pkg.metrics_snapshots)
                  const m = snap ? ((snap.metrics ?? {}) as Record<string, number>) : null
                  return (
                    <div key={pkg.id} className={styles.row}>
                      <div className={styles.td}>
                        <div className={styles.videoTitle}>{pkg.videos?.title ?? pkg.title}</div>
                      </div>
                      <div className={styles.td}>{formatPublishAt(pkg.publish_at)}</div>
                      <div className={styles.td}>
                        <span className={styles.platformBadge}>{PLATFORM_LABELS[pkg.platform]}</span>
                      </div>
                      <div className={`${styles.td} ${styles.tdNum}`}>
                        {m ? formatNumber(getMetricNum(m, 'views')) : <span className={styles.noMetrics}>No metrics yet</span>}
                      </div>
                      <div className={`${styles.td} ${styles.tdNum}`}>
                        {m ? formatNumber(getMetricNum(m, 'likes')) : '—'}
                      </div>
                      <div className={`${styles.td} ${styles.tdNum}`}>
                        {m ? formatNumber(getMetricNum(m, 'comments')) : '—'}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>

          {/* Weekly totals table */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Total Metrics Over Time (Last 8 Weeks)</h2>
            <div className={styles.table}>
              <div className={`${styles.thead} ${styles.theadWeekly}`}>
                <div className={styles.th}>Week ending</div>
                <div className={`${styles.th} ${styles.thNum}`}>Videos published</div>
                <div className={`${styles.th} ${styles.thNum}`}>Total views</div>
                <div className={`${styles.th} ${styles.thNum}`}>Total likes</div>
              </div>
              {weeklyRows.length === 0 ? (
                <div className={styles.emptyState}>No data available.</div>
              ) : (
                weeklyRows.map((week, i) => (
                  <div key={i} className={`${styles.row} ${styles.rowWeekly}`}>
                    <div className={styles.td}>
                      {week.weekEnding.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                    <div className={`${styles.td} ${styles.tdNum}`}>
                      {week.videosPublished > 0 ? week.videosPublished : <span className={styles.zero}>0</span>}
                    </div>
                    <div className={`${styles.td} ${styles.tdNum}`}>
                      {week.totalViews > 0 ? formatNumber(week.totalViews) : <span className={styles.zero}>—</span>}
                    </div>
                    <div className={`${styles.td} ${styles.tdNum}`}>
                      {week.totalLikes > 0 ? formatNumber(week.totalLikes) : <span className={styles.zero}>—</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
