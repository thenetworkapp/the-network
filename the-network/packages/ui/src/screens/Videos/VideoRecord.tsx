import { useState, useEffect } from 'react'
import { supabase } from '@network/core'
import type { Video, VideoStage, Show, RunningOrderItem, Guest, DeviceFile } from '@network/core'
import { Button, StatusDot } from '@network/ui'
import styles from './VideoRecord.module.css'

interface VideoRecordProps {
  video: Video
  show: Show | null
  onClose: () => void
  onUpdate: () => void
}

const STAGES: VideoStage[] = [
  'idea', 'scheduled', 'pre_production', 'recording', 'footage_received',
  'ai_editing', 'review', 'approved', 'packaging', 'upload_ready', 'published',
]

const STAGE_LABELS_SHORT: Record<VideoStage, string> = {
  idea: 'Idea', scheduled: 'Sched.', pre_production: 'Pre-prod', recording: 'Record',
  footage_received: 'Footage', ai_editing: 'AI Edit', review: 'Review',
  approved: 'Approved', packaging: 'Pack.', upload_ready: 'Upload', published: 'Live', archived: 'Archive',
}

type Tab = 'overview' | 'running-order' | 'files' | 'team' | 'guests'

export function VideoRecord({ video, show, onClose, onUpdate }: VideoRecordProps): JSX.Element {
  const [tab, setTab] = useState<Tab>('overview')
  const [runningOrder, setRunningOrder] = useState<RunningOrderItem[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [files, setFiles] = useState<DeviceFile[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadDetails()
  }, [video.id])

  async function loadDetails(): Promise<void> {
    setLoading(true)
    const [roRes, gRes, fRes] = await Promise.all([
      supabase.from('running_order').select('*').eq('video_id', video.id).order('position'),
      supabase.from('guests').select('*').eq('video_id', video.id),
      supabase.from('device_files').select('*').eq('video_id', video.id),
    ])
    if (roRes.data) setRunningOrder(roRes.data as RunningOrderItem[])
    if (gRes.data) setGuests(gRes.data as Guest[])
    if (fRes.data) setFiles(fRes.data as DeviceFile[])
    setLoading(false)
  }

  async function advanceStage(): Promise<void> {
    const idx = STAGES.indexOf(video.stage)
    if (idx < 0 || idx >= STAGES.length - 1) return
    const nextStage = STAGES[idx + 1]
    const { error } = await supabase
      .from('videos')
      .update({ stage: nextStage })
      .eq('id', video.id)
    if (!error) onUpdate()
  }

  function formatDuration(s: number | null): string {
    if (!s) return '—'
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}h ${m}m`
    return `${m}m ${sec}s`
  }

  function formatDate(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function formatFileSize(bytes: number): string {
    if (bytes > 1e9) return `${(bytes/1e9).toFixed(1)} GB`
    if (bytes > 1e6) return `${(bytes/1e6).toFixed(0)} MB`
    return `${(bytes/1e3).toFixed(0)} KB`
  }

  const stageIdx = STAGES.indexOf(video.stage)
  const nextStage = stageIdx >= 0 && stageIdx < STAGES.length - 1 ? STAGES[stageIdx + 1] : null

  const filesByKind = {
    raw: files.filter(f => f.kind === 'raw'),
    project: files.filter(f => f.kind === 'project'),
    export: files.filter(f => f.kind === 'export'),
    proxy: files.filter(f => f.kind === 'proxy'),
  }

  const hasFootage = files.some(f => f.kind === 'raw')

  return (
    <div className={styles.record}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
        <div className={styles.headerInfo}>
          {show && <div className={styles.showTag}>{show.name}</div>}
          <h2 className={styles.title}>{video.title}</h2>
          <div className={styles.stageLine}>
            <StatusDot
              status={video.stage === 'published' ? 'ok' : video.stage === 'recording' ? 'live' : video.stage === 'review' ? 'warn' : 'neutral'}
              label={STAGE_LABELS_SHORT[video.stage]}
            />
            {nextStage && (
              <Button variant="primary" size="sm" onClick={advanceStage}>
                Move to {STAGE_LABELS_SHORT[nextStage as VideoStage]} →
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stage tracker */}
      <div className={styles.stageTracker}>
        <div className={styles.stageSteps}>
          {STAGES.filter(s => s !== 'archived').map((stage, idx) => {
            const done = STAGES.indexOf(stage) < stageIdx
            const current = stage === video.stage
            return (
              <div key={stage} style={{ display: 'flex', alignItems: 'center' }}>
                <div className={`${styles.stageStep} ${done ? styles.done : ''} ${current ? styles.current : ''}`}>
                  <div className={styles.stageDot}>
                    {done ? (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (idx + 1).toString()}
                  </div>
                  <span className={styles.stageStepLabel}>{STAGE_LABELS_SHORT[stage]}</span>
                </div>
                {idx < STAGES.filter(s => s !== 'archived').length - 1 && (
                  <div className={`${styles.stageConnector} ${done ? styles.done : ''}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Files held-by banner */}
      {!hasFootage && ['footage_received', 'ai_editing', 'review', 'approved'].includes(video.stage) && (
        <div className={styles.panel} style={{ paddingBottom: 0 }}>
          <div className={styles.heldByBanner}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 3a1 1 0 011-1h4l2 2h5a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V3z" />
            </svg>
            No footage files found on any device — footage may still be on an editing machine
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        {(['overview', 'running-order', 'files', 'team', 'guests'] as Tab[]).map(t => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.active : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'running-order' ? 'Running Order' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={styles.panel}>
        {tab === 'overview' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}><span className={styles.cardTitle}>Details</span></div>
            <div className={styles.cardBody}>
              {[
                ['Show', show?.name ?? 'Other'],
                ['Episode', video.episode_no ? `EP${String(video.episode_no).padStart(2,'0')}` : '—'],
                ['Record date', formatDate(video.record_at)],
                ['Publish date', formatDate(video.publish_at)],
                ['Target length', formatDuration(video.target_length_s)],
                ['Edit type', video.edit_type],
                ['Camera mode', video.camera_mode],
                ['Folder', video.folder_slug ?? '—'],
              ].map(([label, value]) => (
                <div key={label as string} className={styles.metaRow}>
                  <span className={styles.metaLabel}>{label as string}</span>
                  <span className={styles.metaValue}>{value as string}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'running-order' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Running Order</span>
              <Button variant="secondary" size="sm">+ Add section</Button>
            </div>
            <div className={styles.cardBody}>
              {runningOrder.length === 0 ? (
                <p style={{ color: 'var(--color-muted)', fontSize: 13 }}>No running order yet</p>
              ) : runningOrder.map(item => (
                <div key={item.id} className={styles.orderRow}>
                  <div className={styles.orderPos}>{item.position}</div>
                  <span className={styles.orderName}>{item.name}</span>
                  {item.target_s && <span className={styles.orderMeta}>{formatDuration(item.target_s)}</span>}
                  {item.planned_clip && (
                    <span style={{ fontSize: 10, background: 'rgba(28,63,203,.1)', color: 'var(--color-blue)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Clip</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'files' && (
          <>
            {(['raw', 'project', 'export', 'proxy'] as const).map(kind => (
              <div key={kind} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>{kind.charAt(0).toUpperCase() + kind.slice(1)} files</span>
                  <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{filesByKind[kind].length} files</span>
                </div>
                <div className={styles.cardBody}>
                  {filesByKind[kind].length === 0 ? (
                    <p style={{ color: 'var(--color-muted)', fontSize: 12 }}>No {kind} files</p>
                  ) : filesByKind[kind].map(f => (
                    <div key={`${f.device_id}-${f.rel_path}`} className={styles.filesRow}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{ color: 'var(--color-muted)', flexShrink: 0 }}>
                        <path d="M3 2a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V5l-3-3H3z" />
                      </svg>
                      <span style={{ flex: 1, fontSize: 12, color: 'var(--color-ink2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.rel_path.split('/').pop()}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-muted)', flexShrink: 0 }}>{formatFileSize(f.bytes)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'team' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Team</span>
              <Button variant="secondary" size="sm">+ Assign</Button>
            </div>
            <div className={styles.cardBody}>
              <p style={{ color: 'var(--color-muted)', fontSize: 13 }}>No team members assigned</p>
            </div>
          </div>
        )}

        {tab === 'guests' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Guests</span>
              <Button variant="secondary" size="sm">+ Add guest</Button>
            </div>
            <div className={styles.cardBody}>
              {guests.length === 0 ? (
                <p style={{ color: 'var(--color-muted)', fontSize: 13 }}>No guests for this episode</p>
              ) : guests.map(g => (
                <div key={g.id} className={styles.metaRow}>
                  <span className={styles.metaLabel}>{g.name}</span>
                  <span className={styles.metaValue}>{g.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
