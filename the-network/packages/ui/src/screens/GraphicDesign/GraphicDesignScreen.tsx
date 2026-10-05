import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase, useAuth } from '@network/core'
import type { AssetKind } from '@network/core'
import styles from './GraphicDesignScreen.module.css'

// ---- Constants ----

const SPRING = { type: 'spring' as const, bounce: 0, duration: 0.35 }

const ALL_KINDS: AssetKind[] = ['template', 'image', 'sting', 'music', 'thumbnail', 'channel']

const KIND_LABELS: Record<AssetKind, string> = {
  template:  'Template',
  image:     'Image',
  sting:     'Sting',
  music:     'Music',
  thumbnail: 'Thumbnail',
  channel:   'Channel',
}

// ---- Types ----

interface ShowRow {
  id: string
  name: string
}

interface BrandKitRow {
  id: string
  show_id: string
  colours: Record<string, string>
  fonts: Record<string, string>
  logo_asset_id: string | null
  shows: ShowRow | null
}

interface AssetRow {
  id: string
  show_id: string | null
  kind: AssetKind
  name: string
  storage_key: string
  version: number
  created_by: string
  created_at: string
  shows: ShowRow | null
  profiles: { full_name: string } | null
}

// ---- Helpers ----

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function initialsFrom(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join('')
}

// ---- Brand Kit Edit Modal ----

interface BrandKitEditModalProps {
  kit: BrandKitRow
  onClose: () => void
  onSaved: () => void
}

