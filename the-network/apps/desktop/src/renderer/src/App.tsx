import { useState, useEffect } from 'react'
import { AppShell, SetupWizard } from '@network/ui'
import { initSupabase, supabase } from '@network/core'
import type { NavSection } from '@network/ui'
import '@network/ui/styles'

declare global {
  interface Window {
    configAPI: {
      get: () => Promise<{ url: string; anonKey: string }>
      set: (cfg: { url: string; anonKey: string }) => Promise<void>
      onAuthCallback: (cb: (tokens: { access_token: string; refresh_token: string }) => void) => () => void
    }
  }
}

const sections: NavSection[] = [
  {
    label: 'Home',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
      { id: 'messages', label: 'Messages', icon: 'chat' },
      { id: 'company', label: 'Company Structure', icon: 'org' },
      { id: 'shows', label: 'Shows', icon: 'video' },
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
      { id: 'clip-metrics', label: 'Clip Metrics', icon: 'trending' },
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
      { id: 'graphic-design', label: 'Graphic Design', icon: 'brush' },
      { id: 'editing', label: 'Editing', icon: 'film' },
      { id: 'packaging', label: 'Packaging', icon: 'package' },
      { id: 'upload', label: 'Upload', icon: 'upload' },
    ],
  },
  {
    label: 'Desktop',
    items: [
      { id: 'footage-settings', label: 'Footage Settings', icon: 'folder' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { id: 'connections', label: 'Connected Platforms', icon: 'link' },
    ],
  },
]

type AppState = 'loading' | 'setup' | 'ready'

export default function App(): JSX.Element {
  const [appState, setAppState] = useState<AppState>('loading')

  useEffect(() => {
    async function checkConfig(): Promise<void> {
      const cfg = await window.configAPI.get()
      if (cfg.url && cfg.anonKey) {
        initSupabase(cfg.url, cfg.anonKey)
        setAppState('ready')
      } else {
        setAppState('setup')
      }
    }
    checkConfig()
  }, [])

  // The local auth server on port 54321 catches Supabase's magic-link redirect,
  // extracts the tokens from the URL hash, and sends them here via IPC.
  useEffect(() => {
    return window.configAPI.onAuthCallback(async ({ access_token, refresh_token }) => {
      await supabase.auth.setSession({ access_token, refresh_token })
    })
  }, [])

  if (appState === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#EDEFF3' }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2.5px solid #e2e4e8', borderTopColor: '#1C3FCB', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (appState === 'setup') {
    return (
      <SetupWizard
        onComplete={async (url, anonKey) => {
          await window.configAPI.set({ url, anonKey })
          initSupabase(url, anonKey)
          setAppState('ready')
        }}
      />
    )
  }

  return <AppShell sections={sections} platform="desktop" />
}
