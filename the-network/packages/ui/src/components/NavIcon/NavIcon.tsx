interface NavIconProps {
  name: string
}

const icons: Record<string, JSX.Element> = {
  grid: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </svg>
  ),
  chat: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H9l-3 2v-2H3a1 1 0 01-1-1V3z" />
    </svg>
  ),
  org: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="5" y="1" width="6" height="4" rx="1" />
      <rect x="1" y="11" width="5" height="4" rx="1" />
      <rect x="10" y="11" width="5" height="4" rx="1" />
      <path d="M8 5v2.5M3.5 8.5V11M12.5 8.5V11M3.5 8.5h9" stroke="currentColor" strokeWidth="1.25" fill="none" strokeLinecap="round" />
    </svg>
  ),
  calendar: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path d="M5 2v2M11 2v2M2 7h12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" fill="none" />
    </svg>
  ),
  chart: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="8" width="3" height="6" rx="1" />
      <rect x="6.5" y="5" width="3" height="9" rx="1" />
      <rect x="11" y="2" width="3" height="12" rx="1" />
    </svg>
  ),
  video: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="4" width="10" height="8" rx="2" />
      <path d="M11 7l4-2v6l-4-2V7z" />
    </svg>
  ),
  scissors: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="4" cy="4" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="4" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.7 5.3L14 12M5.7 10.7L14 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  ),
  'bar-chart': (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="9" width="3" height="5" rx="1" />
      <rect x="6.5" y="6" width="3" height="8" rx="1" />
      <rect x="11" y="3" width="3" height="11" rx="1" />
    </svg>
  ),
  trending: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 11l4-4 3 2 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M11 3h3v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  ),
  'calendar-list': (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path d="M5 2v2M11 2v2M2 7h12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" fill="none" />
      <path d="M5 10h6M5 12.5h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" fill="none" />
    </svg>
  ),
  clock: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  ),
  brush: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M10.5 2l3.5 3.5-7 7S4 13.5 2 14c.5-2 1.5-5 1.5-5l7-7z" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  ),
  film: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="4" width="12" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path d="M5 4V2M11 4V2M5 14v-2M11 14v-2M2 7h12M2 9h12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" fill="none" />
    </svg>
  ),
  package: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 2L2 5v6l6 3 6-3V5L8 2z" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M8 2v11M2 5l6 3 6-3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" fill="none" />
    </svg>
  ),
  upload: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 2v8M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M3 11v2h10v-2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" fill="none" />
    </svg>
  ),
  folder: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 4a1 1 0 011-1h3.5l1.5 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  ),
  mic: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="5.5" y="1" width="5" height="8" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path d="M3 8a5 5 0 0010 0M8 13v2M6 15h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" fill="none" />
    </svg>
  ),
  'check-circle': (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  ),
  home: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 7l6-5 6 5v7H10v-4H6v4H2V7z" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  ),
  link: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 9.5a3.5 3.5 0 0 0 4.95 0l2-2a3.5 3.5 0 0 0-4.95-4.95l-1 1" />
      <path d="M9.5 6.5a3.5 3.5 0 0 0-4.95 0l-2 2a3.5 3.5 0 0 0 4.95 4.95l1-1" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.42 1.42M11.53 11.53l1.42 1.42M3.05 12.95l1.42-1.42M11.53 4.47l1.42-1.42" />
    </svg>
  ),
}

export function NavIcon({ name }: NavIconProps): JSX.Element {
  return icons[name] ?? (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="8" r="3" />
    </svg>
  )
}
