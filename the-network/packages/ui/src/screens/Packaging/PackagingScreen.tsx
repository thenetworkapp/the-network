import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '@network/core'
import { Button } from '@network/ui'
import styles from './PackagingScreen.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type PlatformType = 'youtube' | 'instagram' | 'tiktok' | 'spotify' | 'apple_podcasts' | 'rss'
type PublishMode = 'automatic' | 'manual'
type PackageStatus = 'draft' | 'ready' | 'scheduled' | 'uploading' | 'published' | 'failed'
type VideoStage = 'idea' | 'scheduled' | 'pre_production' | 'recording' | 'footage_received' | 'ai_editing' | 'review' | 'approved' | 'packaging' | 'upload_ready' | 'published' | 'archived'

interface ShowRow {
  id: string
  name: string
}

interface VideoRow {
  id: string
  title: string
  stage: VideoStage
  record_at: string | null
  show_id: string | null
  shows: ShowRow | null
}

interface PackageRow {
  id: string
  video_id: string | null
  clip_id: string | null
  platform: PlatformType
  title: string
  description: string
  tags: string[]
  thumbnail_asset_id: string | null
  publish_at: string | null
  mode: PublishMode
  status: PackageStatus
  external_id: string | null
  post_url: string | null
  attempts: number
}

interface AssetRow {
  id: string
  name: string
  kind: string
  show_id: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SPRING = { type: 'spring', bounce: 0, duration: 0.35 } as const

const ELIGIBLE_STAGES: VideoStage[] = ['approved', 'packaging', 'upload_ready']

const PLATFORM_LABELS: Record<PlatformType, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  spotify: 'Spotify',
  apple_podcasts: 'Apple Podcasts',
  rss: 'RSS',
}

const PLATFORM_COLOUR: Record<PlatformType, string> = {
  youtube: '#FF0000',
  instagram: '#E1306C',
  tiktok: '#010101',
  spotify: '#1DB954',
  apple_podcasts: '#9933CC',
  rss: '#FF6600',
}

