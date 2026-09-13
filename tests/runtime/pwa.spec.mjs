import { test, expect } from '@playwright/test'
test('production PWA registers, caches only shell and renders offline', async ({
  browser,
}) => {
  const context = await browser.newContext({
    serviceWorkers: 'allow',
    viewport: { width: 390, height: 844 },
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('http://127.0.0.1:4173')
  await expect(
    page.getByRole('heading', { name: 'Bom ter você de volta.' }),
  ).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)
  const manifest = await page.evaluate(async () =>
    (await fetch('/manifest.webmanifest')).json(),
  )
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  )
  for (const icon of manifest.icons) {
    const dimensions = await page.evaluate(async (src) => {
      const image = new Image()
      image.src = src
      await image.decode()
      return `${image.naturalWidth}x${image.naturalHeight}`
    }, icon.src)
    expect(dimensions).toBe(icon.sizes)
  }
  await page.reload()
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
    cached.some((url) => /supabase|\/rest\/|\/auth\/|\/functions\//.test(url)),
  ).toBe(false)
  await page.screenshot({
    path: 'test-results/login-mobile.png',
    fullPage: true,
  })
  await context.setOffline(true)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Bom ter você de volta.' }),
  ).toBeVisible()
  expect(errors).toEqual([])
  await context.close()
})
