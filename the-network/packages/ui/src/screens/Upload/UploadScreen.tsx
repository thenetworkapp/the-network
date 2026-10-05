import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '@network/core'
import { Button } from '@network/ui'
import styles from './UploadScreen.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type PlatformType = 'youtube' | 'instagram' | 'tiktok' | 'spotify' | 'apple_podcasts' | 'rss'
type PublishMode = 'automatic' | 'manual'
type PackageStatus = 'draft' | 'ready' | 'scheduled' | 'uploading' | 'published' | 'failed'
type ApprovalStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected'
type QueueTab = 'all' | 'ready' | 'scheduled' | 'uploading' | 'failed'

interface PlatformApproval {
  platform: PlatformType
  status: ApprovalStatus
  submitted_at: string | null
  feedback: string | null
  next_action: string | null
  updated_by: string | null
}

interface VideoJoin {
  title: string
}

interface ClipJoin {
  hook: string | null
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
  videos: VideoJoin | null
  clips: ClipJoin | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SPRING = { type: 'spring', bounce: 0, duration: 0.35 } as const

const PLATFORM_LABELS: Record<PlatformType, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  spotify: 'Spotify',
  apple_podcasts: 'Apple Podcasts',
  rss: 'RSS',
}

const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  not_submitted: 'Not Submitted',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

const PACKAGE_STATUS_LABELS: Record<PackageStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  scheduled: 'Scheduled',
  uploading: 'Uploading',
  published: 'Published',
  failed: 'Failed',
}

const QUEUE_TABS: QueueTab[] = ['all', 'ready', 'scheduled', 'uploading', 'failed']

const QUEUE_TAB_LABELS: Record<QueueTab, string> = {
  all: 'All',
  ready: 'Ready',
  scheduled: 'Scheduled',
  uploading: 'Uploading',
  failed: 'Failed',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDatetime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function getContentTitle(pkg: PackageRow): string {
  if (pkg.videos?.title) return pkg.videos.title
  if (pkg.clips?.hook) return pkg.clips.hook
  return '—'
}

// ─── Approval Status Badge ────────────────────────────────────────────────────

function ApprovalBadge({ status }: { status: ApprovalStatus }): JSX.Element {
  const classMap: Record<ApprovalStatus, string> = {
    not_submitted: styles.approvalNotSubmitted,
    pending: styles.approvalPending,
    approved: styles.approvalApproved,
    rejected: styles.approvalRejected,
  }
  return (
    <span className={`${styles.approvalBadge} ${classMap[status]}`}>
      {APPROVAL_STATUS_LABELS[status]}
    </span>
  )
}

// ─── Package Status Badge ─────────────────────────────────────────────────────

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
      {PACKAGE_STATUS_LABELS[status]}
    </span>
  )
}

// ─── Platform Approvals Panel ─────────────────────────────────────────────────

interface ApprovalsPanelProps {
  approvals: PlatformApproval[]
  onUpdated: () => void
}

interface ApprovalEditState {
  status: ApprovalStatus
  nextAction: string
}

