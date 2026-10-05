import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { join, dirname } from 'path'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { createServer, type Server } from 'http'
import { request as httpsRequest } from 'https'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

// Handle Squirrel.Windows install/update/uninstall events — quit immediately
// so the installer can complete its work without the app interfering.
if (process.platform === 'win32') {
  const cmd = process.argv[1]
  if (cmd === '--squirrel-install' || cmd === '--squirrel-updated' ||
      cmd === '--squirrel-uninstall' || cmd === '--squirrel-obsolete') {
    app.quit()
  }
}

// Enforce single instance — if another copy is already open, focus it and quit.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
  process.exit(0)
}
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

declare const __YOUTUBE_CLIENT_ID__: string
declare const __YOUTUBE_CLIENT_SECRET__: string

// Credentials bundled at build time — users connect their own accounts,
// no developer setup required on their end.
const BUNDLED_CREDENTIALS: Partial<Record<string, { clientId: string; clientSecret: string }>> = {
  youtube: {
    clientId: __YOUTUBE_CLIENT_ID__,
    clientSecret: __YOUTUBE_CLIENT_SECRET__,
  },
  // instagram, tiktok, spotify: fill in once developer apps are approved
}

const PLATFORM_OAUTH_CONFIG: Record<string, { authUrl: string; tokenUrl: string; scopes: string }> = {
  youtube: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly',
  },
  instagram: {
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    scopes: 'user_profile,user_media',
  },
  tiktok: {
    authUrl: 'https://www.tiktok.com/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: 'user.info.basic,video.list',
  },
  spotify: {
    authUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    scopes: 'user-read-private',
  },
}

let mainWindow: BrowserWindow | null = null
let footageRoot = ''
let authServer: Server | null = null

// ── Simple JSON store (replaces electron-store — zero runtime dependencies) ──

const storeFile = join(app.getPath('userData'), 'config.json')
let storeCache: Record<string, string> | null = null

async function storeGet(key: string, defaultValue = ''): Promise<string> {
  if (!storeCache) {
    try {
      storeCache = JSON.parse(await readFile(storeFile, 'utf8')) as Record<string, string>
    } catch {
      storeCache = {}
    }
  }
  return storeCache[key] ?? defaultValue
}

async function storeSet(key: string, value: string): Promise<void> {
  if (!storeCache) await storeGet(key)
  storeCache![key] = value
  await mkdir(dirname(storeFile), { recursive: true })
  await writeFile(storeFile, JSON.stringify(storeCache, null, 2), 'utf8')
}

// ─────────────────────────────────────────────────────────────────────────────

function httpsPost(url: string, body: string, headers: Record<string, string>): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = httpsRequest(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => { try { resolve(JSON.parse(data) as Record<string, unknown>) } catch { reject(new Error('Invalid JSON')) } })
      },
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

interface SimpleWatcher {
  on(event: string, cb: (...args: unknown[]) => void): SimpleWatcher
  close(): Promise<void>
}

let watcher: SimpleWatcher | null = null