const STATUS_LABELS: Record<PackageStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  scheduled: 'Scheduled',
  uploading: 'Uploading',
  published: 'Published',
  failed: 'Failed',
}

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtShortDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function fmtDatetime(iso: string | null): string {
  if (!iso) return 'No date set'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Stage Badge ──────────────────────────────────────────────────────────────

function StageBadge({ stage }: { stage: VideoStage }): JSX.Element {
  const classMap: Record<VideoStage, string> = {
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
  return (
    <span className={`${styles.stageBadge} ${classMap[stage]}`}>
      {STAGE_LABELS[stage]}
    </span>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PackageStatus }): JSX.Element {
  const classMap: Record<PackageStatus, string> = {
    draft: styles.statusDraft,
    ready: styles.statusReady,
    scheduled: styles.statusScheduled,
    uploading: styles.statusUploading,
    published: styles.statusPublished,
    failed: styles.statusFailed,
  }
  return (
    <span className={`${styles.statusBadge} ${classMap[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

// ─── Package Card ─────────────────────────────────────────────────────────────

interface PackageCardProps {
  pkg: PackageRow
  onEdit: (pkg: PackageRow) => void
  onMarkReady: (id: string) => void
  onDelete: (id: string) => void
  saving: boolean
}

function PackageCard({ pkg, onEdit, onMarkReady, onDelete, saving }: PackageCardProps): JSX.Element {
  const colour = PLATFORM_COLOUR[pkg.platform]
  const visibleTags = pkg.tags.slice(0, 3)

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.platformRow}>
          <span className={styles.platformDot} style={{ background: colour }} />
          <span className={styles.platformLabel}>{PLATFORM_LABELS[pkg.platform]}</span>
        </div>
        <StatusBadge status={pkg.status} />
      </div>

      <div className={styles.cardTitle}>{pkg.title}</div>

      <div className={styles.cardMeta}>
        <span className={styles.metaItem}>
          <span className={styles.metaLabel}>Publish</span>
          {fmtDatetime(pkg.publish_at)}
        </span>
        <span className={styles.metaItem}>
          <span className={styles.modeBadge}>{pkg.mode === 'automatic' ? 'Auto' : 'Manual'}</span>
        </span>
        {pkg.attempts > 0 && (
          <span className={styles.metaItem}>
            <span className={styles.attemptsLabel}>
              {pkg.attempts} {pkg.attempts === 1 ? 'attempt' : 'attempts'}
            </span>
          </span>
        )}
      </div>

      {visibleTags.length > 0 && (
        <div className={styles.tagRow}>
          {visibleTags.map(tag => (
            <span key={tag} className={styles.tag}>{tag}</span>
          ))}
        </div>
      )}

      <div className={styles.cardActions}>
        <button
          className={styles.actionBtn}
          onClick={() => { onEdit(pkg) }}
          disabled={saving}
        >
          Edit
        </button>
        {pkg.status === 'draft' && (
          <button
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            onClick={() => { onMarkReady(pkg.id) }}
            disabled={saving}
          >
            Mark Ready
          </button>
        )}
        {pkg.status === 'draft' && (
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDestructive}`}
            onClick={() => { onDelete(pkg.id) }}
            disabled={saving}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Package Modal ─────────────────────────────────────────────────────────────

interface PackageModalProps {
  videoId: string
  videoTitle: string
  showId: string | null
  editingPackage: PackageRow | null
  onClose: () => void
  onSaved: () => void
}

function PackageModal({ videoId, videoTitle, showId, editingPackage, onClose, onSaved }: PackageModalProps): JSX.Element {
  const isEdit = editingPackage !== null

  const [platform, setPlatform] = useState<PlatformType>(editingPackage?.platform ?? 'youtube')
  const [title, setTitle] = useState(editingPackage?.title ?? videoTitle)
  const [description, setDescription] = useState(editingPackage?.description ?? '')
  const [tagsRaw, setTagsRaw] = useState((editingPackage?.tags ?? []).join(', '))
  const [publishAt, setPublishAt] = useState(
    editingPackage?.publish_at
      ? editingPackage.publish_at.slice(0, 16)
      : ''
  )
  const [mode, setMode] = useState<PublishMode>(editingPackage?.mode ?? 'automatic')
  const [thumbnailAssetId, setThumbnailAssetId] = useState<string>(editingPackage?.thumbnail_asset_id ?? '')
  const [assets, setAssets] = useState<AssetRow[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!showId) return
    supabase
      .from('assets')
      .select('id, name, kind, show_id')
      .eq('show_id', showId)
      .eq('kind', 'thumbnail')
      .then(({ data }) => {
        if (data) setAssets(data as unknown as AssetRow[])
      })
  }, [showId])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setSaving(true)
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
    const payload = {
      video_id: videoId,
      platform,
      title,
      description,
      tags,
      publish_at: publishAt || null,
      mode,
      thumbnail_asset_id: thumbnailAssetId || null,
    }

    if (isEdit && editingPackage) {
      await supabase.from('packages').update(payload).eq('id', editingPackage.id)
    } else {
      await supabase.from('packages').insert(payload)
    }

    setSaving(false)
    onSaved()
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
        aria-label={isEdit ? 'Edit Package' : 'New Package'}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{isEdit ? 'Edit Package' : 'New Package'}</h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">&#x2715;</button>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e) }}>
          <div className={styles.modalBody}>

            <label className={styles.label}>
              Platform
              <select
                className={styles.input}
                value={platform}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setPlatform(e.target.value as PlatformType) }}
              >
                <option value="youtube">YouTube</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="spotify">Spotify</option>
                <option value="apple_podcasts">Apple Podcasts</option>
                <option value="rss">RSS</option>
              </select>
            </label>

            <label className={styles.label}>
              Title
              <input
                type="text"
                className={styles.input}
                value={title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setTitle(e.target.value) }}
                required
              />
            </label>

            <label className={styles.label}>
              Description
              <textarea
                className={`${styles.input} ${styles.textarea}`}
                value={description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setDescription(e.target.value) }}
                rows={3}
              />
            </label>

            <label className={styles.label}>
              Tags (comma-separated)
              <input
                type="text"
                className={styles.input}
                value={tagsRaw}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setTagsRaw(e.target.value) }}
                placeholder="e.g. football, tactics, analysis"
              />
            </label>

            <label className={styles.label}>
              Publish At
              <input
                type="datetime-local"
                className={styles.input}
                value={publishAt}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setPublishAt(e.target.value) }}
              />
            </label>

            <div className={styles.label}>
              Mode
              <div className={styles.modeToggle}>
                <button
                  type="button"
                  className={`${styles.modeBtn} ${mode === 'automatic' ? styles.modeBtnActive : ''}`}
                  onClick={() => { setMode('automatic') }}
                >
                  Automatic
                </button>
                <button
                  type="button"
                  className={`${styles.modeBtn} ${mode === 'manual' ? styles.modeBtnActive : ''}`}
                  onClick={() => { setMode('manual') }}
                >
                  Manual
                </button>
              </div>
            </div>

            <label className={styles.label}>
              Thumbnail Asset
              <select
                className={styles.input}
                value={thumbnailAssetId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setThumbnailAssetId(e.target.value) }}
              >
                <option value="">None</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>

          </div>

          <div className={styles.modalFooter}>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" disabled={saving}>
              {saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Package')}
            </Button>
          </div>
        </form>
      </motion.div>
    </>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function PackagingScreen(): JSX.Element {
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [shows, setShows] = useState<ShowRow[]>([])
  const [packages, setPackages] = useState<PackageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [packagesLoading, setPackagesLoading] = useState(false)

  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
  const [showFilter, setShowFilter] = useState<string>('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<PackageRow | null>(null)
  const [saving, setSaving] = useState(false)

  // ── Load videos ────────────────────────────────────────────────────────────

  const loadVideos = useCallback(async (): Promise<void> => {
    setLoading(true)
    const { data } = await supabase
      .from('videos')
      .select('id, title, stage, record_at, show_id, shows(id, name)')
      .in('stage', ELIGIBLE_STAGES)
      .order('record_at', { ascending: false })

    if (data) setVideos(data as unknown as VideoRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadVideos()
  }, [loadVideos])

  // ── Load shows ─────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.from('shows').select('id, name').then(({ data }) => {
      if (data) setShows(data as unknown as ShowRow[])
    })
  }, [])

  // ── Load packages for selected video ──────────────────────────────────────

  const loadPackages = useCallback(async (videoId: string): Promise<void> => {
    setPackagesLoading(true)
    const { data } = await supabase
      .from('packages')
      .select('*')
      .eq('video_id', videoId)
      .order('platform')

    if (data) setPackages(data as unknown as PackageRow[])
    setPackagesLoading(false)
  }, [])

  useEffect(() => {
    if (selectedVideoId) {
      void loadPackages(selectedVideoId)
    } else {
      setPackages([])
    }
  }, [selectedVideoId, loadPackages])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleMarkReady(id: string): Promise<void> {
    setSaving(true)
    await supabase.from('packages').update({ status: 'ready' as PackageStatus }).eq('id', id)
    setSaving(false)
    if (selectedVideoId) void loadPackages(selectedVideoId)
  }

  async function handleDelete(id: string): Promise<void> {
    setSaving(true)
    await supabase.from('packages').delete().eq('id', id).eq('status', 'draft')
    setSaving(false)
    if (selectedVideoId) void loadPackages(selectedVideoId)
  }

  function handleEdit(pkg: PackageRow): void {
    setEditingPackage(pkg)
    setModalOpen(true)
  }

  function handleNewPackage(): void {
    setEditingPackage(null)
    setModalOpen(true)
  }

  function handleModalSaved(): void {
    setModalOpen(false)
    setEditingPackage(null)
    if (selectedVideoId) void loadPackages(selectedVideoId)
  }

  // ── Filtered video list ────────────────────────────────────────────────────

  const filteredVideos = showFilter === 'all'
    ? videos
    : videos.filter(v => v.show_id === showFilter)

  const selectedVideo = selectedVideoId
    ? videos.find(v => v.id === selectedVideoId) ?? null
    : null

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.screen}>

      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>Packaging</h2>
          <select
            className={styles.filterSelect}
            value={showFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setShowFilter(e.target.value) }}
            aria-label="Filter by show"
          >
            <option value="all">All shows</option>
            {shows.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className={styles.videoList}>
          {loading ? (
            <div className={styles.sidebarEmpty}>
              <Spinner />
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className={styles.sidebarEmpty}>
              <span>No eligible videos</span>
            </div>
          ) : (
            filteredVideos.map(video => (
              <button
                key={video.id}
                className={`${styles.videoRow} ${selectedVideoId === video.id ? styles.videoRowActive : ''}`}
                onClick={() => { setSelectedVideoId(video.id) }}
              >
                <div className={styles.videoRowMain}>
                  <div className={styles.videoRowTitle}>{video.title}</div>
                  <StageBadge stage={video.stage} />
                </div>
                <div className={styles.videoRowMeta}>
                  <span>{fmtShortDate(video.record_at)}</span>
                  {video.shows && <span className={styles.videoRowShow}>{video.shows.name}</span>}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Content */}
      <main className={styles.content}>
        {selectedVideo === null ? (
          <div className={styles.emptyCenter}>
            <div className={styles.emptyCenterText}>Select a video to manage its packages</div>
          </div>
        ) : (
          <>
            <div className={styles.contentHeader}>
              <div className={styles.contentHeadingGroup}>
                <h2 className={styles.contentTitle}>{selectedVideo.title}</h2>
                <StageBadge stage={selectedVideo.stage} />
              </div>
              <Button variant="primary" size="sm" onClick={handleNewPackage}>
                New Package
              </Button>
            </div>

            {packagesLoading ? (
              <div className={styles.emptyCenter}>
                <Spinner />
              </div>
            ) : packages.length === 0 ? (
              <div className={styles.emptyCenter}>
                <div className={styles.emptyCenterText}>No packages yet. Create the first one.</div>
              </div>
            ) : (
              <div className={styles.packagesGrid}>
                {packages.map(pkg => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    onEdit={handleEdit}
                    onMarkReady={(id) => { void handleMarkReady(id) }}
                    onDelete={(id) => { void handleDelete(id) }}
                    saving={saving}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && selectedVideo && (
          <PackageModal
            key={editingPackage?.id ?? 'new'}
            videoId={selectedVideo.id}
            videoTitle={selectedVideo.title}
            showId={selectedVideo.show_id}
            editingPackage={editingPackage}
            onClose={() => {
              setModalOpen(false)
              setEditingPackage(null)
            }}
            onSaved={handleModalSaved}
          />
        )}
      </AnimatePresence>
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
