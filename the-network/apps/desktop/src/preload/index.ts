import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface AppConfigValues {
  url: string
  anonKey: string
}

export interface PlatformAccount {
  id: string
  accountName: string
}

export interface PlatformStatus {
  configured: boolean
  credentialsBundled: boolean
  accounts: PlatformAccount[]
  feeds: string[]
}

const windowControls = {
  minimise: () => ipcRenderer.invoke('window:minimise'),
  maximise: () => ipcRenderer.invoke('window:maximise'),
  close: () => ipcRenderer.invoke('window:close'),
}

const footageAPI = {
  selectRoot: () => ipcRenderer.invoke('footage:selectRoot'),
  getRoot: () => ipcRenderer.invoke('footage:getRoot'),
  createSession: (args: { videoId: string; date: string; show: string; ep: string }) =>
    ipcRenderer.invoke('footage:createSession', args),
  watchStart: (rootPath: string) => ipcRenderer.invoke('footage:watchStart', rootPath),
  watchStop: () => ipcRenderer.invoke('footage:watchStop'),
  onFileAdded: (cb: (info: { filePath: string; size: number; mtime: number }) => void) => {
    const handler = (_: unknown, info: { filePath: string; size: number; mtime: number }) => cb(info)
    ipcRenderer.on('footage:file-added', handler)
    return () => ipcRenderer.off('footage:file-added', handler)
  },
}

const configAPI = {
  get: (): Promise<AppConfigValues> => ipcRenderer.invoke('config:get'),
  set: (cfg: AppConfigValues): Promise<void> => ipcRenderer.invoke('config:set', cfg),
  onAuthCallback: (cb: (tokens: { access_token: string; refresh_token: string }) => void): (() => void) => {
    const handler = (_: unknown, tokens: { access_token: string; refresh_token: string }): void => cb(tokens)
    ipcRenderer.on('auth:callback', handler)
    return () => ipcRenderer.off('auth:callback', handler)
  },
}

const platformAPI = {
  // Get credentials + connection status for all platforms
  getStatus: (): Promise<Record<string, PlatformStatus>> =>
    ipcRenderer.invoke('platform:getStatus'),

  // Store client_id + client_secret for a platform (admin setup)
  setCredentials: (platform: string, creds: { clientId: string; clientSecret: string }): Promise<void> =>
    ipcRenderer.invoke('platform:setCredentials', platform, creds),

  // Returns just clientId (not secret) so UI can show "configured" state
  getCredentials: (platform: string): Promise<{ clientId: string; hasSecret: boolean }> =>
    ipcRenderer.invoke('platform:getCredentials', platform),

  // Initiate OAuth flow — opens browser
  connect: (platform: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('platform:connect', platform),

  // Disconnect a specific account
  disconnectAccount: (platform: string, accountId: string): Promise<void> =>
    ipcRenderer.invoke('platform:disconnectAccount', platform, accountId),

  // Add RSS / Apple Podcasts feed URL
  addFeed: (platform: string, url: string): Promise<{ ok: boolean; feeds: string[] }> =>
    ipcRenderer.invoke('platform:addFeed', platform, url),

  // Remove a feed URL
  removeFeed: (platform: string, url: string): Promise<{ feeds: string[] }> =>
    ipcRenderer.invoke('platform:removeFeed', platform, url),

  // Subscribe to connection events (OAuth callback completed)
  onConnected: (cb: (info: { platform: string; accountId: string; accountName: string }) => void): (() => void) => {
    const handler = (_: unknown, info: { platform: string; accountId: string; accountName: string }): void => cb(info)
    ipcRenderer.on('platform:connected', handler)
    return () => ipcRenderer.off('platform:connected', handler)
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('windowControls', windowControls)
    contextBridge.exposeInMainWorld('footageAPI', footageAPI)
    contextBridge.exposeInMainWorld('configAPI', configAPI)
    contextBridge.exposeInMainWorld('platformAPI', platformAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.windowControls = windowControls
  // @ts-ignore
  window.footageAPI = footageAPI
  // @ts-ignore
  window.configAPI = configAPI
  // @ts-ignore
  window.platformAPI = platformAPI
}
