import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth } from '@network/core'
import styles from './LoginScreen.module.css'
import { LogoMark } from '../../components/LogoMark/LogoMark'

export function LoginScreen(): JSX.Element {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    try {
      await signIn(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      >
        <LogoMark size={52} aria-hidden="true" className={styles.logo} />
        <h1 className={styles.heading}>The Network</h1>
        <p className={styles.sub}>Sign in to the TBPN production platform</p>

        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div
              key="confirm"
              className={styles.confirm}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            >
              <div className={styles.confirmIcon} aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M4 11l5 5 9-9" stroke="var(--color-ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className={styles.confirmTitle}>Check your inbox</p>
              <p className={styles.confirmBody}>
                We've sent a magic link to <strong>{email}</strong>.<br />
                Click the link to sign in — no password needed.
              </p>
              <button className={styles.confirmBack} onClick={() => { setSent(false); setEmail('') }}>
                Use a different email
              </button>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              className={styles.form}
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            >
              <div>
                <label className={styles.label} htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  className={styles.input}
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <motion.button
                type="submit"
                className={styles.btn}
                disabled={loading || !email.trim()}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
              >
                {loading ? 'Sending…' : 'Send magic link'}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
