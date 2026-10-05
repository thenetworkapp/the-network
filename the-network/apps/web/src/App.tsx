import { useState, useEffect } from 'react'
import { AppShell, PhoneShell } from '@network/ui'
import type { NavSection } from '@network/ui'
import '@network/ui/styles'

const sections: NavSection[] = [
  {
    label: 'Home',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
      { id: 'messages', label: 'Messages', icon: 'chat' },
      { id: 'calendar', label: 'Calendar', icon: 'calendar' },
    ],
  },
  {
    label: 'Show Summary',
    items: [
      { id: 'show-dashboard', label: 'Show Dashboard', icon: 'chart' },
      { id: 'videos', label: 'Videos', icon: 'video' },
      { id: 'clips', label: 'Clips', icon: 'scissors' },
      { id: 'video-metrics', label: 'Video Metrics', icon: 'bar-chart' },
    ],
  },
  {
    label: 'Pre-Production',
    items: [
      { id: 'video-calendar', label: 'Video Calendar', icon: 'calendar-list' },
      { id: 'scheduled', label: 'Scheduled Videos', icon: 'clock' },
    ],
  },
  {
    label: 'Post-Production',
    items: [
      { id: 'packaging', label: 'Packaging', icon: 'package' },
    ],
  },
]

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return mobile
}

export default function App(): JSX.Element {
  const isMobile = useIsMobile()
  if (isMobile) return <PhoneShell />
  return <AppShell sections={sections} platform="web" />
}
