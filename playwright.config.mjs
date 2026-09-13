import { defineConfig } from '@playwright/test'
process.env.PLAYWRIGHT_BROWSERS_PATH = new URL(
  './.cache/ms-playwright',
  import.meta.url,
).pathname.replace(/^\/(\w:)/, '$1')
export default defineConfig({
  testDir: './tests/runtime',
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm.cmd run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
  },
})
