import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: './tests', timeout: 90000, workers: 1, use: { channel: 'msedge', baseURL: 'http://127.0.0.1:5173', headless: true }, webServer: { command: 'npm.cmd start -- --port 5173', url: 'http://127.0.0.1:5173', reuseExistingServer: true } })

