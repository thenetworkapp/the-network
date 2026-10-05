import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { AuthProvider, useAuth, supabase } from '@network/core'
import type { Profile } from '@network/core'
import styles from './AppShell.module.css'
import { LogoMark } from '../LogoMark/LogoMark'
import { Sidebar } from '../Sidebar/Sidebar'
import { LoginScreen } from '../../screens/Auth/LoginScreen'
import { SetupScreen } from '../../screens/Setup/SetupScreen'
import { ScreenRenderer } from '../../screens/ScreenRenderer'
import type { NavSection } from '../../types'

interface AppShellProps {
  sections: NavSection[]
  platform: 'desktop' | 'web'
  userName?: string
  userInitials?: string
  userAvatarColour?: string
}

declare global {
  interface Window {
    windowControls?: {
      minimise: () => void
      maximise: () => void
      close: () => void
    }
  }
}

type PositionStatus = 'checking' | 'none' | 'pending' | 'ok'

// ── Splash ────────────────────────────────────────────────────────────────────

function SplashScreen({ onDone }: { onDone: () => void }): JSX.Element {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setExiting(true), 1400)
    const t2 = setTimeout(onDone, 1900)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  return (
    <motion.div
      className={styles.splash}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <motion.div
        className={styles.splashInner}
        initial={{ opacity: 0, scale: 0.78, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.32, duration: 0.75, delay: 0.08 }}
      >
        <motion.div
          className={styles.splashMark}
          animate={exiting ? { scale: 1.06, opacity: 0 } : { scale: 1, opacity: 1 }}
          transition={{ duration: 0.35 }}
        >
          <LogoMark size={72} />
        </motion.div>
        <motion.span
          className={styles.splashName}
          initial={{ opacity: 0, y: 7 }}
          animate={{ opacity: exiting ? 0 : 1, y: exiting ? -4 : 0 }}
          transition={{ duration: exiting ? 0.3 : 0.4, delay: exiting ? 0 : 0.5 }}
        >
          The Network
        </motion.span>
        <motion.span
          className={styles.splashSub}
          initial={{ opacity: 0 }}
          animate={{ opacity: exiting ? 0 : 1 }}
          transition={{ duration: 0.4, delay: exiting ? 0 : 0.75 }}
        >
          Production platform
        </motion.span>
      </motion.div>
    </motion.div>
  )
}

// ── Avatar colours ─────────────────────────────────────────────────────────────

const AVATAR_COLOURS = [
  '#1C3FCB', '#7C3AED', '#DC2626', '#EA580C',
  '#16A34A', '#0891B2', '#DB2777', '#374151',
]

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ── Profile Setup (first login) ───────────────────────────────────────────────

function ProfileSetupScreen({ email, onDone }: { email: string; onDone: () => void }): JSX.Element {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [colour, setColour] = useState(AVATAR_COLOURS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(): Promise<void> {
    if (!name.trim() || !user) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: name.trim(),
      initials: getInitials(name),
      avatar_colour: colour,
    })
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false)
    onDone()
  }

  const preview = name.trim() ? getInitials(name) : '?'

  return (
    <div className={styles.profileSetupRoot}>
      <motion.div
        className={styles.profileSetupCard}
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
      >
        <div className={styles.profileSetupAvatar} style={{ background: colour }}>{preview}</div>
        <h1 className={styles.profileSetupHeading}>Set up your profile</h1>
        <p className={styles.profileSetupBody}>
          Welcome to The Network. You're signed in as <strong>{email}</strong>. Tell us your
          name so your team knows it's you.
        </p>

        <div className={styles.profileSetupField}>
          <label className={styles.profileSetupLabel} htmlFor="setup-name">Your full name</label>
          <input
            id="setup-name"
            className={styles.profileSetupInput}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Henry Neal"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') void handleSave() }}
          />
        </div>

        <div className={styles.profileSetupField}>
          <label className={styles.profileSetupLabel}>Avatar colour</label>
          <div className={styles.colourPicker}>
            {AVATAR_COLOURS.map(c => (
              <button
                key={c}
                className={`${styles.colourSwatch} ${colour === c ? styles.colourSwatchActive : ''}`}
                style={{ background: c }}
                onClick={() => setColour(c)}
                aria-label={`Colour ${c}`}
              />
            ))}
          </div>
        </div>

        {error && <p className={styles.profileSetupError}>{error}</p>}

        <button
          className={styles.profileSetupBtn}
          disabled={saving || !name.trim()}
          onClick={() => void handleSave()}
        >
          {saving ? 'Saving…' : 'Get started →'}
        </button>
      </motion.div>
    </div>
  )
}

