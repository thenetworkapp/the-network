import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import styles from './ConnectionsScreen.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlatformAccount {
  id: string
  accountName: string
}

interface PlatformStatus {
  configured: boolean
  credentialsBundled: boolean
  accounts: PlatformAccount[]
  feeds: string[]
}

type PlatformId = 'youtube' | 'instagram' | 'tiktok' | 'spotify' | 'apple_podcasts' | 'rss'

interface PlatformDef {
  id: PlatformId
  name: string
  description: string
  usesOAuth: boolean
  color: string
  icon: JSX.Element
}

// ── Platform definitions ──────────────────────────────────────────────────────

const PLATFORMS: PlatformDef[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Sync channel videos, views, watch time, and analytics.',
    usesOAuth: true,
    color: '#FF0000',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z" />
      </svg>
    ),
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Sync Reels, posts, and engagement metrics.',
    usesOAuth: true,
    color: '#E1306C',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    description: 'Sync short-form videos and performance data.',
    usesOAuth: true,
    color: '#010101',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.73z" />
      </svg>
    ),
  },
  {
    id: 'spotify',
    name: 'Spotify',
    description: 'Sync podcast episodes, streams, and listener data.',
    usesOAuth: true,
    color: '#1DB954',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
      </svg>
    ),
  },
  {
    id: 'apple_podcasts',
    name: 'Apple Podcasts',
    description: 'Import your podcast via RSS feed for episode sync.',
    usesOAuth: false,
    color: '#872EC4',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M5.34 0A5.328 5.328 0 0 0 0 5.34v13.32A5.328 5.328 0 0 0 5.34 24h13.32A5.328 5.328 0 0 0 24 18.66V5.34A5.328 5.328 0 0 0 18.66 0zm6.525 2.568c2.337 0 4.443.934 6.015 2.421A8.39 8.39 0 0 1 20.394 11a8.39 8.39 0 0 1-2.754 6.226 8.301 8.301 0 0 1-4.032 2.053c-.105.022-.154-.037-.154-.096v-1.244c0-.068.049-.128.128-.141a6.88 6.88 0 0 0 3.29-1.712A6.858 6.858 0 0 0 18.93 11a6.858 6.858 0 0 0-2.053-4.886 6.858 6.858 0 0 0-4.886-2.053 6.858 6.858 0 0 0-4.886 2.053A6.858 6.858 0 0 0 5.052 11a6.858 6.858 0 0 0 2.053 4.886 6.88 6.88 0 0 0 3.29 1.712c.079.013.128.073.128.141v1.244c0 .059-.049.118-.154.096a8.301 8.301 0 0 1-4.032-2.053A8.39 8.39 0 0 1 3.583 11a8.39 8.39 0 0 1 2.52-6.011 8.407 8.407 0 0 1 5.762-2.421zm.059 2.735c1.382 0 2.633.558 3.542 1.467a4.998 4.998 0 0 1 1.467 3.542 4.998 4.998 0 0 1-1.467 3.542 4.998 4.998 0 0 1-3.542 1.467 4.998 4.998 0 0 1-3.542-1.467A4.998 4.998 0 0 1 6.975 10.9a4.998 4.998 0 0 1 1.467-3.542 4.998 4.998 0 0 1 3.542-1.467zm0 2.238c-.831 0-1.581.337-2.126.882A2.996 2.996 0 0 0 8.956 10.9c0 .831.337 1.581.882 2.126a2.996 2.996 0 0 0 2.126.882 2.996 2.996 0 0 0 2.126-.882 2.996 2.996 0 0 0 .882-2.126 2.996 2.996 0 0 0-.882-2.126 2.996 2.996 0 0 0-2.126-.882zm0 1.59c.39 0 .743.16 1.001.417.258.258.417.611.417 1.001s-.16.743-.417 1.001a1.415 1.415 0 0 1-1.001.417 1.415 1.415 0 0 1-1.001-.417A1.415 1.415 0 0 1 10.48 10.9c0-.39.16-.743.417-1.001.258-.258.611-.417 1.001-.417z" />
      </svg>
    ),
  },
  {
    id: 'rss',
    name: 'RSS Feed',
    description: 'Import content from any RSS feed URL.',
    usesOAuth: false,
    color: '#F26522',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19.01 7.38 20 6.18 20C4.98 20 4 19.01 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z" />
      </svg>
    ),
  },
]

// ── Credential form ───────────────────────────────────────────────────────────

