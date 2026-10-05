import { motion } from 'motion/react'
import styles from './Sidebar.module.css'
import type { NavSection } from '../../types'
import { NavIcon } from '../NavIcon/NavIcon'
import { LogoMark } from '../LogoMark/LogoMark'

interface SidebarProps {
  sections: NavSection[]
  activeId: string
  onNavigate: (id: string) => void
  userName?: string
  userInitials?: string
  userAvatarColour?: string
  onSignOut?: () => void
  onProfileClick?: () => void
}

export function Sidebar({
  sections,
  activeId,
  onNavigate,
  userName,
  userInitials = '?',
  userAvatarColour,
  onSignOut,
  onProfileClick,
}: SidebarProps): JSX.Element {
  return (
    <nav className={styles.sidebar} aria-label="Main navigation">
      <div className={styles.logo}>
        <LogoMark size={28} aria-hidden="true" />
        <span className={styles.logoText}>The Network</span>
      </div>

      <div className={styles.nav} role="list">
        {sections.map((section) => (
          <div key={section.label} className={styles.section} role="group" aria-label={section.label}>
            <div className={styles.sectionLabel}>{section.label}</div>
            {section.items.map((item) => (
              <motion.button
                key={item.id}
                className={`${styles.navItem} ${activeId === item.id ? styles.active : ''}`}
                onClick={() => onNavigate(item.id)}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
                aria-current={activeId === item.id ? 'page' : undefined}
                role="listitem"
              >
                <span className={styles.navIcon} aria-hidden="true">
                  <NavIcon name={item.icon} />
                </span>
                {item.label}
              </motion.button>
            ))}
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <motion.button
          className={styles.avatar}
          aria-label={`Account: ${userName ?? 'User'}`}
          onClick={onProfileClick}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
        >
          <div
            className={styles.avatarCircle}
            style={userAvatarColour ? { background: userAvatarColour, color: '#fff', border: 'none' } : undefined}
          >
            {userInitials}
          </div>
          {userName && <span className={styles.avatarName}>{userName}</span>}
          <svg className={styles.avatarChevron} width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.button>
        {onSignOut && (
          <motion.button
            className={styles.signOut}
            onClick={onSignOut}
            aria-label="Sign out"
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3" />
              <path d="M10 11l3-3-3-3" />
              <path d="M13 8H6" />
            </svg>
          </motion.button>
        )}
      </div>
    </nav>
  )
}
