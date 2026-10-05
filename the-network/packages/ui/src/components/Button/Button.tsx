import { motion } from 'motion/react'
import type { HTMLMotionProps } from 'motion/react'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: Variant
  size?: Size
  iconOnly?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  className,
  children,
  whileTap,
  transition,
  ...props
}: ButtonProps): JSX.Element {
  const classes = [
    styles.btn,
    styles[variant],
    size !== 'md' ? styles[size] : '',
    iconOnly ? styles.iconOnly : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <motion.button
      className={classes}
      whileTap={whileTap ?? { scale: 0.96 }}
      transition={transition ?? { type: 'spring', bounce: 0, duration: 0.2 }}
      {...props}
    >
      {children}
    </motion.button>
  )
}
