import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '@network/core'
import type { Video, Show, VideoStage } from '@network/core'
import { Button } from '@network/ui'
import { VideoRecord } from './VideoRecord'
import styles from './VideosScreen.module.css'

const STAGE_ORDER: VideoStage[] = [
  'idea', 'scheduled', 'pre_production', 'recording', 'footage_received',
  'ai_editing', 'review', 'approved', 'packaging', 'upload_ready', 'published', 'archived',
]

const STAGE_LABELS: Record<VideoStage, string> = {
  idea: 'Idea', scheduled: 'Scheduled', pre_production: 'Pre-Production',
  recording: 'Recording', footage_received: 'Footage Received',
  ai_editing: 'AI Editing', review: 'Review', approved: 'Approved',
  packaging: 'Packaging', upload_ready: 'Upload Ready',
  published: 'Published', archived: 'Archived',
}

const STAGE_CLASS: Record<VideoStage, string> = {
  idea: styles.stageIdea,
  scheduled: styles.stageScheduled,
  pre_production: styles.stagePreProduction,
  recording: styles.stageRecording,
  footage_received: styles.stageFootageReceived,
  ai_editing: styles.stageAiEditing,
  review: styles.stageReview,
  approved: styles.stageApproved,
  packaging: styles.stagePackaging,
  upload_ready: styles.stageUploadReady,
  published: styles.stagePublished,
  archived: styles.stageArchived,
}

const PAGE_SIZE = 20

export function VideosScreen(): JSX.Element {
  const [videos, setVideos] = useState<Video[]>([])
  const [shows, setShows] = useState<Show[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showFilter, setShowFilter] = useState('all')
  const [stageFilter, setStageFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData(): Promise<void> {
    setLoading(true)
    const [vidRes, showRes] = await Promise.all([
      supabase.from('videos').select('*').order('created_at', { ascending: false }),
      supabase.from('shows').select('*').eq('archived', false),
    ])
    if (vidRes.data) setVideos(vidRes.data as Video[])
    if (showRes.data) setShows(showRes.data as Show[])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return videos.filter(v => {
      if (search && !v.title.toLowerCase().includes(search.toLowerCase())) return false
      if (showFilter === 'other') { if (v.show_id !== null) return false }
      else if (showFilter !== 'all' && v.show_id !== showFilter) return false
      if (stageFilter !== 'all' && v.stage !== stageFilter) return false
      return true
    })
  }, [videos, search, showFilter, stageFilter])

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const showMap = useMemo(() => {
    const m = new Map<string, Show>()
    shows.forEach(s => m.set(s.id, s))
    return m
  }, [shows])

  const selectedVideo = selectedId ? videos.find(v => v.id === selectedId) ?? null : null

  function formatDate(iso: string | null): string {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
  }

  return (
    <div className={styles.screen}>
      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Search videos…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          aria-label="Search videos"
        />
        <select
          className={styles.filterSelect}
          value={showFilter}
          onChange={e => { setShowFilter(e.target.value); setPage(0) }}
          aria-label="Filter by show"
        >
          <option value="all">All shows</option>
          {shows.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          <option value="other">Other</option>
        </select>
        <select
          className={styles.filterSelect}
          value={stageFilter}
          onChange={e => { setStageFilter(e.target.value); setPage(0) }}
          aria-label="Filter by stage"
        >
          <option value="all">All stages</option>
          {STAGE_ORDER.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
        <div className={styles.spacer} />
        <Button variant="primary" size="sm">+ New Video</Button>
      </div>

      <div className={styles.table}>
        <div className={styles.thead}>
          <div className={styles.th}>Title</div>
          <div className={styles.th}>Stage</div>
          <div className={styles.th}>Record date</div>
          <div className={styles.th}>Publish date</div>
          <div className={styles.th}>Show</div>
        </div>

        {loading ? (
          <div className={styles.emptyState}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--color-line)', borderTopColor: 'var(--color-blue)', animation: 'spin 0.7s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : paged.length === 0 ? (
          <div className={styles.emptyState}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect x="3" y="8" width="24" height="20" rx="3" stroke="var(--color-line)" strokeWidth="1.5" />
              <path d="M27 14l6-4v16l-6-4" stroke="var(--color-line)" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span>No videos found</span>
          </div>
        ) : (
          paged.map(video => (
            <motion.div
              key={video.id}
              className={styles.row}
              onClick={() => setSelectedId(video.id)}
              whileHover={{ x: 2 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.15 }}
            >
              <div className={styles.td}>
                <div className={styles.videoTitle}>{video.title}</div>
                {video.episode_no && <div className={styles.videoSubtitle}>EP{String(video.episode_no).padStart(2,'0')}</div>}
              </div>
              <div className={styles.td}>
                <span className={`${styles.stagePill} ${STAGE_CLASS[video.stage]}`}>
                  {STAGE_LABELS[video.stage]}
                </span>
              </div>
              <div className={styles.td}>{formatDate(video.record_at)}</div>
              <div className={styles.td}>{formatDate(video.publish_at)}</div>
              <div className={styles.td} style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                {video.show_id ? (showMap.get(video.show_id)?.name ?? '—') : 'Other'}
              </div>
            </motion.div>
          ))
        )}

        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button className={styles.pageBtn} disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Previous</button>
            <span>Page {page + 1} of {totalPages} · {filtered.length} videos</span>
            <button className={styles.pageBtn} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {/* VideoRecord slide-in panel */}
      <AnimatePresence>
        {selectedVideo && (
          <>
            <motion.div
              style={{ position: 'fixed', inset: 0, background: 'rgba(17,19,24,.3)', zIndex: 100, backdropFilter: 'blur(4px)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedId(null)}
            />
            <motion.div
              style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 680, zIndex: 101, overflowY: 'auto', background: 'var(--color-ground)' }}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            >
              <VideoRecord
                video={selectedVideo}
                show={selectedVideo.show_id ? showMap.get(selectedVideo.show_id) ?? null : null}
                onClose={() => setSelectedId(null)}
                onUpdate={loadData}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
