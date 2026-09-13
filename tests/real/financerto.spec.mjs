import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'
import fs from 'node:fs'
import { randomUUID, randomBytes } from 'node:crypto'
import { today } from '../../src/utils/date.js'
const env = loadEnv('development', process.cwd(), 'VITE_')
if (
  new URL(env.VITE_SUPABASE_URL).hostname !== 'fzqstnkrklgficdurqsd.supabase.co'
)
  throw new Error(
    'Real tests are restricted to the verified FinanCerto project.',
  )
const accountsPath = '.cache/financerto-live-accounts.json'
const accounts = fs.existsSync(accountsPath)
  ? JSON.parse(fs.readFileSync(accountsPath, 'utf8'))
  : {
      a: {
        email: `qa-financerto-${randomUUID()}@example.com`,
        password: randomBytes(24).toString('base64url'),
      },
      b: {
        email: `qa-financerto-${randomUUID()}@example.com`,
        password: randomBytes(24).toString('base64url'),
      },
    }
fs.writeFileSync(accountsPath, JSON.stringify(accounts), { mode: 0o600 })
const client = () =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
function ok(result) {
  if (result.error)
    throw new Error(`${result.error.code || ''}: ${result.error.message}`)
  return result.data
}
test('real Supabase: signup, login, onboarding, data services, RLS, session and app navigation', async ({
  page,
}) => {
  const errors = [],
    unexpectedResponses = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('response', (response) => {
    if (response.url().includes('.supabase.co') && response.status() >= 400)
      unexpectedResponses.push({
        path: new URL(response.url()).pathname,
        status: response.status(),
      })
  })
  await page.goto('/')
  if (!accounts.a.created) {
    await page.getByRole('button', { name: 'Comece aqui' }).click()
    await page.getByLabel('Seu nome').fill('Validação FinanCerto')
    await page.getByLabel('E-mail', { exact: true }).fill(accounts.a.email)
    await page.getByLabel('Senha', { exact: true }).fill(accounts.a.password)
    await page.getByLabel('Confirme a senha').fill(accounts.a.password)
    await page.getByRole('button', { name: 'Criar conta gratuita' }).click()
    await expect(
      page.getByRole('heading', { name: 'Vamos conhecer você' }),
    ).toBeVisible({ timeout: 30000 })
    accounts.a.created = true
    fs.writeFileSync(accountsPath, JSON.stringify(accounts), { mode: 0o600 })
  } else {
    await page.getByLabel('E-mail', { exact: true }).fill(accounts.a.email)
    await page.getByLabel('Senha', { exact: true }).fill(accounts.a.password)
    await page.getByRole('button', { name: 'Entrar na minha conta' }).click()
  }
  const a = client(),
    b = client()
  const authA = ok(await a.auth.signInWithPassword(accounts.a))
  expect(authA.session).toBeTruthy()
  accounts.a.id = authA.user.id
  const authB = accounts.b.created
    ? ok(await b.auth.signInWithPassword(accounts.b))
    : ok(
        await b.auth.signUp({
          ...accounts.b,
          options: {
            data: {
              nome: 'Validação isolamento FinanCerto',
              financerto_qa: true,
            },
          },
        }),
      )
  expect(authB.session).toBeTruthy()
  accounts.b.created = true
  accounts.b.id = authB.user.id
  fs.writeFileSync(accountsPath, JSON.stringify(accounts), { mode: 0o600 })
  if (
    await page.getByRole('heading', { name: 'Vamos conhecer você' }).isVisible()
  ) {
    await page
      .getByLabel('Profissão', { exact: true })
      .fill('Validação técnica')
    await page.getByLabel('Renda mensal (R$)').fill('1000')
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    await page.getByLabel('Gastos fixos aproximados (R$)').fill('100')
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    await page.getByRole('button', { name: 'Começar meu planejamento' }).click()
  }
  await expect(
    page.getByRole('heading', { name: /Olá, Validação/ }),
  ).toBeVisible({ timeout: 30000 })
  expect(
    ok(
      await a
        .from('profiles')
        .select('occupation')
        .eq('id', authA.user.id)
        .single(),
    ).occupation,
  ).toBe('Validação técnica')
  expect(
    ok(
      await a
        .from('user_financial_profiles')
        .select('onboarding_completed')
        .eq('user_id', authA.user.id)
        .single(),
    ).onboarding_completed,
  ).toBe(true)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: /Olá, Validação/ }),
  ).toBeVisible({ timeout: 30000 })
  const suffix = randomUUID().slice(0, 8)
  for (const [kind, title, amount] of [
    ['Entrada', `QA entrada ${suffix}`, '1000'],
    ['Gasto', `QA gasto ${suffix}`, '45.90'],
  ]) {
    await page
      .getByRole('button', { name: 'Nova transação', exact: true })
      .first()
      .click()
    await page.getByRole('button', { name: kind, exact: true }).click()
    await page.getByLabel('Descrição', { exact: true }).fill(title)
    await page.getByLabel('Valor (R$)', { exact: true }).fill(amount)
    await page.getByRole('button', { name: 'Salvar transação' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 30000 })
  }
  const expense = ok(
    await a
      .from('transactions')
      .select('*')
      .eq('title', `QA gasto ${suffix}`)
      .single(),
  )
  expect(expense.source).toBe('app')
  expect(expense.date).toBe(today())
  expect(Number(expense.amount)).toBe(45.9)
  await page.goto('/#transacoes')
  await page
    .getByRole('button', { name: `Editar QA gasto ${suffix}`, exact: true })
    .click()
  await page.getByLabel('Valor (R$)', { exact: true }).fill('50')
  await page.getByRole('button', { name: 'Salvar transação' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 30000 })
  expect(
    Number(
      ok(
        await a
          .from('transactions')
          .select('amount')
          .eq('id', expense.id)
          .single(),
      ).amount,
    ),
  ).toBe(50)
  await page.goto('/#metas')
  await page.getByRole('button', { name: 'Nova meta', exact: true }).click()
  await page.getByLabel('Nome da meta').fill(`QA meta ${suffix}`)
  await page.getByLabel('Objetivo (R$)').fill('200')
  await page.getByLabel('Já reservado (R$)').fill('150')
  await page.getByRole('button', { name: 'Salvar meta' }).click()
  await expect(
    page.getByRole('heading', { name: `QA meta ${suffix}`, exact: true }),
  ).toBeVisible({ timeout: 30000 })
  await page
    .getByRole('button', { name: `Editar meta QA meta ${suffix}`, exact: true })
    .click()
  await page.getByLabel('Já reservado (R$)').fill('170')
  await page.getByRole('button', { name: 'Salvar meta' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 30000 })
  const goal = ok(
    await a.from('goals').select('*').eq('title', `QA meta ${suffix}`).single(),
  )
  expect(Number(goal.current_amount)).toBe(170)
  await page.goto('/#notificacoes')
  await expect(
    page.getByRole('button', { name: 'Marcar como lida' }).first(),
  ).toBeVisible({ timeout: 30000 })
  await page.getByRole('button', { name: 'Marcar como lida' }).first().click()
  await expect
    .poll(
      async () =>
        ok(await a.from('notifications').select('id').eq('read', true)).length,
    )
    .toBeGreaterThan(0)
  // Every private table must hide user A's rows from authenticated user B.
  for (const table of [
    'profiles',
    'transactions',
    'goals',
    'notifications',
    'user_preferences',
    'user_financial_profiles',
  ]) {
    const owner = table === 'profiles' ? 'id' : 'user_id'
    expect(
      ok(await b.from(table).select('*').eq(owner, authA.user.id)),
    ).toEqual([])
    const attack = await b
      .from(table)
      .insert({
        [owner]: authA.user.id,
        ...(table === 'profiles'
          ? { nome: 'Denied' }
          : table === 'transactions'
            ? {
                type: 'expense',
                title: 'Denied',
                amount: 1,
                date: today(),
                source: 'app',
              }
            : table === 'goals'
              ? { title: 'Denied', target_amount: 1 }
              : table === 'notifications'
                ? { title: 'Denied', message: 'Denied' }
                : {}),
      })
    expect(attack.error?.code).toBe('42501')
    expect(
      ok(await b.from(table).delete().eq(owner, authA.user.id).select()),
    ).toEqual([])
  }
  expect(
    ok(
      await b
        .from('transactions')
        .update({ title: 'Denied' })
        .eq('id', expense.id)
        .select(),
    ),
  ).toEqual([])
  ok(
    await a
      .from('user_preferences')
      .upsert({ user_id: authA.user.id, notifications_enabled: true }),
  )
  expect(
    (
      await a
        .from('user_preferences')
        .update({ plan: 'PREMIUM' })
        .eq('user_id', authA.user.id)
    ).error,
  ).toBeTruthy()
  for (const [route, heading] of [
    ['dashboard', /Olá, Validação/],
    ['relatorios', 'Relatórios'],
    ['inteligencia', 'Inteligência financeira'],
    ['perfil', 'Meu perfil'],
    ['educacao', 'Aprender para conquistar'],
  ]) {
    await page.goto(`/#${route}`)
    await expect(
      page.getByRole('heading', {
        name: heading,
        exact: typeof heading === 'string',
      }),
    ).toBeVisible({ timeout: 30000 })
    await expect(page.locator('[role="alert"]')).toHaveCount(0)
  }
  const analysis = await page.evaluate(async () => {
    const { supabase } = await import('/src/supabase/client.js')
    const { createTransactionService } =
      await import('/src/services/transactionService.js')
    const { analyzeFinance } =
      await import('/src/services/financialEngineService.js')
    const { monthKey } = await import('/src/utils/date.js')
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const rows = await createTransactionService(supabase).list(session.user.id)
    const analysis = analyzeFinance(rows, {}, [], monthKey())
    return {
      sessionPresent: !!session,
      rows: rows.length,
      score: analysis.score.value,
      insights: analysis.insights.length,
    }
  })
  expect(analysis.sessionPresent).toBe(true)
  expect(analysis.score).not.toBeNull()
  expect(analysis.insights).toBeGreaterThan(0)
  await page.goto('/#transacoes')
  await page
    .getByRole('button', { name: `Arquivar QA gasto ${suffix}`, exact: true })
    .click()
  await page.getByRole('button', { name: 'Confirmar arquivamento' }).click()
  await expect(
    page.getByText(`QA gasto ${suffix}`, { exact: true }),
  ).toHaveCount(0)
  expect(
    ok(
      await a
        .from('transactions')
        .select('archived_at')
        .eq('id', expense.id)
        .single(),
    ).archived_at,
  ).toBeTruthy()
  await page.goto('/#metas')
  await page
    .getByRole('button', { name: `Editar meta QA meta ${suffix}`, exact: true })
    .click()
  await page.getByLabel('Situação').selectOption('archived')
  await page.getByRole('button', { name: 'Salvar meta' }).click()
  await expect(
    page.getByRole('heading', { name: `QA meta ${suffix}`, exact: true }),
  ).toHaveCount(0)
  expect(
    ok(await a.from('goals').select('archived_at').eq('id', goal.id).single())
      .archived_at,
  ).toBeTruthy()
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Bom ter você de volta.' }),
  ).toBeVisible()
  await page.getByLabel('E-mail', { exact: true }).fill(accounts.a.email)
  await page.getByLabel('Senha', { exact: true }).fill(accounts.a.password)
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click()
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 30000 })
  expect(errors).toEqual([])
  expect(unexpectedResponses).toEqual([])
  await a.auth.signOut()
  await b.auth.signOut()
})
