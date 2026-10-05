import type { ReactNode } from 'react'
import styles from './Card.module.css'

interface CardProps {
  title?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  padded?: boolean
}

export function Card({ title, actions, children, className, padded }: CardProps): JSX.Element {
  const cls = [styles.card, className ?? ''].filter(Boolean).join(' ')
  return (
    <div className={cls}>
      {title && (
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div className={padded ? styles.body : undefined}>{children}</div>
    </div>
  )
}
