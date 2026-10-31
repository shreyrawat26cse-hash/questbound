import { defineConfig } from 'vite'
import { resolve } from 'node:path'
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 1600, rollupOptions: { input: { home: resolve(__dirname, 'index.html'), play: resolve(__dirname, 'play.html') } } } })
