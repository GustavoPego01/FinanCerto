import { test, expect, chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
test('real PWA: production login, persistent browser reopening, service worker and private-cache isolation', async () => {
  const accounts = JSON.parse(
    fs.readFileSync('.cache/financerto-live-accounts.json', 'utf8'),
  )
  const directory = path.resolve('.cache/financerto-pwa-session')
  const launch = () =>
    chromium.launchPersistentContext(directory, {
      headless: true,
      serviceWorkers: 'allow',
      viewport: { width: 390, height: 844 },
    })
  let context = await launch()
  try {
    let page = await context.newPage()
    await page.goto('http://127.0.0.1:4173')
    if (await page.getByLabel('E-mail', { exact: true }).isVisible()) {
      await page.getByLabel('E-mail', { exact: true }).fill(accounts.a.email)
      await page.getByLabel('Senha', { exact: true }).fill(accounts.a.password)
      await page.getByRole('button', { name: 'Entrar na minha conta' }).click()
    }
    await expect(
      page.getByRole('heading', { name: /Olá, Validação/ }),
    ).toBeVisible({ timeout: 30000 })
    await page.evaluate(() => navigator.serviceWorker.ready)
    const manifest = await page.evaluate(async () =>
      (await fetch('/manifest.webmanifest')).json(),
    )
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    )
    for (const icon of manifest.icons) {
      const size = await page.evaluate(async (src) => {
        const img = new Image()
        img.src = src
        await img.decode()
        return `${img.naturalWidth}x${img.naturalHeight}`
      }, icon.src)
      expect(size).toBe(icon.sizes)
    }
    await page.reload()
    await expect(
      page.getByRole('heading', { name: /Olá, Validação/ }),
    ).toBeVisible({ timeout: 30000 })
    await context.close()
    context = await launch()
    page = await context.newPage()
    await page.goto('http://127.0.0.1:4173')
    await expect(
      page.getByRole('heading', { name: /Olá, Validação/ }),
    ).toBeVisible({ timeout: 30000 })
    await expect(page.locator('[role="alert"]')).toHaveCount(0)
    const cached = await page.evaluate(async () =>
      (
        await Promise.all(
          (await caches.keys()).map(async (name) =>
            (await (await caches.open(name)).keys()).map(
              (request) => request.url,
            ),
          ),
        )
      ).flat(),
    )
    expect(cached.length).toBeGreaterThan(0)
    expect(
      cached.some((url) =>
        /supabase|\/auth\/|\/rest\/|\/functions\//.test(url),
      ),
    ).toBe(false)
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByText(/Você está offline/)).toBeVisible({
      timeout: 25000,
    })
    await expect(page.getByText(/Os totais não serão exibidos/)).toBeVisible()
    await context.setOffline(false)
    await expect(
      page.getByRole('heading', { name: /Olá, Validação/ }),
    ).toBeVisible({ timeout: 30000 })
  } finally {
    await context.close()
  }
})
