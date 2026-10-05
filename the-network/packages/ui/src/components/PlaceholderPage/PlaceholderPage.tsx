import styles from './PlaceholderPage.module.css'

interface PlaceholderPageProps {
  id: string
  label: string
}

export function PlaceholderPage({ label }: PlaceholderPageProps): JSX.Element {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
          <path d="M7 1a6 6 0 100 12A6 6 0 007 1zm0 9a.75.75 0 110-1.5.75.75 0 010 1.5zm.75-3.5a.75.75 0 01-1.5 0V5a.75.75 0 011.5 0v1.5z" />
        </svg>
        {label} — coming in Phase 1
      </div>
    </div>
  )
}
