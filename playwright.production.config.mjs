import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

process.env.PLAYWRIGHT_BROWSERS_PATH = fileURLToPath(
  new URL('./.cache/ms-playwright', import.meta.url),
)
process.env.FINANCERTO_PWA_URL = 'https://financerto-nexora.netlify.app'
export default defineConfig({
  testDir: './tests/real-pwa',
  workers: 1,
  timeout: 120000,
  outputDir: 'test-results/production',
  use: {
    baseURL: process.env.FINANCERTO_PWA_URL,
    serviceWorkers: 'allow',
    trace: 'off',
    screenshot: 'off',
  },
})
