import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
process.env.PLAYWRIGHT_BROWSERS_PATH = fileURLToPath(
  new URL('./.cache/ms-playwright', import.meta.url),
)
export default defineConfig({
  testDir: './tests/real-pwa',
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    serviceWorkers: 'allow',
    trace: 'off',
    screenshot: 'off',
  },
  webServer: {
    command: 'npm.cmd run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
  },
})
