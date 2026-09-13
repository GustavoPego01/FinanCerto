process.env.PLAYWRIGHT_BROWSERS_PATH = process.cwd() + '/.cache/ms-playwright'
const { chromium } = await import('@playwright/test')
const context = await chromium.launchPersistentContext(
  process.cwd() + '/.cache/pwa-install-qa',
  { headless: true, channel: 'chromium' },
)
try {
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4173')
  await page.evaluate(() => navigator.serviceWorker.ready)
  const cdp = await context.newCDPSession(page)
  const check = await cdp.send('Page.getInstallabilityErrors')
  console.log('Installability:', check)
  await cdp.send('PWA.install', {
    manifestId: 'http://127.0.0.1:4173/',
    installUrlOrBundleUrl: 'http://127.0.0.1:4173/',
  })
  await cdp.send('PWA.changeAppUserSettings', {
    manifestId: 'http://127.0.0.1:4173/',
    displayMode: 'standalone',
  })
  const launched = await cdp.send('PWA.launch', {
    manifestId: 'http://127.0.0.1:4173/',
  })
  console.log('PWA installed and launched:', !!launched.targetId)
  const app = await context
    .waitForEvent('page', { timeout: 10000 })
    .catch(() => context.pages().at(-1))
  await app.waitForLoadState()
  console.log(
    'Standalone:',
    await app.evaluate(() => matchMedia('(display-mode: standalone)').matches),
  )
} catch (e) {
  console.error(String(e.message).slice(0, 500))
  process.exitCode = 1
} finally {
  await context.close()
}
