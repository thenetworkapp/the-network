import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@network/core'
import styles from './FootageSettingsScreen.module.css'

interface FootageFileInfo {
  filePath: string
  size: number
  mtime: number
}

interface RecentFile extends FootageFileInfo {
  detectedAt: Date
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const footageAPI = typeof window !== 'undefined' ? (window as any).footageAPI : undefined

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function basename(filePath: string): string {
  return filePath.replace(/\\/g, '/').split('/').pop() ?? filePath
}

export function FootageSettingsScreen(): JSX.Element {
  const [rootPath, setRootPath] = useState<string>('')
  const [watching, setWatching] = useState(false)
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([])
  const [rootStatus, setRootStatus] = useState<'idle' | 'selecting'>('idle')
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('footage-root') ?? ''
    if (stored) {
      setRootPath(stored)
    } else if (footageAPI) {
      footageAPI.getRoot().then((path: string) => {
        if (path) {
          setRootPath(path)
          localStorage.setItem('footage-root', path)
        }
      })
    }
  }, [])

  const handleSelectRoot = useCallback(async () => {
    if (!footageAPI) return
    setRootStatus('selecting')
    try {
      const result = await footageAPI.selectRoot()
      if (!('cancelled' in result)) {
        setRootPath(result.path)
        localStorage.setItem('footage-root', result.path)
      }
    } finally {
      setRootStatus('idle')
    }
  }, [])

  const handleFileAdded = useCallback(async (info: FootageFileInfo) => {
    const detectedAt = new Date()
    setRecentFiles((prev) => {
      const next = [{ ...info, detectedAt }, ...prev]
      return next.slice(0, 20)
    })
    try {
      await supabase.from('device_files').upsert({
        device_id: 'desktop',
        file_path: info.filePath,
        size_bytes: info.size,
        detected_at: detectedAt.toISOString(),
      })
    } catch {
      // best-effort — silently ignore upsert failures
    }
  }, [])

  const handleWatchToggle = useCallback(async () => {
    if (!footageAPI) return
    if (watching) {
      await footageAPI.watchStop()
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
      setWatching(false)
    } else {
      const target = rootPath || localStorage.getItem('footage-root') || ''
      if (!target) return
      await footageAPI.watchStart(target)
      unsubRef.current = footageAPI.onFileAdded(handleFileAdded)
      setWatching(true)
    }
  }, [watching, rootPath, handleFileAdded])

  useEffect(() => {
    return () => {
      if (unsubRef.current) {
        unsubRef.current()
      }
    }
  }, [])

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Footage Settings</h1>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Footage Root</span>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.pathRow}>
            <span className={styles.pathDisplay}>{rootPath || <span className={styles.pathEmpty}>No root folder selected</span>}</span>
            <button
              className={styles.btn}
              onClick={handleSelectRoot}
              disabled={rootStatus === 'selecting'}
            >
              {rootStatus === 'selecting' ? 'Selecting...' : 'Change root folder'}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>File Watcher</span>
          <span className={watching ? styles.badgeLive : styles.badgeOff}>
            {watching ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.watchRow}>
            <p className={styles.watchHint}>
              {watching
                ? `Watching: ${rootPath}`
                : 'Start the watcher to detect new files added to the footage root.'}
            </p>
            <button
              className={watching ? styles.btnDestructive : styles.btn}
              onClick={handleWatchToggle}
              disabled={!rootPath && !watching}
            >
              {watching ? 'Stop file watcher' : 'Start file watcher'}
            </button>
          </div>

          {recentFiles.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Filename</th>
                    <th className={styles.th}>Size</th>
                    <th className={styles.th}>Detected</th>
                  </tr>
                </thead>
                <tbody>
                  {recentFiles.map((f, i) => (
                    <tr key={i} className={styles.tr}>
                      <td className={styles.td}>{basename(f.filePath)}</td>
                      <td className={styles.tdMono}>{formatBytes(f.size)}</td>
                      <td className={styles.tdMono}>
                        {f.detectedAt.toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {recentFiles.length === 0 && watching && (
            <p className={styles.emptyHint}>No files detected yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
