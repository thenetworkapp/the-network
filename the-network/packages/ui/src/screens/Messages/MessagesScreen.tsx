import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth, supabase } from '@network/core'
import styles from './MessagesScreen.module.css'

// ---- Types ----

interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
}

interface MessageRow {
  id: string
  thread_id: string
  author_id: string
  body: string
  created_at: string
  is_system: boolean
  profiles: Profile | null
}

interface ThreadLastMessage {
  body: string | null
  created_at: string | null
  author_id: string | null
  profiles: Profile | null
}

interface ThreadRow {
  id: string
  show_id: string | null
  title: string
  thread_type: 'general' | 'video' | 'clip'
  ref_id: string | null
  created_at: string
  messages: ThreadLastMessage[]
}

// ---- Helpers ----

async function subscribeToPush(userId: string): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '',
  })
  const json = sub.toJSON()
  const k = json.keys as Record<string, string> | undefined
  await supabase.from('push_subscriptions').upsert(
    {
      person_id: userId,
      endpoint: json.endpoint,
      keys: { p256dh: k?.p256dh ?? '', auth: k?.auth ?? '' },
      platform: 'web',
    },
    { onConflict: 'endpoint' },
  )
}

function formatRelative(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const SPRING = { type: 'spring', bounce: 0, duration: 0.35 } as const

// ---- New Thread Modal ----

interface NewThreadModalProps {
  onClose: () => void
  onCreated: (thread: ThreadRow) => void
}

function NewThreadModal({ onClose, onCreated }: NewThreadModalProps): JSX.Element {
  const [title, setTitle] = useState('')
  const [threadType, setThreadType] = useState<'general' | 'video' | 'clip'>('general')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(): Promise<void> {
    const trimmed = title.trim()
    if (!trimmed) return
    setSubmitting(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('threads')
      .insert({ title: trimmed, thread_type: threadType, show_id: null })
      .select('*')
      .single()
    setSubmitting(false)
    if (err) { setError(err.message); return }
    onCreated({ ...(data as ThreadRow), messages: [] })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') { void handleSubmit() }
    if (e.key === 'Escape') { onClose() }
  }

  return (
    <motion.div
      className={styles.modalOverlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.97 }}
        transition={SPRING}
        onClick={e => e.stopPropagation()}
      >
        <h3 className={styles.modalTitle}>New thread</h3>

        <label className={styles.fieldLabel}>Title</label>
        <input
          autoFocus
          className={styles.input}
          placeholder="Thread title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={200}
        />

        <label className={styles.fieldLabel}>Type</label>
        <select
          className={styles.select}
          value={threadType}
          onChange={e => setThreadType(e.target.value as 'general' | 'video' | 'clip')}
        >
          <option value="general">General</option>
          <option value="video">Video</option>
          <option value="clip">Clip</option>
        </select>

        {error && <p className={styles.errorText}>{error}</p>}

        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button
            className={styles.btnPrimary}
            onClick={() => { void handleSubmit() }}
            disabled={!title.trim() || submitting}
          >
            {submitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ---- Thread Row ----

interface ThreadItemProps {
  thread: ThreadRow
  isActive: boolean
  onClick: () => void
}

function ThreadItem({ thread, isActive, onClick }: ThreadItemProps): JSX.Element {
  const last = thread.messages[0] ?? null
  const preview = last?.body ?? 'No messages yet'
  const timestamp = last?.created_at ? formatRelative(last.created_at) : ''
  const initials = thread.title.slice(0, 2).toUpperCase()

  return (
    <button
      className={`${styles.threadItem} ${isActive ? styles.threadItemActive : ''}`}
      onClick={onClick}
      aria-pressed={isActive}
    >
      <div className={styles.threadAvatar} aria-hidden="true">{initials}</div>
      <div className={styles.threadMeta}>
        <div className={styles.threadTop}>
          <span className={styles.threadTitle}>{thread.title}</span>
          {timestamp && <span className={styles.threadTime}>{timestamp}</span>}
        </div>
        <p className={styles.threadPreview}>{preview}</p>
      </div>
    </button>
  )
}

// ---- Message Bubble ----

interface MessageBubbleProps {
  message: MessageRow
  isMine: boolean
}

function MessageBubble({ message, isMine }: MessageBubbleProps): JSX.Element {
  const name = message.profiles?.full_name ?? 'Unknown'
  const initials = getInitials(message.profiles?.full_name ?? null)
  const time = formatRelative(message.created_at)

  if (message.is_system) {
    return (
      <motion.div
        className={styles.systemMessage}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
      >
        <span>{message.body}</span>
      </motion.div>
    )
  }

  return (
    <motion.div
      className={`${styles.messageRow} ${isMine ? styles.messageRowMine : styles.messageRowTheirs}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
    >
      {!isMine && (
        <div className={styles.avatar} aria-hidden="true">{initials}</div>
      )}
      <div className={styles.bubbleWrap}>
        {!isMine && (
          <span className={styles.senderName}>{name}</span>
        )}
        <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs}`}>
          <p className={styles.bubbleBody}>{message.body}</p>
        </div>
        <span className={styles.bubbleTime}>{time}</span>
      </div>
      {isMine && (
        <div className={styles.avatar} aria-hidden="true">{initials}</div>
      )}
    </motion.div>
  )
}

// ---- Message Feed ----

interface MessageFeedProps {
  thread: ThreadRow
  userId: string
}

function MessageFeed({ thread, userId }: MessageFeedProps): JSX.Element {
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load initial messages
  useEffect(() => {
    setMessages([])
    supabase
      .from('messages')
      .select('*, profiles(id, full_name, avatar_url)')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data as MessageRow[])
      })
  }, [thread.id])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`messages:thread:${thread.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${thread.id}`,
        },
        async (payload) => {
          // Fetch the full row with joined profile so the bubble has all fields
          const { data } = await supabase
            .from('messages')
            .select('*, profiles(id, full_name, avatar_url)')
            .eq('id', (payload.new as { id: string }).id)
            .single()
          if (data) {
            setMessages(prev => {
              // Avoid duplicates (optimistic insert may already be present)
              if (prev.some(m => m.id === (data as MessageRow).id)) return prev
              return [...prev, data as MessageRow]
            })
          }
        },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [thread.id])

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-grow textarea
  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    setBody(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 72)}px`
  }

  const handleSend = useCallback(async (): Promise<void> => {
    const trimmed = body.trim()
    if (!trimmed || sending) return
    setSending(true)
    const optimisticId = crypto.randomUUID()
    const now = new Date().toISOString()
    // Optimistic insert
    const optimistic: MessageRow = {
      id: optimisticId,
      thread_id: thread.id,
      author_id: userId,
      body: trimmed,
      created_at: now,
      is_system: false,
      profiles: null,
    }
    setMessages(prev => [...prev, optimistic])
    setBody('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    const { error } = await supabase
      .from('messages')
      .insert({ thread_id: thread.id, author_id: userId, body: trimmed })
    if (error) {
      // Roll back optimistic insert on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
      setBody(trimmed)
    }
    setSending(false)
  }, [body, sending, thread.id, userId])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className={styles.feed}>
      <div className={styles.feedHeader}>
        <span className={styles.feedTitle}>{thread.title}</span>
        <span className={styles.feedType}>{thread.thread_type}</span>
      </div>

      <div className={styles.messageList}>
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isMine={msg.author_id === userId}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputBar}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="Type a message..."
          value={body}
          onChange={handleBodyChange}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={sending}
        />
        <motion.button
          className={styles.sendBtn}
          onClick={() => { void handleSend() }}
          disabled={!body.trim() || sending}
          whileTap={{ scale: 0.93 }}
          transition={SPRING}
          aria-label="Send message"
        >
          Send
        </motion.button>
      </div>
    </div>
  )
}

// ---- Empty State ----

function EmptyState(): JSX.Element {
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyStateText}>Select a thread to view messages</p>
    </div>
  )
}

// ---- MessagesScreen ----

export function MessagesScreen(): JSX.Element {
  const { user } = useAuth()
  const [threads, setThreads] = useState<ThreadRow[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [pushSupported] = useState(
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window,
  )
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushPending, setPushPending] = useState(false)

  // Load threads
  useEffect(() => {
    supabase
      .from('threads')
      .select('*, messages(body, created_at, author_id, profiles(id, full_name, avatar_url))', { count: 'exact' })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setThreads(data as ThreadRow[])
          if (!activeThreadId && (data as ThreadRow[]).length > 0) {
            setActiveThreadId((data as ThreadRow[])[0].id)
          }
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleThreadCreated(thread: ThreadRow): void {
    setThreads(prev => [thread, ...prev])
    setActiveThreadId(thread.id)
    setShowModal(false)
  }

  async function handlePushSubscribe(): Promise<void> {
    if (!user || pushPending) return
    setPushPending(true)
    try {
      await subscribeToPush(user.id)
      setPushSubscribed(true)
    } catch {
      // Permission denied or unsupported — silently ignore
    }
    setPushPending(false)
  }

  const activeThread = threads.find(t => t.id === activeThreadId) ?? null

  return (
    <div className={styles.screen}>
      {/* Left pane: thread list */}
      <div className={styles.leftPane}>
        <div className={styles.leftHeader}>
          <h2 className={styles.leftTitle}>Messages</h2>
          <motion.button
            className={styles.newThreadBtn}
            onClick={() => setShowModal(true)}
            whileTap={{ scale: 0.92 }}
            transition={SPRING}
            aria-label="New thread"
          >
            +
          </motion.button>
        </div>

        {pushSupported && !pushSubscribed && (
          <button
            className={styles.pushBtn}
            onClick={() => { void handlePushSubscribe() }}
            disabled={pushPending}
          >
            {pushPending ? 'Enabling...' : 'Enable notifications'}
          </button>
        )}

        <div className={styles.threadList}>
          {threads.length === 0 && (
            <p className={styles.noThreads}>No threads yet</p>
          )}
          {threads.map(thread => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              isActive={thread.id === activeThreadId}
              onClick={() => setActiveThreadId(thread.id)}
            />
          ))}
        </div>
      </div>

      {/* Right pane: active thread */}
      <div className={styles.rightPane}>
        {activeThread && user ? (
          <MessageFeed
            key={activeThread.id}
            thread={activeThread}
            userId={user.id}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* New thread modal */}
      <AnimatePresence>
        {showModal && (
          <NewThreadModal
            onClose={() => setShowModal(false)}
            onCreated={handleThreadCreated}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
