import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase, useAuth } from '@network/core'
import styles from './PhoneApprovalsScreen.module.css'

interface Video {
  title: string
  show_id: string
}

interface Approval {
  id: string
  video_id: string
  approver_id: string
  status: 'pending' | 'approved' | 'rejected'
  notes: string | null
  created_at: string
  videos: Video | null
}

function useApprovals(): {
  approvals: Approval[]
  loading: boolean
  approve: (id: string) => Promise<void>
  reject: (id: string, notes: string) => Promise<void>
} {
  const { user } = useAuth()
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    supabase
      .from('approvals')
      .select('*, videos(title, show_id)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setApprovals((data as Approval[] | null) ?? [])
        setLoading(false)
      })
  }, [user])

  async function approve(id: string): Promise<void> {
    await supabase.from('approvals').update({ status: 'approved' }).eq('id', id)
    setApprovals(prev => prev.filter(a => a.id !== id))
  }

  async function reject(id: string, notes: string): Promise<void> {
    await supabase.from('approvals').update({ status: 'rejected', notes }).eq('id', id)
    setApprovals(prev => prev.filter(a => a.id !== id))
  }

  return { approvals, loading, approve, reject }
}

export function useApprovalCount(): number {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!user) return

    supabase
      .from('approvals')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count: c }) => setCount(c ?? 0))
  }, [user])

  return count
}

interface ApprovalItemProps {
  approval: Approval
  onApprove: (id: string) => Promise<void>
  onReject: (id: string, notes: string) => Promise<void>
}

function ApprovalItem({ approval, onApprove, onReject }: ApprovalItemProps): JSX.Element {
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleApprove(): Promise<void> {
    setSubmitting(true)
    await onApprove(approval.id)
  }

  async function handleRejectSubmit(): Promise<void> {
    setSubmitting(true)
    await onReject(approval.id, notes)
  }

  return (
    <motion.div
      className={styles.item}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
    >
      <div className={styles.itemTitle}>
        {approval.videos?.title ?? 'Untitled video'}
      </div>
      <div className={styles.itemMeta}>
        {new Date(approval.created_at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
        })}
      </div>

      {showRejectInput ? (
        <div className={styles.rejectForm}>
          <input
            className={styles.notesInput}
            placeholder="Reason for rejection (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            autoFocus
          />
          <div className={styles.rejectActions}>
            <button
              className={styles.cancelBtn}
              onClick={() => setShowRejectInput(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className={styles.rejectConfirmBtn}
              onClick={handleRejectSubmit}
              disabled={submitting}
            >
              {submitting ? 'Rejecting…' : 'Confirm reject'}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <button
            className={styles.approveBtn}
            onClick={handleApprove}
            disabled={submitting}
          >
            {submitting ? '…' : 'Approve'}
          </button>
          <button
            className={styles.rejectBtn}
            onClick={() => setShowRejectInput(true)}
            disabled={submitting}
          >
            Reject
          </button>
        </div>
      )}
    </motion.div>
  )
}

export function PhoneApprovalsScreen(): JSX.Element {
  const { approvals, loading, approve, reject } = useApprovals()

  return (
    <div className={styles.screen}>
      <h1 className={styles.heading}>Approvals</h1>

      {loading ? (
        <div className={styles.skeletonList}>
          {[0, 1, 2].map(i => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      ) : approvals.length === 0 ? (
        <div className={styles.emptyState}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <circle cx="20" cy="20" r="16" stroke="var(--color-line)" strokeWidth="2" />
            <path d="M13 20l5 5 9-9" stroke="var(--color-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className={styles.emptyText}>No pending approvals</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {approvals.map(approval => (
            <ApprovalItem
              key={approval.id}
              approval={approval}
              onApprove={approve}
              onReject={reject}
            />
          ))}
        </AnimatePresence>
      )}
    </div>
  )
}
