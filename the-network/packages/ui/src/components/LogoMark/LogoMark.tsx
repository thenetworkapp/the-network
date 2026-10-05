interface LogoMarkProps {
  size?: number
  'aria-hidden'?: boolean | 'true' | 'false'
  style?: React.CSSProperties
  className?: string
}

export function LogoMark({ size = 28, ...rest }: LogoMarkProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0, ...rest.style }}
      {...rest}
    >
      <rect width="1024" height="1024" rx="224" fill="#1C3FCB" />
      {/* Bold N letterform */}
      <path
        d="M220 740V284H320L520 610V284H620V740H520L320 414V740H220Z"
        fill="white"
      />
      {/* Play triangle — right of the N */}
      <path d="M665 460V564L775 512Z" fill="#5B7FFF" />
    </svg>
  )
}
