import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AuthProvider, useAuth } from '@network/core'
import styles from './PhoneShell.module.css'
import { LoginScreen } from '../../screens/Auth/LoginScreen'
import { TodayScreen } from '../../screens/Phone/TodayScreen'
import { PhoneApprovalsScreen, useApprovalCount } from '../../screens/Phone/PhoneApprovalsScreen'
import { PhoneMessagesScreen, useUnreadCount } from '../../screens/Phone/PhoneMessagesScreen'
import { RecordMarkerScreen } from '../../screens/Phone/RecordMarkerScreen'

type Tab = 'today' | 'approvals' | 'messages' | 'record'

function IconHome({ active }: { active: boolean }): JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M3 9.5L11 3l8 6.5V19a1 1 0 01-1 1H14v-5H8v5H4a1 1 0 01-1-1V9.5z"
        stroke={active ? 'var(--color-blue)' : 'var(--color-muted)'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconCheckCircle({ active }: { active: boolean }): JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle
        cx="11"
        cy="11"
        r="8.5"
        stroke={active ? 'var(--color-blue)' : 'var(--color-muted)'}
        strokeWidth="1.6"
      />
      <path
        d="M7 11l3 3 5-5"
        stroke={active ? 'var(--color-blue)' : 'var(--color-muted)'}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconChat({ active }: { active: boolean }): JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M4 4h14a1 1 0 011 1v9a1 1 0 01-1 1H7l-4 3V5a1 1 0 011-1z"
        stroke={active ? 'var(--color-blue)' : 'var(--color-muted)'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconMic({ active }: { active: boolean }): JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect
        x="8"
        y="2"
        width="6"
        height="10"
        rx="3"
        stroke={active ? 'var(--color-blue)' : 'var(--color-muted)'}
        strokeWidth="1.6"
      />
      <path
        d="M4 11a7 7 0 0014 0"
        stroke={active ? 'var(--color-blue)' : 'var(--color-muted)'}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <line
        x1="11"
        y1="18"
        x2="11"
        y2="21"
        stroke={active ? 'var(--color-blue)' : 'var(--color-muted)'}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function Badge({ count }: { count: number }): JSX.Element | null {
  if (count <= 0) return null
  return (
    <span className={styles.badge} aria-label={`${count} pending`}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

function PhoneShellInner(): JSX.Element {
  const { user, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('today')

  const approvalCount = useApprovalCount()
  const unreadCount = useUnreadCount()

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
      </div>
    )
  }

  if (!user) {
    return <LoginScreen />
  }

  const displayName = user.email?.split('@')[0] ?? 'User'
  const initials = displayName.slice(0, 2).toUpperCase()

  function renderScreen(): JSX.Element {
    switch (activeTab) {
      case 'today':
        return <TodayScreen onNavigate={setActiveTab} />
      case 'approvals':
        return <PhoneApprovalsScreen />
      case 'messages':
        return <PhoneMessagesScreen />
      case 'record':
        return <RecordMarkerScreen />
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.appName}>The Network</span>
        <div className={styles.avatar} aria-label={`Signed in as ${displayName}`}>
          {initials}
        </div>
      </header>

      <main className={styles.content}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            className={styles.screen}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className={styles.tabBar} aria-label="Main navigation">
        <button
          className={`${styles.tab} ${activeTab === 'today' ? styles.active : ''}`}
          onClick={() => setActiveTab('today')}
          aria-current={activeTab === 'today' ? 'page' : undefined}
        >
          <span className={styles.tabIconWrap}>
            <IconHome active={activeTab === 'today'} />
          </span>
          <span className={styles.tabLabel}>Today</span>
        </button>

        <button
          className={`${styles.tab} ${activeTab === 'approvals' ? styles.active : ''}`}
          onClick={() => setActiveTab('approvals')}
          aria-current={activeTab === 'approvals' ? 'page' : undefined}
        >
          <span className={styles.tabIconWrap}>
            <IconCheckCircle active={activeTab === 'approvals'} />
            <Badge count={approvalCount} />
          </span>
          <span className={styles.tabLabel}>Approvals</span>
        </button>

        <button
          className={`${styles.tab} ${activeTab === 'messages' ? styles.active : ''}`}
          onClick={() => setActiveTab('messages')}
          aria-current={activeTab === 'messages' ? 'page' : undefined}
        >
          <span className={styles.tabIconWrap}>
            <IconChat active={activeTab === 'messages'} />
            <Badge count={unreadCount} />
          </span>
          <span className={styles.tabLabel}>Messages</span>
        </button>

        <button
          className={`${styles.tab} ${activeTab === 'record' ? styles.active : ''}`}
          onClick={() => setActiveTab('record')}
          aria-current={activeTab === 'record' ? 'page' : undefined}
        >
          <span className={styles.tabIconWrap}>
            <IconMic active={activeTab === 'record'} />
          </span>
          <span className={styles.tabLabel}>Record</span>
        </button>
      </nav>
    </div>
  )
}

export function PhoneShell(): JSX.Element {
  return (
    <AuthProvider>
      <PhoneShellInner />
    </AuthProvider>
  )
}