function ApprovalsPanel({ approvals, onUpdated }: ApprovalsPanelProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing] = useState<Record<string, ApprovalEditState>>({})
  const [saving, setSaving] = useState<string | null>(null)

  function startEdit(platform: PlatformType, current: PlatformApproval): void {
    setEditing(prev => ({
      ...prev,
      [platform]: {
        status: current.status,
        nextAction: current.next_action ?? '',
      },
    }))
  }

  function cancelEdit(platform: PlatformType): void {
    setEditing(prev => {
      const next = { ...prev }
      delete next[platform]
      return next
    })
  }

  async function saveEdit(platform: PlatformType): Promise<void> {
    const state = editing[platform]
    if (!state) return
    setSaving(platform)
    await supabase
      .from('platform_approvals')
      .update({ status: state.status, next_action: state.nextAction })
      .eq('platform', platform)
    setSaving(null)
    cancelEdit(platform)
    onUpdated()
  }

  return (
    <div className={styles.approvalsCard}>
      <button
        className={styles.approvalsToggle}
        onClick={() => { setCollapsed(c => !c) }}
        aria-expanded={!collapsed}
      >
        <span className={styles.approvalsPanelTitle}>Platform Approvals</span>
        <motion.span
          animate={{ rotate: collapsed ? -90 : 0 }}
          transition={SPRING}
          className={styles.chevron}
        >
          &#x2303;
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING}
            className={styles.approvalsBody}
          >
            <div className={styles.approvalsTable}>
              <div className={styles.approvalsHead}>
                <div className={styles.appTh}>Platform</div>
                <div className={styles.appTh}>Status</div>
                <div className={styles.appTh}>Submitted</div>
                <div className={styles.appTh}>Next Action</div>
                <div className={styles.appTh}></div>
              </div>

              {approvals.map(approval => {
                const editState = editing[approval.platform]
                const isSaving = saving === approval.platform

                return (
                  <div key={approval.platform} className={styles.approvalsRow}>
                    <div className={styles.appTd}>
                      <span className={styles.platformName}>{PLATFORM_LABELS[approval.platform]}</span>
                    </div>

                    <div className={styles.appTd}>
                      {editState ? (
                        <select
                          className={styles.inlineSelect}
                          value={editState.status}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                            setEditing(prev => ({
                              ...prev,
                              [approval.platform]: { ...prev[approval.platform], status: e.target.value as ApprovalStatus },
                            }))
                          }}
                        >
                          <option value="not_submitted">Not Submitted</option>
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      ) : (
                        <ApprovalBadge status={approval.status} />
                      )}
                    </div>

                    <div className={styles.appTd}>
                      <span className={styles.appMeta}>{fmtDate(approval.submitted_at)}</span>
                    </div>

                    <div className={styles.appTd}>
                      {editState ? (
                        <input
                          type="text"
                          className={styles.inlineInput}
                          value={editState.nextAction}
                          placeholder="Next action…"
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setEditing(prev => ({
                              ...prev,
                              [approval.platform]: { ...prev[approval.platform], nextAction: e.target.value },
                            }))
                          }}
                        />
                      ) : (
                        <span className={styles.appMeta}>{approval.next_action ?? '—'}</span>
                      )}
                    </div>

                    <div className={`${styles.appTd} ${styles.appActionCell}`}>
                      {editState ? (
                        <>
                          <button
                            className={`${styles.inlineBtn} ${styles.inlineBtnPrimary}`}
                            onClick={() => { void saveEdit(approval.platform) }}
                            disabled={isSaving}
                          >
                            {isSaving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            className={styles.inlineBtn}
                            onClick={() => { cancelEdit(approval.platform) }}
                            disabled={isSaving}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className={styles.inlineBtn}
                          onClick={() => { startEdit(approval.platform, approval) }}
                        >
                          Update
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {approvals.length === 0 && (
                <div className={styles.approvalsEmpty}>No platform approvals found</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Queue Table Row ──────────────────────────────────────────────────────────

interface QueueRowProps {
  pkg: PackageRow
  approvalMap: Map<PlatformType, ApprovalStatus>
  onTrigger: (id: string) => void
  onMarkPublished: (id: string, url: string) => void
  saving: string | null
}

function QueueRow({ pkg, approvalMap, onTrigger, onMarkPublished, saving }: QueueRowProps): JSX.Element {
  const [publishExpanded, setPublishExpanded] = useState(false)
  const [postUrl, setPostUrl] = useState('')
  const platformApprovalStatus = approvalMap.get(pkg.platform)
  const isApproved = platformApprovalStatus === 'approved'
  const isSaving = saving === pkg.id
  const contentTitle = getContentTitle(pkg)

  function handleConfirmPublish(): void {
    if (!postUrl.trim()) return
    onMarkPublished(pkg.id, postUrl.trim())
    setPublishExpanded(false)
    setPostUrl('')
  }

  return (
    <>
      <div className={styles.queueRow}>
        <div className={styles.qTd}>
          <span className={styles.platformChip}>{PLATFORM_LABELS[pkg.platform]}</span>
        </div>
        <div className={styles.qTd}>
          <div className={styles.cellPrimary}>{contentTitle}</div>
        </div>
        <div className={styles.qTd}>
          <div className={styles.cellSecondary}>{pkg.title}</div>
        </div>
        <div className={styles.qTd}>
          <span className={styles.cellMono}>{fmtDatetime(pkg.publish_at)}</span>
        </div>
        <div className={styles.qTd}>
          <StatusBadge status={pkg.status} />
        </div>
        <div className={styles.qTd}>
          {pkg.attempts > 0 ? (
            <span className={styles.attemptsCount}>{pkg.attempts}</span>
          ) : (
            <span className={styles.cellMuted}>—</span>
          )}
        </div>
        <div className={`${styles.qTd} ${styles.qActionCell}`}>
          {(pkg.status === 'ready' || pkg.status === 'failed') && (
            <span title={!isApproved ? 'Platform not approved' : undefined}>
              <button
                className={`${styles.actionBtn} ${styles.actionBtnBlue}`}
                onClick={() => { onTrigger(pkg.id) }}
                disabled={!isApproved || isSaving}
              >
                {isSaving ? 'Triggering…' : 'Trigger Upload'}
              </button>
            </span>
          )}
          {pkg.status === 'uploading' && !publishExpanded && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnGreen}`}
              onClick={() => { setPublishExpanded(true) }}
              disabled={isSaving}
            >
              Mark Published
            </button>
          )}
          {pkg.status === 'published' && pkg.post_url && (
            <a
              href={pkg.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.actionBtn} ${styles.actionBtnLink}`}
            >
              View Post
            </a>
          )}
        </div>
      </div>

      <AnimatePresence>
        {publishExpanded && (
          <motion.div
            className={styles.publishExpandRow}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING}
          >
            <div className={styles.publishExpandInner}>
              <span className={styles.publishExpandLabel}>Post URL</span>
              <input
                type="url"
                className={styles.publishUrlInput}
                value={postUrl}
                placeholder="https://…"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setPostUrl(e.target.value) }}
                autoFocus
              />
              <button
                className={`${styles.actionBtn} ${styles.actionBtnGreen}`}
                onClick={handleConfirmPublish}
                disabled={!postUrl.trim() || isSaving}
              >
                Confirm
              </button>
              <button
                className={styles.actionBtn}
                onClick={() => { setPublishExpanded(false); setPostUrl('') }}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function UploadScreen(): JSX.Element {
  const [approvals, setApprovals] = useState<PlatformApproval[]>([])
  const [packages, setPackages] = useState<PackageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<QueueTab>('all')
  const [saving, setSaving] = useState<string | null>(null)

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadApprovals = useCallback(async (): Promise<void> => {
    const { data } = await supabase
      .from('platform_approvals')
      .select('*')
      .order('platform')
    if (data) setApprovals(data as unknown as PlatformApproval[])
  }, [])

  const loadPackages = useCallback(async (): Promise<void> => {
    const { data } = await supabase
      .from('packages')
      .select('*, videos(title), clips(hook)')
      .in('status', ['ready', 'scheduled', 'uploading', 'failed', 'published'])
      .order('publish_at', { ascending: true, nullsFirst: false })
    if (data) setPackages(data as unknown as PackageRow[])
  }, [])

  const loadAll = useCallback(async (): Promise<void> => {
    setLoading(true)
    await Promise.all([loadApprovals(), loadPackages()])
    setLoading(false)
  }, [loadApprovals, loadPackages])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // ── Realtime ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel('upload-queue-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'packages' },
        () => { void loadPackages() },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'packages' },
        () => { void loadPackages() },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [loadPackages])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleTriggerUpload(id: string): Promise<void> {
    const pkg = packages.find(p => p.id === id)
    if (!pkg) return
    setSaving(id)
    await supabase
      .from('packages')
      .update({ status: 'uploading' as PackageStatus, attempts: pkg.attempts + 1 })
      .eq('id', id)
    setSaving(null)
    void loadPackages()
  }

  async function handleMarkPublished(id: string, postUrl: string): Promise<void> {
    setSaving(id)
    await supabase
      .from('packages')
      .update({ status: 'published' as PackageStatus, post_url: postUrl })
      .eq('id', id)
    setSaving(null)
    void loadPackages()
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const approvalMap = new Map<PlatformType, ApprovalStatus>(
    approvals.map(a => [a.platform, a.status])
  )

  const filteredPackages = activeTab === 'all'
    ? packages
    : packages.filter(p => p.status === activeTab)

  const tabCounts: Record<QueueTab, number> = {
    all: packages.length,
    ready: packages.filter(p => p.status === 'ready').length,
    scheduled: packages.filter(p => p.status === 'scheduled').length,
    uploading: packages.filter(p => p.status === 'uploading').length,
    failed: packages.filter(p => p.status === 'failed').length,
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.screen}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Upload Queue</h1>
      </div>

      {/* Platform approvals */}
      <ApprovalsPanel approvals={approvals} onUpdated={() => { void loadApprovals() }} />

      {/* Tabs */}
      <div className={styles.tabBar}>
        {QUEUE_TABS.map(tab => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => { setActiveTab(tab) }}
          >
            {QUEUE_TAB_LABELS[tab]}
            {tabCounts[tab] > 0 && (
              <span className={`${styles.tabCount} ${activeTab === tab ? styles.tabCountActive : ''}`}>
                {tabCounts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Queue table */}
      <div className={styles.table}>
        <div className={styles.thead}>
          <div className={styles.qTh}>Platform</div>
          <div className={styles.qTh}>Video / Clip</div>
          <div className={styles.qTh}>Package Title</div>
          <div className={styles.qTh}>Publish At</div>
          <div className={styles.qTh}>Status</div>
          <div className={styles.qTh}>Attempts</div>
          <div className={styles.qTh}>Actions</div>
        </div>

        {loading ? (
          <div className={styles.emptyState}>
            <Spinner />
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className={styles.emptyState}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="6" width="24" height="20" rx="3" stroke="var(--color-line)" strokeWidth="1.5" />
              <path d="M10 12h12M10 17h8" stroke="var(--color-line)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>No packages in this queue</span>
          </div>
        ) : (
          filteredPackages.map(pkg => (
            <QueueRow
              key={pkg.id}
              pkg={pkg}
              approvalMap={approvalMap}
              onTrigger={(id) => { void handleTriggerUpload(id) }}
              onMarkPublished={(id, url) => { void handleMarkPublished(id, url) }}
              saving={saving}
            />
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
