import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import styles from './SetupWizard.module.css'
import { LogoMark } from '../../components/LogoMark/LogoMark'

interface SetupWizardProps {
  onComplete: (url: string, anonKey: string) => Promise<void>
}

type Mode = 'choose' | 'join' | 'new' | 'platforms'

// ── Platform data ─────────────────────────────────────────────────────────────

type PlatformId = 'youtube' | 'instagram' | 'tiktok' | 'spotify' | 'apple_podcasts' | 'rss'

interface PlatformDef {
  id: PlatformId
  name: string
  color: string
  usesOAuth: boolean
}

const PLATFORMS: PlatformDef[] = [
  { id: 'youtube', name: 'YouTube', color: '#FF0000', usesOAuth: true },
  { id: 'instagram', name: 'Instagram', color: '#E1306C', usesOAuth: true },
  { id: 'tiktok', name: 'TikTok', color: '#010101', usesOAuth: true },
  { id: 'spotify', name: 'Spotify', color: '#1DB954', usesOAuth: true },
  { id: 'apple_podcasts', name: 'Apple Podcasts', color: '#872EC4', usesOAuth: false },
  { id: 'rss', name: 'RSS Feed', color: '#F26522', usesOAuth: false },
]

interface PlatformAccount {
  id: string
  accountName: string
}

interface PlatformStatus {
  configured: boolean
  accounts: PlatformAccount[]
  feeds: string[]
}

// ── Platform row in wizard ────────────────────────────────────────────────────

