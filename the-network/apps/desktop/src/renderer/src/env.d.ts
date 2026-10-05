/// <reference types="vite/client" />

interface FootageFileInfo {
  filePath: string
  size: number
  mtime: number
}

interface FootageAPI {
  selectRoot(): Promise<{ path: string } | { cancelled: true }>
  getRoot(): Promise<string>
  createSession(args: { videoId: string; date: string; show: string; ep: string }): Promise<{ sessionPath: string }>
  watchStart(rootPath: string): Promise<void>
  watchStop(): Promise<void>
  onFileAdded(cb: (info: FootageFileInfo) => void): () => void
}

declare interface Window {
  footageAPI: FootageAPI
}