// ── Account Panel ─────────────────────────────────────────────────────────────

function AccountPanel({
  profile, email, onClose, onSignOut, onUpdate,
}: {
  profile: Profile | null
  email: string
  onClose: () => void
  onSignOut: () => Promise<void>
  onUpdate: (p: Profile) => void
}): JSX.Element {
  const { user } = useAuth()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [colour, setColour] = useState(profile?.avatar_colour ?? AVATAR_COLOURS[0])
  const [saving, setSaving] = useState(false)

  const preview = name.trim() ? getInitials(name) : '?'

  async function handleSave(): Promise<void> {
    if (!name.trim() || !user) return
    setSaving(true)
    const initials = getInitials(name)
    await supabase.from('profiles').upsert({ id: user.id, full_name: name.trim(), initials, avatar_colour: colour })
    setSaving(false)
    onUpdate({ ...(profile!), full_name: name.trim(), initials, avatar_colour: colour })
    onClose()
  }

  return (
    <>
      <motion.div
        className={styles.profileOverlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
      />
      <motion.div
        className={styles.profilePanel}
        initial={{ x: -16, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -16, opacity: 0 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
      >
        <div className={styles.profilePanelHead}>
          <span className={styles.profilePanelTitle}>Account</span>
          <button className={styles.profilePanelClose} onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className={styles.profilePanelBody}>
          <div className={styles.profilePanelAvatarRow}>
            <div className={styles.profilePanelAvatar} style={{ background: colour }}>{preview}</div>
            <div>
              <div className={styles.profilePanelName}>{profile?.full_name || 'Set your name'}</div>
              <div className={styles.profilePanelEmail}>{email}</div>
            </div>
          </div>

          <div className={styles.profilePanelSection}>
            <label className={styles.profilePanelLabel} htmlFor="panel-name">Full name</label>
            <input
              id="panel-name"
              className={styles.profilePanelInput}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>

          <div className={styles.profilePanelSection}>
            <label className={styles.profilePanelLabel}>Avatar colour</label>
            <div className={styles.colourPicker}>
              {AVATAR_COLOURS.map(c => (
                <button
                  key={c}
                  className={`${styles.colourSwatch} ${colour === c ? styles.colourSwatchActive : ''}`}
                  style={{ background: c }}
                  onClick={() => setColour(c)}
                  aria-label={`Colour ${c}`}
                />
              ))}
            </div>
          </div>

          <button
            className={styles.profilePanelSave}
            disabled={saving || !name.trim()}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>

          <button className={styles.profilePanelSignOut} onClick={() => void onSignOut()}>
            Sign out
          </button>
        </div>
      </motion.div>
    </>
  )
}

// ── Shell ─────────────────────────────────────────────────────────────────────

function Shell({ sections, platform, userName, userInitials, userAvatarColour }: AppShellProps): JSX.Element {
  const { user, loading, signOut } = useAuth()
  const firstItem = sections[0]?.items[0]
  const [activeId, setActiveId] = useState(firstItem?.id ?? 'dashboard')
  const [positionStatus, setPositionStatus] = useState<PositionStatus>('checking')
  const [splashDone, setSplashDone] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileChecked, setProfileChecked] = useState(false)

  const handleNavigate = useCallback((id: string) => setActiveId(id), [])

  // Position check — runs during splash
  useEffect(() => {
    if (!user) { setPositionStatus('checking'); return }
    let cancelled = false
    async function check(): Promise<void> {
      const { data: mine } = await supabase
        .from('positions').select('id').eq('person_id', user!.id).limit(1)
      if (cancelled) return
      if (mine && mine.length > 0) { setPositionStatus('ok'); return }
      const { count } = await supabase
        .from('positions').select('id', { count: 'exact', head: true }).not('person_id', 'is', null)
      if (cancelled) return
      setPositionStatus((count ?? 0) === 0 ? 'none' : 'pending')
    }
    void check()
    return () => { cancelled = true }
  }, [user])

  // Profile fetch — runs during splash
  useEffect(() => {
    if (!user) { setProfile(null); setProfileChecked(false); return }
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle().then(({ data }) => {
      setProfile(data as Profile | null)
      setProfileChecked(true)
    })
  }, [user])

  // Derived display values — prefer live profile over props
  const displayName = profile?.full_name || userName || user?.email?.split('@')[0] || 'User'
  const displayInitials = profile?.initials || userInitials || displayName.slice(0, 2).toUpperCase()
  const displayColour = profile?.avatar_colour || userAvatarColour

  const allItems = sections.flatMap(s => s.items)
  const activeLabel = allItems.find(i => i.id === activeId)?.label ?? ''
  const tabItems = allItems.slice(0, 4)

  // ── Splash ──
  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />
  }

  // ── Loading ──
  const stillChecking = loading
    || (user && positionStatus === 'checking')
    || (user && positionStatus === 'ok' && !profileChecked)

  if (stillChecking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--color-ground)' }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2.5px solid var(--color-line)', borderTopColor: 'var(--color-blue)', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Not logged in ──
  if (!user) {
    return <LoginScreen />
  }

  // ── No position assigned yet ──
  if (positionStatus === 'none' || positionStatus === 'pending') {
    return (
      <SetupScreen
        status={positionStatus}
        userEmail={user.email ?? ''}
        onReady={() => setPositionStatus('ok')}
        onSignOut={signOut}
      />
    )
  }

  // ── Profile setup for new accounts ──
  if (positionStatus === 'ok' && profileChecked && (!profile?.full_name)) {
    return (
      <ProfileSetupScreen
        email={user.email ?? ''}
        onDone={() => {
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle().then(({ data }) => {
            setProfile(data as Profile | null)
          })
        }}
      />
    )
  }

  // ── Main app ──
  return (
    <div className={`${styles.shell} ${platform === 'web' ? styles.web : ''}`}>
      {platform === 'desktop' && (
        <Sidebar
          sections={sections}
          activeId={activeId}
          onNavigate={handleNavigate}
          userName={displayName}
          userInitials={displayInitials}
          userAvatarColour={displayColour}
          onSignOut={signOut}
          onProfileClick={() => setShowProfile(true)}
        />
      )}

      <div className={styles.main}>
        {platform === 'desktop' && (
          <div className={styles.titleBar}>
            <button className={styles.titleBarBtn} onClick={() => window.windowControls?.minimise()} aria-label="Minimise">
              <svg width="10" height="2" viewBox="0 0 10 2" fill="currentColor"><rect width="10" height="2" rx="1" /></svg>
            </button>
            <button className={styles.titleBarBtn} onClick={() => window.windowControls?.maximise()} aria-label="Maximise">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.25"><rect x="0.5" y="0.5" width="9" height="9" rx="1.5" /></svg>
            </button>
            <button className={`${styles.titleBarBtn} ${styles.close}`} onClick={() => window.windowControls?.close()} aria-label="Close">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 1l8 8M9 1l-8 8" /></svg>
            </button>
          </div>
        )}

        <div className={styles.content}>
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>{activeLabel}</h1>
          </div>
          <div className={styles.screenContent}>
            <ScreenRenderer activeId={activeId} activeLabel={activeLabel} />
          </div>
        </div>

        {platform === 'web' && (
          <nav className={styles.tabBar} aria-label="Main navigation">
            {tabItems.map(item => (
              <button
                key={item.id}
                className={`${styles.tabItem} ${activeId === item.id ? styles.active : ''}`}
                onClick={() => handleNavigate(item.id)}
                aria-current={activeId === item.id ? 'page' : undefined}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        )}
      </div>

      <AnimatePresence>
        {showProfile && (
          <AccountPanel
            key="account-panel"
            profile={profile}
            email={user.email ?? ''}
            onClose={() => setShowProfile(false)}
            onSignOut={signOut}
            onUpdate={(p) => setProfile(p)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export function AppShell(props: AppShellProps): JSX.Element {
  return (
    <AuthProvider>
      <Shell {...props} />
    </AuthProvider>
  )
}