// Starts a local HTTP server on port 54321 that Supabase redirects to after
// magic-link auth. The landing page JS reads the hash (which contains the tokens)
// and pings /done, which forwards the tokens to the renderer via IPC.
// This avoids all Windows-registry custom-protocol issues in dev and production.
function startAuthCallbackServer(): void {
  authServer = createServer(async (req, res) => {
    const path = (req.url ?? '/').split('?')[0]
    const query = (req.url ?? '').includes('?') ? req.url!.slice(req.url!.indexOf('?') + 1) : ''

    if (path === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Signing in…</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#EDEFF3;color:#1a1a2e}</style>
</head>
<body>
<p>Completing sign-in — return to The Network.</p>
<script>
var h = location.hash.slice(1);
if (h) {
  fetch('/done?' + h).catch(function(){});
} else {
  document.querySelector('p').textContent = 'No auth token found. Please try again.';
}
</script>
</body>
</html>`)
    } else if (path === '/done') {
      const params = new URLSearchParams(query)
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (access_token && refresh_token && mainWindow) {
        mainWindow.webContents.send('auth:callback', { access_token, refresh_token })
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      }
      res.writeHead(200)
      res.end()
    } else if (path.startsWith('/oauth/')) {
      const platform = path.replace('/oauth/', '').replace(/\//g, '')
      const params = new URLSearchParams(query)
      const code = params.get('code')

      if (!code || !PLATFORM_OAUTH_CONFIG[platform]) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<html><body style="font-family:system-ui;padding:40px">Authorization failed — return to The Network and try again.</body></html>')
        return
      }

      try {
        const cfg = PLATFORM_OAUTH_CONFIG[platform]
        const bundled = BUNDLED_CREDENTIALS[platform]
        const clientId = bundled?.clientId ?? await storeGet(`platform_${platform}_clientId`)
        const clientSecret = bundled?.clientSecret ?? await storeGet(`platform_${platform}_clientSecret`)
        const body = new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: `http://localhost:54321/oauth/${platform}`,
          grant_type: 'authorization_code',
        })
        const tokenData = await httpsPost(cfg.tokenUrl, body.toString(), {
          'Content-Type': 'application/x-www-form-urlencoded',
        })
        const accessToken = (tokenData.access_token ?? '') as string
        const refreshToken = (tokenData.refresh_token ?? '') as string
        const accountId = `acc_${Date.now()}`
        const accountsRaw = await storeGet(`platform_${platform}_accounts`, '[]')
        const accounts = JSON.parse(accountsRaw) as Array<{ id: string; accountName: string; accessToken: string; refreshToken: string }>
        accounts.push({ id: accountId, accountName: '', accessToken, refreshToken })
        await storeSet(`platform_${platform}_accounts`, JSON.stringify(accounts))
        if (mainWindow) {
          mainWindow.webContents.send('platform:connected', { platform, accountId, accountName: '' })
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.focus()
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Connected</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#EDEFF3;color:#111318}</style>
</head><body><div style="text-align:center"><div style="width:56px;height:56px;border-radius:50%;background:#16a34a;display:flex;align-items:center;justify-content:center;margin:0 auto 16px"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><path d="M5 12l4 4 10-10"/></svg></div><h2 style="margin:0 0 6px">Connected!</h2><p style="color:#6b7280;margin:0">You can close this window and return to The Network.</p></div></body></html>`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<html><body style="font-family:system-ui;padding:40px;color:#dc2626">Connection failed: ${msg}</body></html>`)
      }
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  authServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code !== 'EADDRINUSE') throw err
    // Port already bound by a stale process — the single-instance lock above should
    // prevent this in normal use, but guard defensively so the app doesn't crash.
    console.warn('Auth server: port 54321 already in use, OAuth callbacks will not work until the port is free.')
  })
  authServer.listen(54321, '127.0.0.1')
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#EDEFF3',
    icon: join(__dirname, '../../resources/icon.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('app.thenetwork.desktop')

  startAuthCallbackServer()

  ipcMain.handle('config:get', async () => ({
    url: await storeGet('supabaseUrl'),
    anonKey: await storeGet('supabaseAnonKey'),
  }))

  ipcMain.handle('config:set', async (_event, cfg: { url: string; anonKey: string }) => {
    await storeSet('supabaseUrl', cfg.url)
    await storeSet('supabaseAnonKey', cfg.anonKey)
  })

  // Restore footage root from last session and re-create the base folder if missing.
  const savedRoot = await storeGet('footageRoot')
  if (savedRoot) {
    footageRoot = savedRoot
    mkdir(savedRoot, { recursive: true }).catch(() => {
      // Drive may be unavailable — clear the stale path so the user is prompted again.
      footageRoot = ''
      void storeSet('footageRoot', '')
    })
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('window:minimise', () => mainWindow?.minimize())
  ipcMain.handle('window:maximise', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.handle('window:close', () => mainWindow?.close())

  ipcMain.handle('footage:selectRoot', async () => {
    if (!mainWindow) return { cancelled: true }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select footage root folder',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { cancelled: true as const }
    }
    footageRoot = result.filePaths[0]
    await storeSet('footageRoot', footageRoot)
    return { path: footageRoot }
  })

  ipcMain.handle('footage:getRoot', () => footageRoot)

  ipcMain.handle(
    'footage:createSession',
    async (
      _event,
      { videoId: _videoId, date, show, ep }: { videoId: string; date: string; show: string; ep: string },
    ) => {
      const sessionName = `${date}_${show}_${ep}`
      const sessionPath = join(footageRoot, sessionName)
      await Promise.all([
        mkdir(join(sessionPath, 'Raw'), { recursive: true }),
        mkdir(join(sessionPath, 'Project'), { recursive: true }),
        mkdir(join(sessionPath, 'Export'), { recursive: true }),
        mkdir(join(sessionPath, 'Proxy'), { recursive: true }),
      ])
      return { sessionPath }
    },
  )

  ipcMain.handle('footage:watchStart', async (_event, rootPath: string) => {
    if (watcher) {
      await watcher.close()
      watcher = null
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { watch } = (await import('chokidar')) as any
    const w = watch(rootPath, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 200 },
    }) as SimpleWatcher
    watcher = w
    w.on('add', (...args: unknown[]) => {
      const [filePath, stats] = args as [string, { size?: number; mtimeMs?: number } | undefined]
      if (mainWindow) {
        mainWindow.webContents.send('footage:file-added', {
          filePath,
          size: stats?.size ?? 0,
          mtime: stats?.mtimeMs ?? Date.now(),
        })
      }
    })
  })

  ipcMain.handle('footage:watchStop', async () => {
    if (watcher) {
      await watcher.close()
      watcher = null
    }
  })

  // ── Platform OAuth ──────────────────────────────────────────────────────────

  ipcMain.handle('platform:getStatus', async () => {
    const platforms = ['youtube', 'instagram', 'tiktok', 'spotify', 'apple_podcasts', 'rss']
    const status: Record<string, unknown> = {}
    for (const p of platforms) {
      const bundled = BUNDLED_CREDENTIALS[p]
      const storedClientId = bundled ? '' : await storeGet(`platform_${p}_clientId`)
      const configured = !!bundled || !!storedClientId
      const accountsRaw = await storeGet(`platform_${p}_accounts`, '[]')
      const accounts = (JSON.parse(accountsRaw) as Array<{ id: string; accountName: string }>).map(a => ({ id: a.id, accountName: a.accountName }))
      const feedsRaw = await storeGet(`platform_${p}_feeds`, '[]')
      const feeds = JSON.parse(feedsRaw) as string[]
      status[p] = { configured, credentialsBundled: !!bundled, accounts, feeds }
    }
    return status
  })

  ipcMain.handle('platform:setCredentials', async (_event, platform: string, creds: { clientId: string; clientSecret: string }) => {
    await storeSet(`platform_${platform}_clientId`, creds.clientId.trim())
    await storeSet(`platform_${platform}_clientSecret`, creds.clientSecret.trim())
  })

  ipcMain.handle('platform:getCredentials', async (_event, platform: string) => {
    const clientId = await storeGet(`platform_${platform}_clientId`)
    const secret = await storeGet(`platform_${platform}_clientSecret`)
    return { clientId, hasSecret: !!secret }
  })

  ipcMain.handle('platform:connect', async (_event, platform: string) => {
    const cfg = PLATFORM_OAUTH_CONFIG[platform]
    if (!cfg) return { ok: false, error: 'Unknown platform' }
    const clientId = BUNDLED_CREDENTIALS[platform]?.clientId ?? await storeGet(`platform_${platform}_clientId`)
    if (!clientId) return { ok: false, error: 'No credentials configured — enter your client ID first' }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `http://localhost:54321/oauth/${platform}`,
      response_type: 'code',
      scope: cfg.scopes,
      access_type: 'offline',
      prompt: 'consent',
    })
    await shell.openExternal(`${cfg.authUrl}?${params.toString()}`)
    return { ok: true }
  })

  ipcMain.handle('platform:disconnectAccount', async (_event, platform: string, accountId: string) => {
    const raw = await storeGet(`platform_${platform}_accounts`, '[]')
    const accounts = (JSON.parse(raw) as Array<{ id: string }>).filter(a => a.id !== accountId)
    await storeSet(`platform_${platform}_accounts`, JSON.stringify(accounts))
  })

  ipcMain.handle('platform:addFeed', async (_event, platform: string, url: string) => {
    const raw = await storeGet(`platform_${platform}_feeds`, '[]')
    const feeds = JSON.parse(raw) as string[]
    if (!feeds.includes(url.trim())) feeds.push(url.trim())
    await storeSet(`platform_${platform}_feeds`, JSON.stringify(feeds))
    return { ok: true, feeds }
  })

  ipcMain.handle('platform:removeFeed', async (_event, platform: string, url: string) => {
    const raw = await storeGet(`platform_${platform}_feeds`, '[]')
    const feeds = (JSON.parse(raw) as string[]).filter(f => f !== url)
    await storeSet(`platform_${platform}_feeds`, JSON.stringify(feeds))
    return { feeds }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  authServer?.close()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
