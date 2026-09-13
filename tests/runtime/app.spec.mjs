import { test, expect } from '@playwright/test'
import { today } from '../../src/utils/date.js'
const userId = '11111111-1111-4111-8111-111111111111'
const user = {
  id: userId,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'teste@example.invalid',
  user_metadata: { nome: 'Marina' },
}
const session = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user,
}
async function mockBackend(page, { onboarded = true } = {}) {
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, (socket) => {
    socket.onMessage(() => {})
  })
  const data = {
    profiles: [{ id: userId, nome: 'Marina', email: user.email }],
    user_financial_profiles: onboarded
      ? [
          {
            user_id: userId,
            occupation: 'Designer',
            monthly_income: 5000,
            income_type: 'Fixa',
            financial_goal: 'Criar uma reserva',
            has_debts: false,
            has_reserve: false,
            fixed_expenses: 1500,
            risk_profile: 'Conservador',
            investment_experience: 'Iniciante',
            onboarding_completed: true,
          },
        ]
      : [],
    user_preferences: [
      { user_id: userId, notifications_enabled: true, plan: 'FREE' },
    ],
    transactions: [
      {
        id: 'tx-1',
        user_id: userId,
        type: 'income',
        title: 'Salário',
        category: 'Salário',
        amount: 5000,
        date: today(),
        source: 'app',
      },
      {
        id: 'tx-2',
        user_id: userId,
        type: 'expense',
        title: 'Mercado',
        category: 'Alimentação',
        amount: 250,
        date: today(),
        source: 'app',
      },
    ],
    goals: [],
    notifications: [],
  }
  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url()
    const body = url.includes('/token')
      ? session
      : url.includes('/user')
        ? user
        : url.includes('/signup')
          ? { user, session: null }
          : {}
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      table = url.pathname.split('/').at(-1)
    if (!(table in data))
      return route.fulfill({
        status: 404,
        json: { code: 'PGRST205', message: 'Table missing' },
      })
    const matches = (row) =>
      [...url.searchParams].every(
        ([key, value]) =>
          !value.startsWith('eq.') || String(row[key]) === value.slice(3),
      )
    let rows = data[table].filter(matches)
    if (request.method() === 'POST') {
      const payload = request.postDataJSON(),
        items = Array.isArray(payload) ? payload : [payload]
      rows = items.map((item) => {
        const existing = data[table].find((row) =>
          item.dedupe_key
            ? row.dedupe_key === item.dedupe_key
            : item.id
              ? row.id === item.id
              : item.user_id &&
                  [
                    'profiles',
                    'user_financial_profiles',
                    'user_preferences',
                  ].includes(table)
                ? row.user_id === item.user_id
                : false,
        )
        if (existing) {
          if (!request.headers().prefer?.includes('ignore-duplicates'))
            Object.assign(existing, item)
          return existing
        }
        const row = {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          read: false,
          ...item,
        }
        data[table].push(row)
        return row
      })
    }
    if (request.method() === 'PATCH')
      rows.forEach((row) => Object.assign(row, request.postDataJSON()))
    const single = request.headers().accept?.includes('vnd.pgrst.object')
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(single ? rows[0] || null : rows),
    })
  })
  return data
}
async function login(page) {
  await page.goto('/')
  await page.getByLabel('E-mail', { exact: true }).fill(user.email)
  await page.getByLabel('Senha', { exact: true }).fill('test-password-123')
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click()
}
test('login, persisted session, transactions, charts, goals, all pages and logout', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  const data = await mockBackend(page)
  await login(page)
  await expect(page.getByRole('heading', { name: /Olá, Marina/ })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: /Olá, Marina/ })).toBeVisible()
  await page
    .getByRole('button', { name: 'Nova transação', exact: true })
    .first()
    .click()
  await page.getByLabel('Descrição', { exact: true }).fill('Almoço de teste')
  await page.getByLabel('Valor (R$)', { exact: true }).fill('45.90')
  await page.getByRole('button', { name: 'Salvar transação' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(
    data.transactions.find((t) => t.title === 'Almoço de teste').date,
  ).toBe(today())
  await page.goto('/#transacoes')
  await expect(page.getByText('Almoço de teste', { exact: true })).toBeVisible()
  await page
    .getByRole('button', { name: 'Editar Almoço de teste', exact: true })
    .click()
  await page.getByLabel('Valor (R$)', { exact: true }).fill('50')
  await page.getByRole('button', { name: 'Salvar transação' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page
    .getByRole('button', { name: 'Arquivar Almoço de teste', exact: true })
    .click()
  await page.getByRole('button', { name: 'Confirmar arquivamento' }).click()
  await expect(page.getByText('Almoço de teste', { exact: true })).toHaveCount(
    0,
  )
  expect(
    data.transactions.find((t) => t.title === 'Almoço de teste').archived_at,
  ).toBeTruthy()
  await page.goto('/#metas')
  await page.getByRole('button', { name: 'Nova meta', exact: true }).click()
  await page.getByLabel('Nome da meta').fill('Viagem')
  await page.getByLabel('Objetivo (R$)').fill('2000')
  await page.getByLabel('Já reservado (R$)').fill('500')
  await page.getByRole('button', { name: 'Salvar meta' }).click()
  await expect(
    page.getByRole('heading', { name: 'Viagem', exact: true }),
  ).toBeVisible()
  for (const [route, title] of [
    ['relatorios', 'Relatórios'],
    ['inteligencia', 'Inteligência financeira'],
    ['notificacoes', 'Notificações'],
    ['educacao', 'Aprender para conquistar'],
    ['perfil', 'Meu perfil'],
  ]) {
    await page.goto(`/#${route}`)
    await expect(
      page.getByRole('heading', { name: title, exact: true }),
    ).toBeVisible()
  }
  await page.getByLabel('Profissão', { exact: true }).fill('Arquiteta')
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(
    page.getByText('Perfil atualizado.', { exact: true }),
  ).toBeVisible()
  expect(data.profiles[0].occupation).toBe('Arquiteta')
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Bom ter você de volta.' }),
  ).toBeVisible()
  expect(errors).toEqual([])
})
test('signup, recovery and multi-step onboarding render and submit', async ({
  page,
}) => {
  const data = await mockBackend(page, { onboarded: false })
  await page.goto('/')
  await page.getByRole('button', { name: 'Comece aqui' }).click()
  await page.getByLabel('Seu nome').fill('Marina')
  await page.getByLabel('E-mail', { exact: true }).fill(user.email)
  await page.getByLabel('Senha', { exact: true }).fill('test-password-123')
  await page.getByLabel('Confirme a senha').fill('test-password-123')
  await page.getByRole('button', { name: 'Criar conta gratuita' }).click()
  await expect(
    page.getByText(/Confira seu e-mail para confirmar/),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click()
  await page.getByRole('button', { name: 'Enviar link de recuperação' }).click()
  await expect(page.getByText(/Se o e-mail estiver cadastrado/)).toBeVisible()
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click()
  await expect(
    page.getByRole('heading', { name: 'Vamos conhecer você' }),
  ).toBeVisible()
  await page.getByLabel('Profissão', { exact: true }).fill('Designer')
  await page.getByLabel('Renda mensal (R$)').fill('5000')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByLabel('Gastos fixos aproximados (R$)').fill('1500')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByRole('button', { name: 'Começar meu planejamento' }).click()
  await expect(page.getByRole('heading', { name: /Olá, Marina/ })).toBeVisible()
  expect(data.user_financial_profiles[0].onboarding_completed).toBe(true)
})
test('all requested widths fit without document overflow', async ({ page }) => {
  await mockBackend(page)
  await login(page)
  await expect(page.getByRole('heading', { name: /Olá, Marina/ })).toBeVisible()
  for (const width of [320, 375, 390, 430, 768, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of [
      'dashboard',
      'transacoes',
      'relatorios',
      'metas',
      'perfil',
    ]) {
      await page.goto(`/#${route}`)
      await expect(page.locator('main h1')).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${route} at ${width}`,
      ).toBe(true)
    }
  }
  await page.setViewportSize({ width: 1366, height: 1000 })
  await page.goto('/#dashboard')
  await expect(page.getByRole('heading', { name: /Olá, Marina/ })).toBeVisible()
  await page.screenshot({
    path: 'test-results/dashboard-desktop.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    path: 'test-results/dashboard-mobile.png',
    fullPage: true,
  })
})
test('missing schema and failed transactions show errors instead of a white screen or fake totals', async ({
  page,
}) => {
  await mockBackend(page)
  await page.route('**/rest/v1/transactions?*', (route) =>
    route.fulfill({ status: 503, json: { message: 'Network unavailable' } }),
  )
  await login(page)
  await expect(page.getByText(/Os totais não serão exibidos/)).toBeVisible({
    timeout: 20000,
  })
  await expect(page.locator('body')).not.toBeEmpty()
})
