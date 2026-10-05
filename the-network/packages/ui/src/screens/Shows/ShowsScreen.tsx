import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase, useAuth } from '@network/core'
import type { Show, EditType, CameraMode } from '@network/core'
import { Button } from '@network/ui'
import styles from './ShowsScreen.module.css'

const EDIT_TYPE_LABELS: Record<EditType, string> = {
  show: 'Long-form',
  podcast: 'Podcast',
  quick: 'Quick cut',
}

const CAMERA_LABELS: Record<CameraMode, string> = {
  multi: 'Multi-cam',
  single: 'Single-cam',
  remote: 'Remote',
}

export function ShowsScreen(): JSX.Element {
  const { user } = useAuth()
  const [shows, setShows] = useState<Show[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [formEditType, setFormEditType] = useState<EditType>('show')
  const [formCamera, setFormCamera] = useState<CameraMode>('multi')
  const [slugManual, setSlugManual] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { void loadData() }, [])

  async function loadData(): Promise<void> {
    setLoading(true)
    const { data } = await supabase.from('shows').select('*').order('name')
    if (data) setShows(data as Show[])
    if (user) {
      const { data: perm } = await supabase.rpc('has_permission', { perm: 'manage_destinations' })
      setIsAdmin(!!perm)
    }
    setLoading(false)
  }

  function slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  function openCreate(): void {
    setEditingId(null)
    setFormName('')
    setFormSlug('')
    setFormEditType('show')
    setFormCamera('multi')
    setSlugManual(false)
    setModalOpen(true)
  }

  function openEdit(show: Show): void {
    setEditingId(show.id)
    setFormName(show.name)
    setFormSlug(show.slug)
    setFormEditType(show.default_edit_type)
    setFormCamera(show.default_camera)
    setSlugManual(true)
    setModalOpen(true)
  }

  function handleNameChange(name: string): void {
    setFormName(name)
    if (!slugManual) setFormSlug(slugify(name))
  }

  async function handleSave(): Promise<void> {
    if (!formName.trim() || !formSlug.trim()) return
    setSaving(true)
    if (editingId) {
      await supabase.from('shows').update({
        name: formName.trim(),
        slug: formSlug.trim(),
        default_edit_type: formEditType,
        default_camera: formCamera,
      }).eq('id', editingId)
    } else {
      await supabase.from('shows').insert({
        id: crypto.randomUUID(),
        name: formName.trim(),
        slug: formSlug.trim(),
        default_edit_type: formEditType,
        default_camera: formCamera,
        archived: false,
        brand_kit_id: null,
      })
    }
    setModalOpen(false)
    await loadData()
    setSaving(false)
  }

  async function handleArchiveToggle(show: Show): Promise<void> {
    await supabase.from('shows').update({ archived: !show.archived }).eq('id', show.id)
    await loadData()
  }

  const visible = shows.filter(s => showArchived || !s.archived)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--color-line)', borderTopColor: 'var(--color-blue)', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Shows</h1>
          <span className={styles.count}>{visible.length} {showArchived ? 'total' : 'active'}</span>
        </div>
        <div className={styles.headerRight}>
          <button
            className={`${styles.archiveToggle} ${showArchived ? styles.archiveToggleActive : ''}`}
            onClick={() => setShowArchived(v => !v)}
          >
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
          {isAdmin && (
            <Button variant="primary" size="sm" onClick={openCreate}>
              + New show
            </Button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className={styles.emptyState}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="6" y="12" width="36" height="26" rx="3" fill="var(--color-surface2)" stroke="var(--color-line)" strokeWidth="1.5" />
            <path d="M20 20l10 6-10 6V20z" fill="var(--color-line)" />
          </svg>
          <span>{showArchived ? 'No shows found' : 'No active shows'}</span>
          {isAdmin && !showArchived && (
            <Button variant="secondary" size="sm" onClick={openCreate}>
              Create your first show
            </Button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {visible.map(show => (
            <motion.div
              key={show.id}
              className={`${styles.card} ${show.archived ? styles.cardArchived : ''}`}
              whileHover={{ y: -2 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
              layout
            >
              {show.archived && <div className={styles.archivedBanner}>Archived</div>}
              <div className={styles.cardBody}>
                <div className={styles.cardIcon} aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <rect x="2" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M9 8l5 3-5 3V8z" fill="currentColor" />
                  </svg>
                </div>
                <div className={styles.cardName}>{show.name}</div>
                <div className={styles.cardSlug}>{show.slug}</div>
                <div className={styles.cardBadges}>
                  <span className={`${styles.badge} ${styles[`editType_${show.default_edit_type}`]}`}>
                    {EDIT_TYPE_LABELS[show.default_edit_type]}
                  </span>
                  <span className={`${styles.badge} ${styles.badgeCamera}`}>
                    {CAMERA_LABELS[show.default_camera]}
                  </span>
                </div>
              </div>
              {isAdmin && (
                <div className={styles.cardActions}>
                  <button className={styles.actionBtn} onClick={() => openEdit(show)} title="Edit">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" />
                    </svg>
                  </button>
                  <button
                    className={`${styles.actionBtn} ${show.archived ? styles.actionBtnActive : ''}`}
                    onClick={() => handleArchiveToggle(show)}
                    title={show.archived ? 'Unarchive' : 'Archive'}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="4" width="12" height="8" rx="1" />
                      <path d="M1 4l2-3h8l2 3" />
                      <path d="M5 8h4" />
                    </svg>
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}
          >
            <motion.div
              className={styles.modal}
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            >
              <h2 className={styles.modalTitle}>{editingId ? 'Edit show' : 'New show'}</h2>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="show-name">Name</label>
                <input
                  id="show-name"
                  className={styles.input}
                  placeholder="e.g. Oxford City TV"
                  value={formName}
                  onChange={e => handleNameChange(e.target.value)}
                  autoFocus
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="show-slug">Slug</label>
                <input
                  id="show-slug"
                  className={styles.input}
                  placeholder="oxford-city-tv"
                  value={formSlug}
                  onChange={e => { setFormSlug(e.target.value); setSlugManual(true) }}
                  spellCheck={false}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="show-edit-type">Edit type</label>
                  <select id="show-edit-type" className={styles.select} value={formEditType} onChange={e => setFormEditType(e.target.value as EditType)}>
                    {(Object.entries(EDIT_TYPE_LABELS) as [EditType, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="show-camera">Camera</label>
                  <select id="show-camera" className={styles.select} value={formCamera} onChange={e => setFormCamera(e.target.value as CameraMode)}>
                    {(Object.entries(CAMERA_LABELS) as [CameraMode, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.modalActions}>
                <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button variant="primary" size="sm" disabled={saving || !formName.trim() || !formSlug.trim()} onClick={handleSave}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create show'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
