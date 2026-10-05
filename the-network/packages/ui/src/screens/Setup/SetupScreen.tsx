import { useState } from 'react'
import { motion } from 'motion/react'
import { supabase } from '@network/core'
import styles from './SetupScreen.module.css'
import { LogoMark } from '../../components/LogoMark/LogoMark'

interface SetupScreenProps {
  status: 'none' | 'pending'
  userEmail: string
  onReady: () => void
  onSignOut: () => Promise<void>
}

export function SetupScreen({ status, userEmail, onReady, onSignOut }: SetupScreenProps): JSX.Element {
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function claimAdmin(): Promise<void> {
    setClaiming(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('bootstrap-admin')
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)
      onReady()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className={styles.root}>
      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      >
        <div className={styles.logo}>
          <LogoMark size={32} aria-hidden="true" />
          <span className={styles.logoText}>The Network</span>
        </div>

        {status === 'none' ? (
          <>
            <h1 className={styles.heading}>Initialise your platform</h1>
            <p className={styles.body}>
              No admin account exists yet. Sign in as <strong>{userEmail}</strong> will claim the
              Executive Director role, giving you full access to manage shows, invite team
              members, and control the platform from any device.
            </p>
            <p className={styles.note}>
              This can only be done once. All future users are invited by an admin.
            </p>
            {error && <p className={styles.error}>{error}</p>}
            <button
              className={styles.primaryBtn}
              onClick={claimAdmin}
              disabled={claiming}
            >
              {claiming ? 'Claiming…' : 'Claim admin access'}
            </button>
          </>
        ) : (
          <>
            <h1 className={styles.heading}>Access pending</h1>
            <p className={styles.body}>
              You are signed in as <strong>{userEmail}</strong>, but you have not been assigned
              a role yet. Ask your platform admin to invite you and assign your position.
            </p>
            <p className={styles.note}>
              Refresh this page once your admin has assigned your role.
            </p>
            <div className={styles.actions}>
              <button className={styles.ghostBtn} onClick={() => window.location.reload()}>
                Check again
              </button>
              <button className={styles.ghostBtn} onClick={onSignOut}>
                Sign out
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}