function CredentialForm({
  platform,
  onSaved,
  onCancel,
}: {
  platform: PlatformDef
  onSaved: () => void
  onCancel: () => void
}): JSX.Element {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.platformAPI?.getCredentials(platform.id).then(c => {
      if (c.clientId) setClientId(c.clientId)
    }).catch(() => undefined)
  }, [platform.id])

  async function handleSave(): Promise<void> {
    if (!clientId.trim() || !clientSecret.trim()) return
    setSaving(true)
    await window.platformAPI?.setCredentials(platform.id, { clientId: clientId.trim(), clientSecret: clientSecret.trim() })
    setSaving(false)
    onSaved()
  }

  return (
    <motion.div
      className={styles.credForm}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
    >
      <p className={styles.credFormDesc}>
        Create an app in the <strong>{platform.name}</strong> developer console, then paste your OAuth credentials here.
        The redirect URI to register is: <code className={styles.code}>http://localhost:54321/oauth/{platform.id}</code>
      </p>
      <div className={styles.credRow}>
        <div className={styles.credField}>
          <label className={styles.credLabel}>Client ID</label>
          <input
            className={styles.credInput}
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            placeholder="Client ID"
            spellCheck={false}
          />
        </div>
        <div className={styles.credField}>
          <label className={styles.credLabel}>Client Secret</label>
          <input
            className={styles.credInput}
            type="password"
            value={clientSecret}
            onChange={e => setClientSecret(e.target.value)}
            placeholder="Client Secret"
          />
        </div>
      </div>
      <div className={styles.credActions}>
        <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
        <button
          className={styles.saveBtn}
          disabled={saving || !clientId.trim() || !clientSecret.trim()}
          onClick={() => void handleSave()}
        >
          {saving ? 'Saving…' : 'Save credentials'}
        </button>
      </div>
    </motion.div>
  )
}

// ── Feed URL form ─────────────────────────────────────────────────────────────

