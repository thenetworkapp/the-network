import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '@network/core'
import type { Clip, ClipSource, ClipStatus, Show } from '@network/core'
import { Button } from '@network/ui'
import styles from './ClipsScreen.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShowRow {
  name: string
  id: string
}

interface VideoRow {
  title: string
  show_id: string | null
  shows: ShowRow | null
}

interface ClipRow extends Clip {
  videos: VideoRow | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_VALUES: Array<ClipStatus | 'all'> = [
  'all', 'candidate', 'approved', 'rejected', 'rendering', 'ready', 'posted',
]
const STATUS_LABELS: Record<ClipStatus | 'all', string> = {
  all: 'All', candidate: 'Candidate', approved: 'Approved',
  rejected: 'Rejected', rendering: 'Rendering', ready: 'Ready', posted: 'Posted',
}

const SOURCE_VALUES: Array<ClipSource | 'all'> = ['all', 'ai', 'manual', 'marker', 'planned']
const SOURCE_LABELS: Record<ClipSource | 'all', string> = {
  all: 'All', ai: 'AI', manual: 'Manual', marker: 'Marker', planned: 'Planned',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

function duration(clip: Clip): string {
  return (clip.end_s - clip.start_s).toFixed(1) + 's'
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface SourceBadgeProps { source: ClipSource }
function SourceBadge({ source }: SourceBadgeProps): JSX.Element {
  const classMap: Record<ClipSource, string> = {
    ai: styles.sourceAi,
    manual: styles.sourceManual,
    marker: styles.sourceMarker,
    planned: styles.sourcePlanned,
  }
  return (
    <span className={`${styles.pill} ${classMap[source]}`}>
      {SOURCE_LABELS[source]}
    </span>
  )
}

interface StatusBadgeProps { status: ClipStatus }
function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  const classMap: Record<ClipStatus, string> = {
    candidate: styles.statusCandidate,
    approved: styles.statusApproved,
    rejected: styles.statusRejected,
    rendering: styles.statusRendering,
    ready: styles.statusReady,
    posted: styles.statusPosted,
  }
  return (
    <span className={`${styles.pill} ${classMap[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  clip: ClipRow
  onClose: () => void
  onStatusChange: (id: string, status: ClipStatus) => void
  updating: boolean
}

function DetailPanel({ clip, onClose, onStatusChange, updating }: DetailPanelProps): JSX.Element {
  const videoTitle = clip.videos?.title ?? 'Unknown Video'

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>{videoTitle}</div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className={styles.panelBody}>
        {/* Timecodes */}
        <div className={styles.panelSection}>
          <div className={styles.panelLabel}>Timecodes</div>
          <div className={styles.timecodeRow}>
            <span>Start: {formatTimecode(clip.start_s)}</span>
            <span className={styles.timecodeSep}>/</span>
            <span>End: {formatTimecode(clip.end_s)}</span>
            <span className={styles.timecodeSep}>/</span>
            <span>Duration: {duration(clip)}</span>
          </div>
        </div>

        {/* Source + Score */}
        <div className={styles.panelSection}>
          <div className={styles.panelLabel}>Source</div>
          <div className={styles.panelRow}>
            <SourceBadge source={clip.source} />
            {clip.source === 'ai' && clip.score != null && (
              <span className={styles.score}>Score: {clip.score}/100</span>
            )}
          </div>
        </div>

        {/* Hook (AI only) */}
        {clip.source === 'ai' && clip.hook && (
          <div className={styles.panelSection}>
            <div className={styles.panelLabel}>Hook</div>
            <div className={styles.hookCard}>{clip.hook}</div>
          </div>
        )}

        {/* Caption style */}
        {clip.caption_style && (
          <div className={styles.panelSection}>
            <div className={styles.panelLabel}>Caption style</div>
            <div className={styles.panelValue}>{clip.caption_style}</div>
          </div>
        )}

        {/* Reason */}
        {clip.reason && (
          <div className={styles.panelSection}>
            <div className={styles.panelLabel}>Rationale</div>
            <div className={styles.panelValue}>{clip.reason}</div>
          </div>
        )}

        {/* Status */}
        <div className={styles.panelSection}>
          <div className={styles.panelLabel}>Status</div>
          <div className={styles.panelRow}>
            <StatusBadge status={clip.status} />
          </div>
        </div>

        {/* Action buttons */}
        <div className={styles.actionRow}>
          {clip.status === 'candidate' && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => { onStatusChange(clip.id, 'approved') }}
                disabled={updating}
              >
                Approve
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => { onStatusChange(clip.id, 'rejected') }}
                disabled={updating}
              >
                Reject
              </Button>
            </>
          )}
          {clip.status === 'approved' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { onStatusChange(clip.id, 'rejected') }}
              disabled={updating}
            >
              Reject
            </Button>
          )}
          {clip.status === 'rejected' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => { onStatusChange(clip.id, 'approved') }}
              disabled={updating}
            >
              Approve
            </Button>
          )}
          {!['candidate', 'approved', 'rejected'].includes(clip.status) && (
            <span className={styles.readOnlyLabel}>{STATUS_LABELS[clip.status]}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function ClipsScreen(): JSX.Element {
  const [clips, setClips] = useState<ClipRow[]>([])
  const [shows, setShows] = useState<Show[]>([])
  const [loading, setLoading] = useState(true)

  const [statusFilter, setStatusFilter] = useState<ClipStatus | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState<ClipSource | 'all'>('all')
  const [showFilter, setShowFilter] = useState<string>('all')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadClips = useCallback(async (): Promise<void> => {
    setLoading(true)
    let query = supabase
      .from('clips')
      .select('*, videos(title, show_id, shows(name))')
      .order('score', { ascending: false })

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data } = await query
    if (data) {
      let rows = data as ClipRow[]
      if (sourceFilter !== 'all') {
        rows = rows.filter(c => c.source === sourceFilter)
      }
      if (showFilter !== 'all') {
        rows = rows.filter(c => c.videos?.show_id === showFilter)
      }
      setClips(rows)
    }
    setLoading(false)
  }, [statusFilter, sourceFilter, showFilter])

  useEffect(() => {
    void loadClips()
  }, [loadClips])

  // ── Shows ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.from('shows').select('id, name').then(({ data }) => {
      if (data) setShows(data as Show[])
    })
  }, [])

  // ── Realtime ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel('clips-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'clips' },
        () => { void loadClips() },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'clips' },
        () => { void loadClips() },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [loadClips])

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleStatusChange(id: string, status: ClipStatus): Promise<void> {
    setUpdating(true)
    await supabase.from('clips').update({ status }).eq('id', id)
    setUpdating(false)
    void loadClips()
  }

  const selectedClip = selectedId ? clips.find(c => c.id === selectedId) ?? null : null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.screen}>
      {/* Top filter bar */}
      <div className={styles.toolbar}>
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as ClipStatus | 'all') }}
          aria-label="Filter by status"
        >
          {STATUS_VALUES.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All statuses' : STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          className={styles.filterSelect}
          value={sourceFilter}
          onChange={e => { setSourceFilter(e.target.value as ClipSource | 'all') }}
          aria-label="Filter by source"
        >
          {SOURCE_VALUES.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All sources' : SOURCE_LABELS[s]}</option>
          ))}
        </select>
        <select
          className={styles.filterSelect}
          value={showFilter}
          onChange={e => { setShowFilter(e.target.value) }}
          aria-label="Filter by show"
        >
          <option value="all">All shows</option>
          {shows.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <div className={styles.spacer} />
        <span className={styles.count}>{clips.length} result{clips.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Main */}
      <main className={styles.main}>

        <div className={styles.table}>
          <div className={styles.thead}>
            <div className={styles.th}>Video</div>
            <div className={styles.th}>Show</div>
            <div className={styles.th}>Duration</div>
            <div className={styles.th}>Source</div>
            <div className={styles.th}>Score</div>
            <div className={styles.th}>Status</div>
            <div className={styles.th}>Hook</div>
          </div>

          {loading ? (
            <div className={styles.emptyState}>
              <div className={styles.spinner} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : clips.length === 0 ? (
            <div className={styles.emptyState}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <rect x="4" y="8" width="28" height="20" rx="3" stroke="var(--color-line)" strokeWidth="1.5" />
                <path d="M15 14l8 4-8 4V14z" stroke="var(--color-line)" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <span>No clips found</span>
            </div>
          ) : (
            clips.map(clip => (
              <motion.div
                key={clip.id}
                className={`${styles.row} ${selectedId === clip.id ? styles.rowSelected : ''}`}
                onClick={() => { setSelectedId(prev => prev === clip.id ? null : clip.id) }}
                whileHover={{ x: 2 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.15 }}
              >
                <div className={styles.td}>
                  <div className={styles.cellPrimary}>{clip.videos?.title ?? '—'}</div>
                </div>
                <div className={styles.td}>
                  <div className={styles.cellMuted}>{clip.videos?.shows?.name ?? '—'}</div>
                </div>
                <div className={styles.td}>
                  <div className={styles.cellMono}>{duration(clip)}</div>
                </div>
                <div className={styles.td}>
                  <SourceBadge source={clip.source} />
                </div>
                <div className={styles.td}>
                  {clip.source === 'ai' && clip.score != null
                    ? <span className={styles.scoreCell}>{clip.score}</span>
                    : <span className={styles.cellMuted}>—</span>
                  }
                </div>
                <div className={styles.td}>
                  <StatusBadge status={clip.status} />
                </div>
                <div className={styles.td}>
                  <div className={styles.hookCell}>
                    {clip.hook ?? '—'}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </main>

      {/* Detail panel */}
      <AnimatePresence>
        {selectedClip && (
          <>
            <motion.div
              className={styles.overlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelectedId(null) }}
            />
            <motion.div
              className={styles.panelWrapper}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            >
              <DetailPanel
                clip={selectedClip}
                onClose={() => { setSelectedId(null) }}
                onStatusChange={(id, status) => { void handleStatusChange(id, status) }}
                updating={updating}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
