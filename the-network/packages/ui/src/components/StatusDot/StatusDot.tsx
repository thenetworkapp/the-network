import styles from './StatusDot.module.css'

type Status = 'ok' | 'warn' | 'bad' | 'live' | 'neutral'

interface StatusDotProps {
  status: Status
  label?: string
}

export function StatusDot({ status, label }: StatusDotProps): JSX.Element {
  return (
    <span className={styles.wrap}>
      <span className={`${styles.dot} ${styles[status]}`} aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  )
}
