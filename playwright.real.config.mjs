import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
process.env.PLAYWRIGHT_BROWSERS_PATH = fileURLToPath(
  new URL('./.cache/ms-playwright', import.meta.url),
)
export default defineConfig({
  testDir: './tests/real',
  workers: 1,
  timeout: 180000,
  use: {
    baseURL: 'http://127.0.0.1:4180',
    serviceWorkers: 'block',
    trace: 'off',
    screenshot: 'off',
    viewport: { width: 1366, height: 900 },
  },
  webServer: {
    command: 'npm.cmd run dev -- --host 127.0.0.1 --port 4180 --strictPort',
    url: 'http://127.0.0.1:4180',
    reuseExistingServer: true,
  },
})