function FeedForm({
  platform,
  feeds,
  onUpdate,
}: {
  platform: PlatformDef
  feeds: string[]
  onUpdate: (feeds: string[]) => void
}): JSX.Element {
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd(): Promise<void> {
    if (!url.trim().startsWith('http')) return
    setAdding(true)
    const result = await window.platformAPI?.addFeed(platform.id, url.trim())
    if (result?.feeds) onUpdate(result.feeds)
    setUrl('')
    setAdding(false)
  }

  async function handleRemove(feedUrl: string): Promise<void> {
    const result = await window.platformAPI?.removeFeed(platform.id, feedUrl)
    if (result?.feeds) onUpdate(result.feeds)
  }

  return (
    <div className={styles.feedForm}>
      <div className={styles.feedAddRow}>
        <input
          className={styles.feedInput}
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://feeds.example.com/podcast.xml"
          onKeyDown={e => { if (e.key === 'Enter') void handleAdd() }}
          spellCheck={false}
        />
        <button
          className={styles.feedAddBtn}
          disabled={adding || !url.trim().startsWith('http')}
          onClick={() => void handleAdd()}
        >
          Add feed
        </button>
      </div>
      {feeds.length > 0 && (
        <ul className={styles.feedList}>
          {feeds.map(f => (
            <li key={f} className={styles.feedItem}>
              <span className={styles.feedUrl}>{f}</span>
              <button className={styles.feedRemove} onClick={() => void handleRemove(f)} aria-label="Remove">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 2l8 8M10 2L2 10" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Platform card ─────────────────────────────────────────────────────────────

function PlatformCard({
  platform,
  status,
  onStatusChange,
}: {
  platform: PlatformDef
  status: PlatformStatus | null
  onStatusChange: () => void
}): JSX.Element {
  const [showCreds, setShowCreds] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accounts = status?.accounts ?? []
  const isConfigured = status?.configured ?? false
  const isBundled = status?.credentialsBundled ?? false

  async function handleConnect(): Promise<void> {
    setError(null)
    setConnecting(true)
    const result = await window.platformAPI?.connect(platform.id)
    setConnecting(false)
    if (result && !result.ok) {
      setError(result.error ?? 'Failed to initiate connection')
    }
  }

  async function handleDisconnectAccount(accountId: string): Promise<void> {
    await window.platformAPI?.disconnectAccount(platform.id, accountId)
    onStatusChange()
  }

  return (
    <motion.div
      className={`${styles.card} ${accounts.length > 0 ? styles.cardConnected : ''}`}
      layout
      transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
    >
      <div className={styles.cardHead}>
        <div className={styles.platformIcon} style={{ background: `${platform.color}18`, color: platform.color }}>
          {platform.icon}
        </div>
        <div className={styles.cardInfo}>
          <div className={styles.platformName}>{platform.name}</div>
          <div className={styles.platformDesc}>{platform.description}</div>
        </div>
        <div className={styles.statusBadge}>
          {accounts.length > 0 ? (
            <span className={styles.badgeConnected}>{accounts.length} connected</span>
          ) : (
            <span className={styles.badgeDisconnected}>Not connected</span>
          )}
        </div>
      </div>

      {/* Connected accounts list */}
      {accounts.length > 0 && platform.usesOAuth && (
        <div className={styles.accountsList}>
          {accounts.map(acc => (
            <div key={acc.id} className={styles.accountItem}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="var(--color-ok)" strokeWidth="1.5" strokeLinecap="round"><circle cx="6.5" cy="6.5" r="5.5" /><path d="M4.5 6.5l1.5 1.5 3-3" /></svg>
              <span className={styles.accountItemName}>{acc.accountName || 'Connected account'}</span>
              <button className={styles.accountDisconnectBtn} onClick={() => void handleDisconnectAccount(acc.id)}>
                Disconnect
              </button>
            </div>
          ))}
        </div>
      )}

      {/* OAuth platforms */}
      {platform.usesOAuth && (
        <>
          <AnimatePresence>
            {showCreds && !isBundled && (
              <CredentialForm
                platform={platform}
                onSaved={() => { setShowCreds(false); onStatusChange() }}
                onCancel={() => setShowCreds(false)}
              />
            )}
          </AnimatePresence>

          {error && <p className={styles.connectError}>{error}</p>}

          {isConfigured ? (
            <div className={styles.cardActionsMulti}>
              <button
                className={styles.addAccountBtn}
                disabled={connecting}
                onClick={() => void handleConnect()}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 1v10M1 6h10"/></svg>
                {connecting ? 'Opening browser…' : accounts.length > 0 ? 'Connect another account' : 'Connect account'}
              </button>
              {!isBundled && (
                <button className={styles.credBtnSmall} onClick={() => setShowCreds(v => !v)}>
                  Update credentials
                </button>
              )}
            </div>
          ) : (
            <div className={styles.cardActions}>
              <button
                className={styles.credBtn}
                onClick={() => setShowCreds(v => !v)}
              >
                Set up credentials
              </button>
              <button className={styles.connectBtn} disabled>
                Connect
              </button>
            </div>
          )}
        </>
      )}

      {/* RSS / Apple Podcasts — URL-based */}
      {!platform.usesOAuth && (
        <FeedForm
          platform={platform}
          feeds={status?.feeds ?? []}
          onUpdate={onStatusChange}
        />
      )}
    </motion.div>
  )
}

// ── Screen ─────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    platformAPI?: {
      getStatus: () => Promise<Record<string, PlatformStatus>>
      setCredentials: (platform: string, creds: { clientId: string; clientSecret: string }) => Promise<void>
      getCredentials: (platform: string) => Promise<{ clientId: string; hasSecret: boolean }>
      connect: (platform: string) => Promise<{ ok: boolean; error?: string }>
      disconnectAccount: (platform: string, accountId: string) => Promise<void>
      addFeed: (platform: string, url: string) => Promise<{ ok: boolean; feeds: string[] }>
      removeFeed: (platform: string, url: string) => Promise<{ feeds: string[] }>
      onConnected: (cb: (info: { platform: string; accountId: string; accountName: string }) => void) => () => void
    }
  }
}

export function ConnectionsScreen(): JSX.Element {
  const [statuses, setStatuses] = useState<Record<string, PlatformStatus> | null>(null)

  const loadStatuses = useCallback(async () => {
    const s = await window.platformAPI?.getStatus()
    if (s) setStatuses(s)
  }, [])

  useEffect(() => {
    void loadStatuses()
    // Refresh when OAuth callback completes
    const unsub = window.platformAPI?.onConnected(() => { void loadStatuses() })
    return () => unsub?.()
  }, [loadStatuses])

  const isElectron = !!window.platformAPI

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div>
          <p className={styles.headerDesc}>
            Connect your publishing platforms so The Network can sync videos, clips, and analytics automatically.
          </p>
        </div>
      </div>

      {!isElectron && (
        <div className={styles.notSupported}>
          Platform connections are only available in the desktop app.
        </div>
      )}

      {isElectron && (
        <>
          <div className={styles.sectionLabel}>Video &amp; social</div>
          <div className={styles.grid}>
            {PLATFORMS.filter(p => ['youtube', 'instagram', 'tiktok'].includes(p.id)).map(p => (
              <PlatformCard
                key={p.id}
                platform={p}
                status={statuses?.[p.id] ?? null}
                onStatusChange={() => void loadStatuses()}
              />
            ))}
          </div>

          <div className={styles.sectionLabel}>Audio &amp; podcasts</div>
          <div className={styles.grid}>
            {PLATFORMS.filter(p => ['spotify', 'apple_podcasts', 'rss'].includes(p.id)).map(p => (
              <PlatformCard
                key={p.id}
                platform={p}
                status={statuses?.[p.id] ?? null}
                onStatusChange={() => void loadStatuses()}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