function PlatformWizardRow({
  platform,
  status,
  onRefresh,
}: {
  platform: PlatformDef
  status: PlatformStatus | null
  onRefresh: () => void
}): JSX.Element {
  const [showCreds, setShowCreds] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [feedUrl, setFeedUrl] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addingFeed, setAddingFeed] = useState(false)

  const api = (window as any).platformAPI
  const accounts = status?.accounts ?? []
  const isConfigured = status?.configured ?? false

  useEffect(() => {
    if (showCreds && api) {
      api.getCredentials(platform.id).then((c: { clientId: string }) => {
        if (c.clientId) setClientId(c.clientId)
      }).catch(() => undefined)
    }
  }, [showCreds, platform.id, api])

  async function handleSaveCreds(): Promise<void> {
    if (!clientId.trim() || !clientSecret.trim() || !api) return
    setSaving(true)
    await api.setCredentials(platform.id, { clientId: clientId.trim(), clientSecret: clientSecret.trim() })
    setSaving(false)
    setShowCreds(false)
    onRefresh()
  }

  async function handleConnect(): Promise<void> {
    if (!api) return
    setConnecting(true)
    await api.connect(platform.id)
    setConnecting(false)
  }

  async function handleDisconnectAccount(accountId: string): Promise<void> {
    if (!api) return
    await api.disconnectAccount(platform.id, accountId)
    onRefresh()
  }

  async function handleAddFeed(): Promise<void> {
    if (!feedUrl.trim().startsWith('http') || !api) return
    setAddingFeed(true)
    await api.addFeed(platform.id, feedUrl.trim())
    setFeedUrl('')
    setAddingFeed(false)
    onRefresh()
  }

  return (
    <div className={styles.platformRow}>
      <div
        className={styles.platformDot}
        style={{ background: `${platform.color}20`, color: platform.color }}
        aria-hidden="true"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="7" cy="7" r="5" />
        </svg>
      </div>

      <div className={styles.platformInfo}>
        <div className={styles.platformName}>{platform.name}</div>
        {accounts.length > 0 && (
          <div className={styles.platformAccount}>{accounts.length} account{accounts.length !== 1 ? 's' : ''} connected</div>
        )}
        {!platform.usesOAuth && (status?.feeds ?? []).length > 0 && (
          <div className={styles.platformAccount}>{status!.feeds.length} feed{status!.feeds.length !== 1 ? 's' : ''}</div>
        )}
      </div>

      <div className={styles.platformActions}>
        {platform.usesOAuth ? (
          <>
            {!showCreds ? (
              <>
                <button className={styles.credsTrigger} onClick={() => setShowCreds(true)}>
                  {isConfigured ? 'Credentials set' : 'Set credentials'}
                </button>
                <button
                  className={styles.connectBtn}
                  disabled={!isConfigured || connecting || !api}
                  onClick={() => void handleConnect()}
                >
                  {connecting ? 'Opening…' : accounts.length > 0 ? 'Connect another' : 'Connect'}
                </button>
              </>
            ) : (
              <button className={styles.credsTrigger} onClick={() => setShowCreds(false)}>
                Cancel
              </button>
            )}
          </>
        ) : (
          <button className={styles.credsTrigger} onClick={() => setShowCreds(v => !v)}>
            {showCreds ? 'Close' : 'Add feed'}
          </button>
        )}
      </div>

      {/* Connected account chips */}
      {platform.usesOAuth && accounts.length > 0 && (
        <div className={styles.wizardAccountsList}>
          {accounts.map(acc => (
            <div key={acc.id} className={styles.wizardAccountChip}>
              <span>{acc.accountName || 'Connected'}</span>
              <button
                className={styles.wizardAccountRemove}
                onClick={() => void handleDisconnectAccount(acc.id)}
                aria-label={`Disconnect ${acc.accountName || 'account'}`}
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Inline credential form */}
      <AnimatePresence>
        {showCreds && platform.usesOAuth && (
          <motion.div
            className={styles.inlineForm}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.22 }}
          >
            <div className={styles.inlineFormInner}>
              <input
                className={styles.inlineInput}
                placeholder="Client ID"
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                spellCheck={false}
              />
              <input
                className={styles.inlineInput}
                type="password"
                placeholder="Client Secret"
                value={clientSecret}
                onChange={e => setClientSecret(e.target.value)}
              />
              <button
                className={styles.connectBtn}
                disabled={saving || !clientId.trim() || !clientSecret.trim()}
                onClick={() => void handleSaveCreds()}
              >
                {saving ? 'Saving…' : 'Save & connect'}
              </button>
            </div>
          </motion.div>
        )}
        {showCreds && !platform.usesOAuth && (
          <motion.div
            className={styles.inlineForm}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.22 }}
          >
            <div className={styles.inlineFormInner}>
              <input
                className={styles.inlineInput}
                placeholder="https://feeds.example.com/podcast.xml"
                value={feedUrl}
                onChange={e => setFeedUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleAddFeed() }}
                spellCheck={false}
              />
              <button
                className={styles.connectBtn}
                disabled={addingFeed || !feedUrl.trim().startsWith('http')}
                onClick={() => void handleAddFeed()}
              >
                {addingFeed ? 'Adding…' : 'Add'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export function SetupWizard({ onComplete }: SetupWizardProps): JSX.Element {
  const [mode, setMode] = useState<Mode>('choose')
  const [teamCode, setTeamCode] = useState('')
  const [url, setUrl] = useState('')
  const [anonKey, setAnonKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [teamCodeOut, setTeamCodeOut] = useState('')
  const [copied, setCopied] = useState(false)
  const [pendingUrl, setPendingUrl] = useState('')
  const [pendingKey, setPendingKey] = useState('')
  const [platformStatuses, setPlatformStatuses] = useState<Record<string, PlatformStatus> | null>(null)

  const loadPlatformStatuses = useCallback(() => {
    const api = (window as any).platformAPI
    if (api) {
      api.getStatus().then((s: Record<string, PlatformStatus>) => setPlatformStatuses(s))
    } else {
      setPlatformStatuses({})
    }
  }, [])

  useEffect(() => {
    if (mode !== 'platforms') return
    loadPlatformStatuses()
    const api = (window as any).platformAPI
    const unsub = api?.onConnected(() => loadPlatformStatuses())
    return () => unsub?.()
  }, [mode, loadPlatformStatuses])

  function back(): void {
    setMode('choose')
    setError('')
    setTeamCodeOut('')
    setPendingUrl('')
    setPendingKey('')
  }

  async function handleJoin(): Promise<void> {
    setError('')
    try {
      const decoded = JSON.parse(atob(teamCode.trim())) as { url?: string; anonKey?: string }
      if (!decoded.url || !decoded.anonKey) throw new Error('bad code')
      setSaving(true)
      setPendingUrl(decoded.url)
      setPendingKey(decoded.anonKey)
      setSaving(false)
      setMode('platforms')
    } catch {
      setError('Invalid organization code. Ask your admin for the code from the Setup screen.')
      setSaving(false)
    }
  }

  async function handleNew(): Promise<void> {
    setError('')
    if (!url.startsWith('https://') || !anonKey) {
      setError('Enter a valid Supabase project URL (starting with https://) and anon key.')
      return
    }
    setSaving(true)
    try {
      const code = btoa(JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() }))
      setTeamCodeOut(code)
      setPendingUrl(url.trim())
      setPendingKey(anonKey.trim())
      setSaving(false)
      setMode('platforms')
    } catch {
      setError('Could not connect. Check the URL and anon key, then try again.')
      setSaving(false)
    }
  }

  async function handleEnterApp(): Promise<void> {
    await onComplete(pendingUrl, pendingKey)
  }

  async function copyCode(): Promise<void> {
    await navigator.clipboard.writeText(teamCodeOut)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isElectron = !!(window as any).platformAPI

  return (
    <div className={mode === 'platforms' ? styles.rootWide : styles.root}>
      <motion.div
        className={mode === 'platforms' ? styles.cardWide : styles.card}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        layout
      >
        <div className={styles.logo}>
          <LogoMark size={28} aria-hidden="true" />
          <span className={styles.logoText}>The Network</span>
        </div>

        {mode === 'choose' && (
          <>
            <h2 className={styles.heading}>Welcome to The Network</h2>
            <p className={styles.body}>Does your organization already use The Network?</p>
            <button className={styles.primaryBtn} onClick={() => setMode('join')}>
              Yes — connect to my organization
            </button>
            <button className={styles.ghostBtn} onClick={() => setMode('new')}>
              No — set up a new organization
            </button>
          </>
        )}

        {mode === 'join' && (
          <>
            <h2 className={styles.heading}>Connect to your organization</h2>
            <p className={styles.body}>
              Enter the organization code your admin shared with you.
            </p>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="team-code">Organization code</label>
              <textarea
                id="team-code"
                className={styles.textarea}
                placeholder="Paste code here…"
                value={teamCode}
                onChange={e => setTeamCode(e.target.value)}
                rows={3}
                autoFocus
              />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button className={styles.ghostBtn} onClick={back}>Back</button>
              <button
                className={styles.primaryBtn}
                style={{ flex: 2 }}
                disabled={saving || !teamCode.trim()}
                onClick={() => void handleJoin()}
              >
                {saving ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          </>
        )}

        {mode === 'new' && (
          <>
            <h2 className={styles.heading}>New organization setup</h2>
            <p className={styles.body}>
              Enter your Supabase project details. Find these at{' '}
              <strong>supabase.com → Project Settings → API</strong>.
            </p>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="sb-url">Project URL</label>
              <input
                id="sb-url"
                className={styles.input}
                placeholder="https://xxxx.supabase.co"
                value={url}
                onChange={e => setUrl(e.target.value)}
                autoFocus
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="sb-key">Anon public key</label>
              <input
                id="sb-key"
                className={styles.input}
                placeholder="eyJhbGci…"
                value={anonKey}
                onChange={e => setAnonKey(e.target.value)}
              />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <p className={styles.note}>
              Run the migrations from <strong>supabase/migrations/</strong> before connecting.
              After setup, copy the generated team code to share with your team.
            </p>
            <div className={styles.actions}>
              <button className={styles.ghostBtn} onClick={back}>Back</button>
              <button
                className={styles.primaryBtn}
                style={{ flex: 2 }}
                disabled={saving || !url || !anonKey}
                onClick={() => void handleNew()}
              >
                {saving ? 'Connecting…' : 'Connect & continue'}
              </button>
            </div>
          </>
        )}

        {mode === 'platforms' && (
          <>
            {/* Team code banner for new org */}
            {teamCodeOut && (
              <div className={styles.teamCodeBanner}>
                <p className={styles.teamCodeLabel}>
                  Share this code with your team — they paste it on first launch to connect instantly.
                </p>
                <div className={styles.codeBox}>
                  <span className={styles.codeText}>{teamCodeOut}</span>
                </div>
                <button className={styles.copyBtn} onClick={() => void copyCode()}>
                  {copied ? '✓ Copied' : 'Copy team code'}
                </button>
              </div>
            )}

            <h2 className={styles.heading}>Connect your platforms</h2>
            <p className={styles.body}>
              Connect your publishing accounts so The Network can sync videos, clips, and analytics.
              You can always update these later in Settings → Connected Platforms.
            </p>

            {!isElectron ? (
              <p className={styles.note}>
                Platform connections are configured in the desktop app. Continue to the app to connect.
              </p>
            ) : (
              <div className={styles.platformsGrid}>
                {PLATFORMS.map(p => (
                  <PlatformWizardRow
                    key={p.id}
                    platform={p}
                    status={platformStatuses?.[p.id] ?? null}
                    onRefresh={loadPlatformStatuses}
                  />
                ))}
              </div>
            )}

            <div className={styles.actions} style={{ marginTop: 8 }}>
              <button
                className={styles.ghostBtn}
                onClick={() => void handleEnterApp()}
              >
                Skip for now
              </button>
              <button
                className={styles.primaryBtn}
                style={{ flex: 2 }}
                onClick={() => void handleEnterApp()}
              >
                Enter app
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}
