import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase, useAuth } from '@network/core'
import styles from './RecordMarkerScreen.module.css'

interface Show {
  id: string
  title: string
}

interface Video {
  id: string
  title: string
  show_id: string
}

interface Marker {
  id: string
  video_id: string
  marker_type: string
  timestamp_ms: number
  note: string | null
  created_at: string
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function RecordMarkerScreen(): JSX.Element {
  const { user } = useAuth()
  const [recording, setRecording] = useState(false)
  const [shows, setShows] = useState<Show[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [selectedShowId, setSelectedShowId] = useState('')
  const [selectedVideoId, setSelectedVideoId] = useState('')
  const [note, setNote] = useState('')
  const [dropping, setDropping] = useState(false)
  const [recentMarkers, setRecentMarkers] = useState<Marker[]>([])
  const [sessionStart] = useState(Date.now())

  useEffect(() => {
    if (!user) return

    supabase
      .from('shows')
      .select('id, title')
      .order('title', { ascending: true })
      .then(({ data }) => setShows((data as Show[] | null) ?? []))
  }, [user])

  useEffect(() => {
    if (!selectedShowId) {
      setVideos([])
      setSelectedVideoId('')
      return
    }

    supabase
      .from('videos')
      .select('id, title, show_id')
      .eq('show_id', selectedShowId)
      .order('title', { ascending: true })
      .then(({ data }) => {
        const vids = (data as Video[] | null) ?? []
        setVideos(vids)
        setSelectedVideoId(vids[0]?.id ?? '')
      })
  }, [selectedShowId])

  async function handleDropMarker(): Promise<void> {
    if (!selectedVideoId || dropping) return

    const timestamp_ms = Date.now()
    setDropping(true)

    const { data, error } = await supabase
      .from('markers')
      .insert({
        video_id: selectedVideoId,
        marker_type: 'cut',
        timestamp_ms,
        note: note.trim() || null,
      })
      .select('id, video_id, marker_type, timestamp_ms, note, created_at')
      .single()

    if (!error && data) {
      setRecentMarkers(prev => [data as Marker, ...prev.slice(0, 9)])
      setNote('')
    }

    setDropping(false)
  }

  const elapsedMs = recording ? Date.now() - sessionStart : 0

  return (
    <div className={styles.screen}>
      {/* Recording indicator */}
      <div className={styles.recRow}>
        <span className={`${styles.recDot} ${recording ? styles.recDotActive : ''}`} aria-hidden="true" />
        <span className={`${styles.recLabel} ${recording ? styles.recLabelActive : ''}`}>
          {recording ? 'RECORDING' : 'STANDBY'}
        </span>
        {recording && (
          <span className={styles.recTimer}>
            {formatTimestamp(elapsedMs)}
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!recording ? (
          <motion.div
            key="start"
            className={styles.startWrap}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
          >
            <p className={styles.startHint}>Set up your show and video, then start the session.</p>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="show-select">Show</label>
              <select
                id="show-select"
                className={styles.select}
                value={selectedShowId}
                onChange={e => setSelectedShowId(e.target.value)}
              >
                <option value="">Select a show…</option>
                {shows.map(show => (
                  <option key={show.id} value={show.id}>{show.title}</option>
                ))}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="video-select">Video</label>
              <select
                id="video-select"
                className={styles.select}
                value={selectedVideoId}
                onChange={e => setSelectedVideoId(e.target.value)}
                disabled={videos.length === 0}
              >
                <option value="">
                  {selectedShowId ? (videos.length === 0 ? 'No videos found' : 'Select a video…') : 'Select a show first'}
                </option>
                {videos.map(video => (
                  <option key={video.id} value={video.id}>{video.title}</option>
                ))}
              </select>
            </div>

            <button
              className={styles.startBtn}
              onClick={() => setRecording(true)}
              disabled={!selectedVideoId}
            >
              Start Session
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="session"
            className={styles.sessionWrap}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
          >
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="note-input">Note (optional)</label>
              <input
                id="note-input"
                className={styles.noteInput}
                type="text"
                placeholder="e.g. Great take, cut here"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>

            <button
              className={styles.dropBtn}
              onClick={() => void handleDropMarker()}
              disabled={dropping || !selectedVideoId}
            >
              {dropping ? 'Dropping…' : 'Drop Marker'}
            </button>

            <button
              className={styles.stopBtn}
              onClick={() => setRecording(false)}
            >
              End Session
            </button>

            {/* Recent markers */}
            {recentMarkers.length > 0 && (
              <div className={styles.markerList}>
                <h2 className={styles.markerListTitle}>Recent Markers</h2>
                <ul className={styles.markerItems} role="list">
                  {recentMarkers.map(marker => (
                    <li key={marker.id} className={styles.markerItem}>
                      <span className={styles.markerTime}>
                        {formatTime(marker.timestamp_ms)}
                      </span>
                      <span className={styles.markerType}>{marker.marker_type}</span>
                      {marker.note && (
                        <span className={styles.markerNote}>{marker.note}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
