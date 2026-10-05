import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      __YOUTUBE_CLIENT_ID__: JSON.stringify(env.YOUTUBE_CLIENT_ID ?? ''),
      __YOUTUBE_CLIENT_SECRET__: JSON.stringify(env.YOUTUBE_CLIENT_SECRET ?? ''),
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        '@network/core': resolve(__dirname, '../../packages/core/src/index.ts'),
        '@network/ui/styles': resolve(__dirname, '../../packages/ui/src/styles/global.css'),
        '@network/ui': resolve(__dirname, '../../packages/ui/src/index.ts'),
      },
    },
    css: {
      modules: { localsConvention: 'camelCase' },
    },
    plugins: [react()],
  },
  }
})
