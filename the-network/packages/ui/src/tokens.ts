export const tokens = {
  color: {
    ground: '#EDEFF3',
    surface: '#FFFFFF',
    surface2: '#F3F4F7',
    ink: '#111318',
    ink2: '#1F2329',
    ink3: '#3C4049',
    muted: '#5B616E',
    faint: '#6B7180',
    line: 'rgba(17,19,24,.07)',
    blue: '#1C3FCB',
    blueHover: '#2449DB',
    ok: '#15803D',
    warn: '#B25E00',
    bad: '#C42B2B',
    live: '#FF453A',
  },
  font: {
    display: '"Archivo", -apple-system, system-ui, sans-serif',
    text: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
  },
  radius: {
    card: 12,
    tile: 10,
    control: 999,
    sheet: 24,
    sidebar: 26,
  },
} as const

export type Tokens = typeof tokens
