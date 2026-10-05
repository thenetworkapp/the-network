import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase, useAuth } from '@network/core'
import styles from './PhoneMessagesScreen.module.css'

interface Message {
  body: string
  created_at: string
}

interface Thread {
  id: string
  title: string
  messages: Message[]
}

interface RealtimeMessage {
  id: string
  thread_id: string
  body: string
  sender_id: string
  created_at: string
}

export function useUnreadCount(): number {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!user) return

    supabase
      .from('threads')
      .select('id', { count: 'exact', head: true })
      .then(({ count: c }) => setCount(c ?? 0))
  }, [user])

  return count
}

function formatMessageTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()

  if (isToday) {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

interface ThreadDetailProps {
  thread: Thread
  onBack: () => void
}

function ThreadDetail({ thread, onBack }: ThreadDetailProps): JSX.Element {
  const { user } = useAuth()
  const [messages, setMessages] = useState<RealtimeMessage[]>([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase
      .from('messages')
      .select('id, thread_id, body, sender_id, created_at')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setMessages((data as RealtimeMessage[] | null) ?? [])
      })

    const channel = supabase
      .channel(`thread:${thread.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${thread.id}`,
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as RealtimeMessage])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [thread.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(): Promise<void> {
    if (!body.trim() || !user) return
    setSending(true)
    await supabase.from('messages').insert({
      thread_id: thread.id,
      body: body.trim(),
      sender_id: user.id,
    })
    setBody('')
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className={styles.threadDetail}>
      <div className={styles.detailHeader}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Back to threads">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className={styles.detailTitle}>{thread.title}</span>
      </div>

      <div className={styles.messageFeed}>
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`${styles.bubble} ${msg.sender_id === user?.id ? styles.bubbleSelf : styles.bubbleOther}`}
          >
            <p className={styles.bubbleBody}>{msg.body}</p>
            <time className={styles.bubbleTime} dateTime={msg.created_at}>
              {formatMessageTime(msg.created_at)}
            </time>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputBar}>
        <textarea
          className={styles.messageInput}
          placeholder="Message…"
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={sending}
        />
        <button
          className={styles.sendBtn}
          onClick={() => void handleSend()}
          disabled={sending || !body.trim()}
          aria-label="Send message"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M2 9l13-6-5 6 5 6L2 9z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export function PhoneMessagesScreen(): JSX.Element {
  const { user } = useAuth()
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [activeThread, setActiveThread] = useState<Thread | null>(null)

  useEffect(() => {
    if (!user) return

    supabase
      .from('threads')
      .select('id, title, messages(body, created_at)')
      .order('created_at', { referencedTable: 'messages', ascending: false })
      .then(({ data }) => {
        setThreads((data as Thread[] | null) ?? [])
        setLoading(false)
      })
  }, [user])

  return (
    <div className={styles.screen}>
      <AnimatePresence mode="wait">
        {activeThread ? (
          <motion.div
            key="detail"
            className={styles.pane}
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
          >
            <ThreadDetail thread={activeThread} onBack={() => setActiveThread(null)} />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            className={styles.pane}
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
          >
            <div className={styles.listHeader}>
              <h1 className={styles.heading}>Messages</h1>
            </div>

            {loading ? (
              <div className={styles.skeletonList}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className={styles.skeleton} />
                ))}
              </div>
            ) : threads.length === 0 ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>No message threads yet.</p>
              </div>
            ) : (
              <ul className={styles.threadList} role="list">
                {threads.map(thread => {
                  const lastMsg = thread.messages[0]
                  return (
                    <li key={thread.id}>
                      <button
                        className={styles.threadItem}
                        onClick={() => setActiveThread(thread)}
                      >
                        <div className={styles.threadAvatarWrap}>
                          <span className={styles.threadAvatar}>
                            {thread.title.slice(0, 1).toUpperCase()}
                          </span>
                        </div>
                        <div className={styles.threadContent}>
                          <div className={styles.threadRow}>
                            <span className={styles.threadTitle}>{thread.title}</span>
                            {lastMsg && (
                              <time className={styles.threadTime} dateTime={lastMsg.created_at}>
                                {formatMessageTime(lastMsg.created_at)}
                              </time>
                            )}
                          </div>
                          {lastMsg && (
                            <p className={styles.threadPreview}>{lastMsg.body}</p>
                          )}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
