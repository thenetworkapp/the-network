import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase, useAuth } from '@network/core'
import type { Position, Profile, RoleType } from '@network/core'
import { Button } from '@network/ui'
import styles from './CompanyStructureScreen.module.css'

const ROLE_LABELS: Record<RoleType, string> = {
  executive: 'Executive',
  head: 'Head',
  producer: 'Producer',
  editor: 'Editor',
  designer: 'Designer',
  host: 'Host',
  social: 'Social',
  viewer: 'Viewer',
}

const ROLE_STYLE: Record<RoleType, string> = {
  executive: styles.roleExecutive,
  head: styles.roleHead,
  producer: styles.roleProducer,
  editor: styles.roleEditor,
  designer: styles.roleDesigner,
  host: styles.roleHost,
  social: styles.roleSocial,
  viewer: styles.roleViewer,
}

interface AddPositionModal {
  open: boolean
  parentId: string | null
}

export function CompanyStructureScreen(): JSX.Element {
  const { user } = useAuth()
  const [positions, setPositions] = useState<Position[]>([])
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map())
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [modal, setModal] = useState<AddPositionModal>({ open: false, parentId: null })
  const [newTitle, setNewTitle] = useState('')
  const [newRole, setNewRole] = useState<RoleType>('producer')
  const [saving, setSaving] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData(): Promise<void> {
    setLoading(true)
    const [posRes, profRes] = await Promise.all([
      supabase.from('positions').select('*').order('path'),
      supabase.from('profiles').select('*'),
    ])
    if (posRes.data) setPositions(posRes.data as Position[])
    if (profRes.data) {
      const map = new Map<string, Profile>()
      ;(profRes.data as Profile[]).forEach(p => map.set(p.id, p))
      setProfiles(map)
    }
    // Check if current user has manage_users permission
    if (user) {
      const { data } = await supabase.rpc('has_permission', { perm: 'manage_users' })
      setIsAdmin(!!data)
    }
    setLoading(false)
  }

  // Build tree from flat positions array (sorted by ltree path)
  function buildTree(pos: Position[], parentId: string | null = null): Position[] {
    return pos.filter(p => p.parent_id === parentId)
  }

  async function handleReparent(draggedId: string, newParentId: string | null): Promise<void> {
    if (!isAdmin || draggedId === newParentId) return
    const dragged = positions.find(p => p.id === draggedId)
    if (!dragged) return
    // Calculate new path (simple approach: append to parent's path)
    const parent = positions.find(p => p.id === newParentId)
    const newPath = parent ? `${parent.path}.${draggedId.replace(/-/g, '_')}` : draggedId.replace(/-/g, '_')
    const { error } = await supabase
      .from('positions')
      .update({ parent_id: newParentId, path: newPath })
      .eq('id', draggedId)
    if (!error) await loadData()
  }

  async function handleInvite(): Promise<void> {
    if (!inviteEmail.includes('@')) return
    setInviteSending(true)
    setInviteResult(null)
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email: inviteEmail, redirectTo: window.location.origin },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setInviteResult({ ok: true, msg: `Invite sent to ${inviteEmail}` })
      setInviteEmail('')
    } catch (err) {
      setInviteResult({ ok: false, msg: err instanceof Error ? err.message : String(err) })
    } finally {
      setInviteSending(false)
    }
  }

  async function handleAddPosition(): Promise<void> {
    if (!newTitle.trim()) return
    setSaving(true)
    const parent = modal.parentId ? positions.find(p => p.id === modal.parentId) : null
    const id = crypto.randomUUID()
    const path = parent ? `${parent.path}.${id.replace(/-/g, '_')}` : id.replace(/-/g, '_')
    const { error } = await supabase.from('positions').insert({
      id,
      parent_id: modal.parentId,
      title: newTitle.trim(),
      role: newRole,
      show_ids: [],
      path,
    })
    if (!error) {
      setModal({ open: false, parentId: null })
      setNewTitle('')
      await loadData()
    }
    setSaving(false)
  }

  function PositionNode({ position, depth }: { position: Position; depth: number }): JSX.Element {
    const person = position.person_id ? profiles.get(position.person_id) : null
    const children = buildTree(positions, position.id)
    const isVacant = !position.person_id
    const isDragOver = dragOverId === position.id

    return (
      <div className={styles.orgNode}>
        <motion.div
          className={`${styles.positionCard} ${isVacant ? styles.vacant : ''} ${isDragOver ? styles.dragOver : ''}`}
          draggable={isAdmin}
          onDragStart={() => setDragId(position.id)}
          onDragOver={(e) => { e.preventDefault(); setDragOverId(position.id) }}
          onDragLeave={() => setDragOverId(null)}
          onDrop={() => {
            if (dragId && dragId !== position.id) {
              handleReparent(dragId, position.id)
            }
            setDragId(null)
            setDragOverId(null)
          }}
          whileHover={{ y: -1 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
          layout
        >
          <div
            className={styles.avatar}
            style={person?.avatar_colour ? { background: person.avatar_colour, color: '#fff', border: 'none' } : undefined}
          >
            {person ? person.initials : '?'}
          </div>
          <div className={styles.positionTitle}>{position.title}</div>
          <div className={styles.positionPerson}>
            {person ? person.full_name : 'Vacant'}
          </div>
          <span className={`${styles.roleBadge} ${ROLE_STYLE[position.role]}`}>
            {ROLE_LABELS[position.role]}
          </span>
        </motion.div>

        {isAdmin && (
          <button
            className={styles.addReportBtn}
            onClick={() => setModal({ open: true, parentId: position.id })}
          >
            + Add report
          </button>
        )}

        {children.length > 0 && (
          <>
            <div className={styles.connectorDown} />
            <div className={styles.childRow}>
              {children.map(child => (
                <PositionNode key={child.id} position={child} depth={depth + 1} />
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  const roots = buildTree(positions, null)

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
      <div className={styles.toolbar}>
        {isAdmin && (
          <>
            <Button variant="primary" size="sm" onClick={() => setModal({ open: true, parentId: null })}>
              + Add position
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setInviteOpen(true); setInviteResult(null) }}>
              Invite user
            </Button>
          </>
        )}
        {!isAdmin && (
          <p style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            View only — contact an executive to make changes
          </p>
        )}
      </div>

      <div className={styles.tree}>
        {roots.length === 0 ? (
          <div className={styles.emptyState}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect x="14" y="4" width="12" height="8" rx="2" fill="var(--color-surface2)" stroke="var(--color-line)" strokeWidth="1.5" />
              <rect x="2" y="28" width="12" height="8" rx="2" fill="var(--color-surface2)" stroke="var(--color-line)" strokeWidth="1.5" />
              <rect x="26" y="28" width="12" height="8" rx="2" fill="var(--color-surface2)" stroke="var(--color-line)" strokeWidth="1.5" />
              <path d="M20 12v8M8 28v-4h24v4" stroke="var(--color-line)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>No positions yet</span>
            {isAdmin && (
              <Button variant="secondary" size="sm" onClick={() => setModal({ open: true, parentId: null })}>
                Add first position
              </Button>
            )}
          </div>
        ) : (
          <div className={styles.orgRoot}>
            {roots.map(root => (
              <PositionNode key={root.id} position={root} depth={0} />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {inviteOpen && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) { setInviteOpen(false) } }}
          >
            <motion.div
              className={styles.modal}
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            >
              <h2 className={styles.modalTitle}>Invite user</h2>
              <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 16 }}>
                They will receive a magic link to sign in. Assign their role from the org chart once they join.
              </p>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="invite-email">Email address</label>
                <input
                  id="invite-email"
                  className={styles.input}
                  type="email"
                  placeholder="name@example.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleInvite() }}
                  autoFocus
                />
              </div>
              {inviteResult && (
                <p style={{ fontSize: 13, color: inviteResult.ok ? 'var(--color-ok)' : 'var(--color-bad)', marginBottom: 8 }}>
                  {inviteResult.msg}
                </p>
              )}
              <div className={styles.modalActions}>
                <Button variant="secondary" size="sm" onClick={() => setInviteOpen(false)}>Close</Button>
                <Button variant="primary" size="sm" disabled={inviteSending || !inviteEmail.includes('@')} onClick={handleInvite}>
                  {inviteSending ? 'Sending…' : 'Send invite'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal.open && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setModal({ open: false, parentId: null }) }}
          >
            <motion.div
              className={styles.modal}
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            >
              <h2 className={styles.modalTitle}>
                {modal.parentId ? 'Add Report' : 'Add Position'}
              </h2>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="pos-title">Title</label>
                <input id="pos-title" className={styles.input} placeholder="e.g. Senior Editor" value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="pos-role">Role</label>
                <select id="pos-role" className={styles.select} value={newRole} onChange={e => setNewRole(e.target.value as RoleType)}>
                  {(Object.entries(ROLE_LABELS) as [RoleType, string][]).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.modalActions}>
                <Button variant="secondary" size="sm" onClick={() => setModal({ open: false, parentId: null })}>Cancel</Button>
                <Button variant="primary" size="sm" disabled={saving || !newTitle.trim()} onClick={handleAddPosition}>
                  {saving ? 'Saving…' : 'Add position'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