function BrandKitEditModal({ kit, onClose, onSaved }: BrandKitEditModalProps): JSX.Element {
  const [colours, setColours] = useState<Record<string, string>>({ ...kit.colours })
  const [fonts, setFonts] = useState<Record<string, string>>({ ...kit.fonts })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateColour(key: string, value: string): void {
    setColours(prev => ({ ...prev, [key]: value }))
  }

  function updateColourKey(oldKey: string, newKey: string): void {
    setColours(prev => {
      const next: Record<string, string> = {}
      for (const [k, v] of Object.entries(prev)) {
        next[k === oldKey ? newKey : k] = v
      }
      return next
    })
  }

  function removeColour(key: string): void {
    setColours(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function addColour(): void {
    let n = 1
    while (`colour${n}` in colours) n++
    setColours(prev => ({ ...prev, [`colour${n}`]: '#000000' }))
  }

  function updateFont(key: string, value: string): void {
    setFonts(prev => ({ ...prev, [key]: value }))
  }

  function updateFontKey(oldKey: string, newKey: string): void {
    setFonts(prev => {
      const next: Record<string, string> = {}
      for (const [k, v] of Object.entries(prev)) {
        next[k === oldKey ? newKey : k] = v
      }
      return next
    })
  }

  function removeFont(key: string): void {
    setFonts(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function addFont(): void {
    let n = 1
    while (`font${n}` in fonts) n++
    setFonts(prev => ({ ...prev, [`font${n}`]: '' }))
  }

  async function handleSave(): Promise<void> {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('brand_kits')
      .update({ colours, fonts })
      .eq('id', kit.id)
    if (err) {
      setError(err.message)
      setSaving(false)
    } else {
      onSaved()
    }
  }

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={SPRING}
      >
        <h2 className={styles.modalTitle}>
          {kit.shows?.name ?? 'Brand Kit'}
        </h2>

        {/* Colours */}
        <section>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Colours</span>
            <button className={styles.addRowBtn} onClick={addColour}>+ Add colour</button>
          </div>
          <div className={styles.editorList}>
            {Object.entries(colours).map(([key, value]) => (
              <div key={key} className={styles.editorRow}>
                <input
                  className={`${styles.input} ${styles.inputNarrow}`}
                  value={key}
                  onChange={e => updateColourKey(key, e.target.value)}
                  placeholder="name"
                />
                <div
                  className={styles.colourDot}
                  style={{ background: value }}
                  title={value}
                />
                <input
                  className={`${styles.input} ${styles.inputMono}`}
                  value={value}
                  onChange={e => updateColour(key, e.target.value)}
                  placeholder="#000000"
                  maxLength={9}
                />
                <button
                  className={styles.removeBtn}
                  onClick={() => removeColour(key)}
                  aria-label={`Remove colour ${key}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Fonts */}
        <section>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Fonts</span>
            <button className={styles.addRowBtn} onClick={addFont}>+ Add font</button>
          </div>
          <div className={styles.editorList}>
            {Object.entries(fonts).map(([key, value]) => (
              <div key={key} className={styles.editorRow}>
                <input
                  className={`${styles.input} ${styles.inputNarrow}`}
                  value={key}
                  onChange={e => updateFontKey(key, e.target.value)}
                  placeholder="role"
                />
                <input
                  className={`${styles.input} ${styles.inputFlex}`}
                  value={value}
                  onChange={e => updateFont(key, e.target.value)}
                  placeholder="Font name"
                />
                <button
                  className={styles.removeBtn}
                  onClick={() => removeFont(key)}
                  aria-label={`Remove font ${key}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>

        {error && <p className={styles.errorMsg}>{error}</p>}

        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ---- Brand Kits Tab ----

interface BrandKitsTabProps {
  kits: BrandKitRow[]
  shows: ShowRow[]
  onRefresh: () => void
}

function BrandKitsTab({ kits, shows, onRefresh }: BrandKitsTabProps): JSX.Element {
  const [editingKit, setEditingKit] = useState<BrandKitRow | null>(null)

  // Shows that already have a brand kit
  const coveredShowIds = new Set(kits.map(k => k.show_id))
  // Shows without a brand kit
  const uncoveredShows = shows.filter(s => !coveredShowIds.has(s.id))

  async function createBrandKit(show: ShowRow): Promise<void> {
    await supabase.from('brand_kits').insert({
      show_id: show.id,
      colours: {},
      fonts: {},
      logo_asset_id: null,
    })
    onRefresh()
  }

  return (
    <>
      <div className={styles.cardGrid}>
        {kits.map(kit => (
          <div key={kit.id} className={styles.brandCard}>
            <div className={styles.brandCardHeader}>
              <span className={styles.brandName}>{kit.shows?.name ?? '—'}</span>
              <button className={styles.editBtn} onClick={() => setEditingKit(kit)}>Edit</button>
            </div>

            {/* Colour swatches */}
            {Object.keys(kit.colours).length > 0 && (
              <div className={styles.swatchRow}>
                {Object.entries(kit.colours).slice(0, 6).map(([name, hex]) => (
                  <div
                    key={name}
                    className={styles.swatch}
                    style={{ background: hex }}
                    title={`${name}: ${hex}`}
                  />
                ))}
              </div>
            )}

            {/* Font list */}
            {Object.values(kit.fonts).length > 0 && (
              <div className={styles.fontList}>
                {Object.values(kit.fonts).map((fontName, i) => (
                  <span key={i} className={styles.fontTag}>{fontName}</span>
                ))}
              </div>
            )}

            {Object.keys(kit.colours).length === 0 && Object.keys(kit.fonts).length === 0 && (
              <p className={styles.emptyHint}>No colours or fonts set — click Edit to add some.</p>
            )}
          </div>
        ))}

        {/* Create cards for shows without brand kits */}
        {uncoveredShows.map(show => (
          <button
            key={show.id}
            className={styles.createKitCard}
            onClick={() => createBrandKit(show)}
          >
            <div className={styles.createKitIcon}>+</div>
            <span className={styles.createKitLabel}>Create brand kit</span>
            <span className={styles.createKitShow}>{show.name}</span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {editingKit && (
          <BrandKitEditModal
            kit={editingKit}
            onClose={() => setEditingKit(null)}
            onSaved={() => {
              setEditingKit(null)
              onRefresh()
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ---- Upload Asset Modal ----

interface UploadAssetModalProps {
  shows: ShowRow[]
  userId: string
  onClose: () => void
  onSaved: () => void
}

function UploadAssetModal({ shows, userId, onClose, onSaved }: UploadAssetModalProps): JSX.Element {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<AssetKind>('image')
  const [showId, setShowId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const picked = e.target.files?.[0] ?? null
    setFile(picked)
    if (picked && !name) setName(picked.name.replace(/\.[^.]+$/, ''))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (!name.trim() || !file) return
    setSaving(true)
    setError(null)

    const ext = file.name.split('.').pop() ?? 'bin'
    const storageKey = `${userId}/${crypto.randomUUID()}.${ext}`

    setProgress('Uploading file…')
    const { error: uploadErr } = await supabase.storage
      .from('assets')
      .upload(storageKey, file, { contentType: file.type, upsert: false })

    if (uploadErr) {
      setError(uploadErr.message)
      setSaving(false)
      setProgress('')
      return
    }

    setProgress('Saving record…')
    const { error: dbErr } = await supabase.from('assets').insert({
      name: name.trim(),
      kind,
      show_id: showId || null,
      storage_key: storageKey,
      created_by: userId,
      version: 1,
      template: null,
    })

    if (dbErr) {
      // Roll back the storage upload if the DB insert fails
      await supabase.storage.from('assets').remove([storageKey])
      setError(dbErr.message)
      setSaving(false)
      setProgress('')
    } else {
      onSaved()
    }
  }

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={SPRING}
      >
        <h2 className={styles.modalTitle}>Upload Asset</h2>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* File picker */}
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="ua-file">File</label>
            <input
              id="ua-file"
              type="file"
              className={styles.fileInput}
              onChange={handleFileChange}
              accept="image/*,video/mp4,video/quicktime,audio/mpeg,audio/wav,audio/aac,application/zip,application/pdf"
            />
            {file && (
              <p className={styles.hintText}>{file.name} — {(file.size / 1024 / 1024).toFixed(1)} MB</p>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="ua-name">Name</label>
            <input
              id="ua-name"
              className={styles.input}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Asset name"
              required
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="ua-kind">Kind</label>
              <select
                id="ua-kind"
                className={styles.select}
                value={kind}
                onChange={e => setKind(e.target.value as AssetKind)}
              >
                {ALL_KINDS.map(k => (
                  <option key={k} value={k}>{KIND_LABELS[k]}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="ua-show">Show</label>
              <select
                id="ua-show"
                className={styles.select}
                value={showId}
                onChange={e => setShowId(e.target.value)}
              >
                <option value="">No show</option>
                {shows.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {progress && <p className={styles.hintText}>{progress}</p>}
          {error && <p className={styles.errorMsg}>{error}</p>}

          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={saving || !name.trim() || !file}>
              {saving ? progress || 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ---- Assets Tab ----

interface AssetsTabProps {
  assets: AssetRow[]
  shows: ShowRow[]
  userId: string
  onRefresh: () => void
}

function AssetsTab({ assets, shows, userId, onRefresh }: AssetsTabProps): JSX.Element {
  const [kindFilter, setKindFilter] = useState<AssetKind | 'all'>('all')
  const [showFilter, setShowFilter] = useState('')
  const [showUpload, setShowUpload] = useState(false)

  const filtered = assets.filter(a => {
    if (kindFilter !== 'all' && a.kind !== kindFilter) return false
    if (showFilter && a.show_id !== showFilter) return false
    return true
  })

  return (
    <>
      <div className={styles.assetsToolbar}>
        {/* Kind filter */}
        <div className={styles.kindTabs}>
          <button
            className={`${styles.kindTab} ${kindFilter === 'all' ? styles.kindTabActive : ''}`}
            onClick={() => setKindFilter('all')}
          >
            All
          </button>
          {ALL_KINDS.map(k => (
            <button
              key={k}
              className={`${styles.kindTab} ${kindFilter === k ? styles.kindTabActive : ''}`}
              onClick={() => setKindFilter(k)}
            >
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>

        <div className={styles.toolbarRight}>
          <select
            className={styles.select}
            value={showFilter}
            onChange={e => setShowFilter(e.target.value)}
          >
            <option value="">All shows</option>
            {shows.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <button className={styles.btnPrimary} onClick={() => setShowUpload(true)}>
            Upload Asset
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className={styles.emptyState}>No assets match the current filter.</p>
      ) : (
        <div className={styles.assetGrid}>
          {filtered.map(asset => {
            const initials = asset.profiles?.full_name
              ? initialsFrom(asset.profiles.full_name)
              : '?'

            return (
              <div key={asset.id} className={styles.assetCard}>
                <div className={styles.assetCardTop}>
                  <span className={styles.assetKindBadge}>{KIND_LABELS[asset.kind]}</span>
                  <span className={styles.versionBadge}>v{asset.version}</span>
                </div>

                <p className={styles.assetName}>{asset.name}</p>

                {asset.shows && (
                  <p className={styles.assetShow}>{asset.shows.name}</p>
                )}

                <div className={styles.assetCardFooter}>
                  <div className={styles.avatarCircle} title={asset.profiles?.full_name ?? ''}>
                    {initials}
                  </div>
                  <span className={styles.assetDate}>{formatDate(asset.created_at)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {showUpload && (
          <UploadAssetModal
            shows={shows}
            userId={userId}
            onClose={() => setShowUpload(false)}
            onSaved={() => {
              setShowUpload(false)
              onRefresh()
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ---- Main Screen ----

type TabId = 'brand-kits' | 'assets'

export function GraphicDesignScreen(): JSX.Element {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('brand-kits')
  const [kits, setKits] = useState<BrandKitRow[]>([])
  const [assets, setAssets] = useState<AssetRow[]>([])
  const [shows, setShows] = useState<ShowRow[]>([])
  const [loading, setLoading] = useState(true)

  async function loadData(): Promise<void> {
    setLoading(true)
    const [kitRes, assetRes, showRes] = await Promise.all([
      supabase
        .from('brand_kits')
        .select('*, shows(name)')
        .order('show_id'),
      supabase
        .from('assets')
        .select('*, shows(name), profiles!created_by(full_name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('shows')
        .select('id, name')
        .order('name'),
    ])

    if (kitRes.data) setKits(kitRes.data as unknown as BrandKitRow[])
    if (assetRes.data) setAssets(assetRes.data as unknown as AssetRow[])
    if (showRes.data) setShows(showRes.data as ShowRow[])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const tabs: { id: TabId; label: string }[] = [
    { id: 'brand-kits', label: 'Brand Kits' },
    { id: 'assets',     label: 'Assets' },
  ]

  return (
    <div className={styles.screen}>
      {/* Tab bar */}
      <div className={styles.tabBar}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <div className={styles.tabBarSpacer} />
        {loading && <div className={styles.spinner} aria-label="Loading" />}
      </div>

      {/* Tab content */}
      <div className={styles.content}>
        {activeTab === 'brand-kits' && (
          <BrandKitsTab
            kits={kits}
            shows={shows}
            onRefresh={loadData}
          />
        )}
        {activeTab === 'assets' && (
          <AssetsTab
            assets={assets}
            shows={shows}
            userId={user?.id ?? ''}
            onRefresh={loadData}
          />
        )}
      </div>
    </div>
  )
}
