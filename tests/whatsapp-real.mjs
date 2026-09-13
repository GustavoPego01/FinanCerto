import { createHmac } from 'node:crypto'
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'
import { chromium } from '@playwright/test'
import {
  createWhatsAppService,
  rpc,
} from '../src/integrations/whatsapp/whatsappService.js'
import { digest } from '../supabase/functions/_shared/meta.js'
const env = loadEnv('development', process.cwd(), ''),
  url = env.VITE_SUPABASE_URL,
  accounts = JSON.parse(
    fs.readFileSync('.cache/financerto-live-accounts.json', 'utf8'),
  )
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const a = createClient(
    url,
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY,
    options,
  ),
  b = createClient(
    url,
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY,
    options,
  )
const read = (result) => {
  if (result.error)
    throw new Error('API operation failed: ' + result.error.code)
  return result.data
}
let browser,
  admin,
  activeMessages = [],
  createdTransactions = [],
  channelA,
  channelB
try {
  const keys = JSON.parse(
    execFileSync(
      'cmd.exe',
      [
        '/d',
        '/s',
        '/c',
        'npx.cmd --yes supabase projects api-keys --project-ref fzqstnkrklgficdurqsd --output json',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ),
  )
  admin = createClient(
    url,
    keys.find((k) => k.name === 'service_role').api_key,
    options,
  )
  read(await a.auth.signInWithPassword(accounts.a))
  read(await b.auth.signInWithPassword(accounts.b))
  const aToken = (await a.auth.getSession()).data.session.access_token
  const invoke = async (action) => {
    const response = await fetch(url + '/functions/v1/whatsapp-link', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + aToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action }),
    })
    const data = await response.json()
    assert.equal(
      response.status,
      200,
      JSON.stringify({ status: response.status, error: data.error }),
    )
    return data
  }
  assert.equal((await invoke('status')).configured, false)
  assert.equal(
    (
      await fetch(url + '/functions/v1/whatsapp-link', {
        method: 'POST',
        body: '{}',
      })
    ).status,
    401,
  )
  assert.equal(
    (await fetch(url + '/functions/v1/whatsapp-worker', { method: 'POST' }))
      .status,
    401,
  )
  const secrets = Object.fromEntries(
    fs
      .readFileSync('.cache/whatsapp-server.env', 'utf8')
      .trim()
      .split('\n')
      .map((l) => l.split('=')),
  )
  const challenge = await fetch(
    url +
      '/functions/v1/whatsapp-webhook?' +
      new URLSearchParams({
        'hub.mode': 'subscribe',
        'hub.verify_token': secrets.WHATSAPP_VERIFY_TOKEN,
        'hub.challenge': 'financerto-qa',
      }),
  )
  assert.equal(await challenge.text(), 'financerto-qa')
  const worker = await fetch(url + '/functions/v1/whatsapp-worker', {
    method: 'POST',
    headers: {
      'x-worker-timestamp': String(Math.floor(Date.now() / 1000)),
      'x-worker-signature': createHmac('sha256', secrets.WHATSAPP_WORKER_SECRET)
        .update('financerto-worker:' + Math.floor(Date.now() / 1000))
        .digest('hex'),
    },
  })
  assert.equal(worker.status, 200)
  assert.equal((await worker.json()).configured, false)
  assert.equal(
    (
      await fetch(url + '/functions/v1/whatsapp-webhook', {
        method: 'POST',
        body: '{}',
      })
    ).status,
    503,
  )
  await invoke('disconnect')
  read(
    await admin
      .from('whatsapp_rate_limits')
      .update({ window_start: new Date(Date.now() - 3600000).toISOString() })
      .eq('key', 'link:' + accounts.a.id),
  )
  const link = await invoke('request_code'),
    sender = '155555501' + String(Date.now()).slice(-4),
    prefix = 'financerto-qa-' + Date.now()
  const received = []
  const service = createWhatsAppService({
    client: admin,
    gateway: {
      send: async (to, text) => {
        received.push({ to, text })
        return prefix + '-capture-' + received.length
      },
    },
  })
  const enqueue = async (
    text,
    id = prefix + '-' + crypto.randomUUID(),
    linkHash = null,
  ) => {
    const result = await rpc(admin, 'fc_wa_enqueue', {
      p_provider_id: id,
      p_wa_id: sender,
      p_text: text,
      p_link_hash: linkHash,
      p_sent_at: new Date().toISOString(),
    })
    activeMessages.push(result.id)
    return result
  }
  const message = await enqueue(null, prefix + '-link', await digest(link.code))
  await service.process(message.id)
  await service.deliver(message.id)
  assert.ok(received.at(-1).text.startsWith('WhatsApp vinculado'))
  assert.equal((await invoke('status')).connection.verified, true)
  assert.equal(
    read(
      await b
        .from('whatsapp_connections')
        .select('*')
        .eq('user_id', accounts.a.id),
    ).length,
    0,
  )
  assert.ok((await b.from('whatsapp_messages').select('*')).error)
  assert.ok(
    (
      await b.rpc('fc_wa_snapshot', {
        p_id: message.id,
        p_lease: crypto.randomUUID(),
      })
    ).error,
  )
  const reuse = await enqueue(null, prefix + '-reuse', await digest(link.code))
  await service.process(reuse.id)
  await service.deliver(reuse.id)
  assert.ok(received.at(-1).text.startsWith('Código inválido'))
  let eventsA = 0,
    eventsB = 0
  const subscribe = async (client, name, callback) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Realtime subscribe timed out')),
        20000,
      )
      const channel = client
        .channel(name)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'transactions',
            filter: 'user_id=eq.' + accounts.a.id,
          },
          callback,
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timer)
            resolve(channel)
          }
        })
    })
  channelA = await subscribe(a, prefix + 'a', () => eventsA++)
  channelB = await subscribe(b, prefix + 'b', () => eventsB++)
  process.env.PLAYWRIGHT_BROWSERS_PATH = process.cwd() + '/.cache/ms-playwright'
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
    errors = []
  page.setDefaultTimeout(25000)
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('http://127.0.0.1:4180')
  await page.getByLabel('E-mail', { exact: true }).fill(accounts.a.email)
  await page.getByLabel('Senha', { exact: true }).fill(accounts.a.password)
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click()
  await page
    .getByRole('heading', { name: /Olá, Validação/ })
    .waitFor({ timeout: 30000 })
  const title =
    'Mercado WhatsApp QA ' +
    crypto
      .randomUUID()
      .replace(/[^a-z]/g, '')
      .slice(0, 8)
  const expense = await enqueue('Gastei 50,50 no ' + title, prefix + '-expense')
  await service.process(expense.id)
  const tx = read(
    await a
      .from('transactions')
      .select('*')
      .eq('external_message_id', prefix + '-expense')
      .single(),
  )
  createdTransactions.push(tx.id)
  assert.equal(tx.user_id, accounts.a.id)
  assert.equal(tx.amount, 50.5)
  assert.equal(tx.source, 'whatsapp')
  await page
    .getByText(title, { exact: true })
    .first()
    .waitFor({ timeout: 30000 })
  const realtimeDeadline = Date.now() + 20000
  while (eventsA < 1 && Date.now() < realtimeDeadline)
    await new Promise((resolve) => setTimeout(resolve, 100))
  assert.ok(eventsA >= 1)
  assert.equal(eventsB, 0)
  assert.equal(
    (await enqueue('Gastei 999 no mercado', prefix + '-expense')).duplicate,
    true,
  )
  await service.process(expense.id)
  assert.equal(
    read(
      await a
        .from('transactions')
        .select('id')
        .eq('external_message_id', prefix + '-expense'),
    ).length,
    1,
  )
  let failDelivery = true
  const retryService = createWhatsAppService({
    client: admin,
    gateway: {
      send: async () => {
        if (failDelivery) throw new Error('test transient failure')
        return prefix + '-retry-captured'
      },
    },
  })
  await retryService.deliver(expense.id)
  assert.equal(
    read(
      await admin
        .from('whatsapp_messages')
        .select('delivery_status')
        .eq('id', expense.id)
        .single(),
    ).delivery_status,
    'pending',
  )
  read(
    await admin
      .from('whatsapp_messages')
      .update({ delivery_next_at: new Date(Date.now() - 60000).toISOString() })
      .eq('id', expense.id),
  )
  failDelivery = false
  await retryService.deliver(expense.id)
  assert.equal(
    read(
      await admin
        .from('whatsapp_messages')
        .select('delivery_status')
        .eq('id', expense.id)
        .single(),
    ).delivery_status,
    'sent',
  )
  const pending = await enqueue('Recebi 1500,50')
  await service.process(pending.id)
  await service.deliver(pending.id)
  assert.ok(received.at(-1).text.includes('descrição'))
  const complete = await enqueue('salário QA')
  await service.process(complete.id)
  await service.deliver(complete.id)
  const income = read(
    await a
      .from('transactions')
      .select('*')
      .eq(
        'external_message_id',
        read(
          await admin
            .from('whatsapp_messages')
            .select('provider_message_id')
            .eq('id', complete.id)
            .single(),
        ).provider_message_id,
      )
      .single(),
  )
  createdTransactions.push(income.id)
  assert.equal(income.type, 'income')
  assert.equal(income.amount, 1500.5)
  for (const command of [
    'Quanto tenho de saldo?',
    'Quanto gastei esse mês?',
    'Quanto recebi esse mês?',
    'Quanto gastei em alimentação?',
    'Últimas transações',
    'Meu FinanScore',
    'Como está minha vida financeira?',
    'Quanto falta para minha viagem?',
    'Como está minha meta?',
  ]) {
    const msg = await enqueue(command)
    await service.process(msg.id)
    await service.deliver(msg.id)
    assert.ok(received.at(-1).text.length > 5)
  }
  const after = await enqueue('Quanto tenho de saldo?')
  await service.process(after.id)
  await invoke('disconnect')
  await service.deliver(after.id)
  assert.equal(
    read(
      await admin
        .from('whatsapp_messages')
        .select('delivery_status')
        .eq('id', after.id)
        .single(),
    ).delivery_status,
    'cancelled',
  )
  const unauth = await enqueue('Quanto tenho de saldo?')
  await service.process(unauth.id)
  await service.deliver(unauth.id)
  assert.ok(received.at(-1).text.startsWith('Vincule este número'))
  await page
    .getByRole('button', { name: 'Abrir perfil', exact: true })
    .first()
    .click()
  await page.getByRole('heading', { name: 'WhatsApp', exact: true }).waitFor()
  await page.getByText(/aguardando configuração na Meta/).waitFor()
  assert.equal(errors.length, 0)
  console.log(
    'PASS: real Edge auth/challenge, real single-use link, RLS A/B, expense/income/context, financial queries, dedupe, retry, disconnect, browser Realtime and Profile. Meta send was captured locally, not sent.',
  )
} catch (error) {
  console.error('FAIL:', String(error.message).slice(0, 700))
  process.exitCode = 1
} finally {
  if (admin && createdTransactions.length)
    await a
      .from('transactions')
      .update({ archived_at: new Date().toISOString() })
      .eq('user_id', accounts.a.id)
      .eq('source', 'whatsapp')
      .like('external_message_id', 'financerto-qa-%')
  await a.rpc('fc_wa_disconnect')
  if (browser) await browser.close()
  if (channelA) await a.removeChannel(channelA)
  if (channelB) await b.removeChannel(channelB)
  await a.auth.signOut()
  await b.auth.signOut()
  process.exit(process.exitCode || 0)
}
