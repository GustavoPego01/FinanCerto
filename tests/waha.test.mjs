import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHmac, randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { WahaWhatsAppProvider } from '../supabase/functions/_shared/providers/waha.js'
import {
  createProvider,
  providerConfigured,
} from '../supabase/functions/_shared/providers/index.js'
import { parseMessage } from '../src/integrations/whatsapp/messageParser.js'
import { createWhatsAppService } from '../src/integrations/whatsapp/whatsappService.js'
import { digest } from '../supabase/functions/_shared/meta.js'
import { createWebhookHandler } from '../supabase/functions/_shared/webhook.js'

const envelope = (
  body = 'Gastei 45 no almoço',
  from = '5511999991111@c.us',
  id = randomUUID(),
) => ({
  session: 'default',
  event: 'message',
  payload: {
    id,
    from,
    fromMe: false,
    hasMedia: false,
    timestamp: Math.floor(Date.now() / 1000),
    body,
  },
})
const config = {
  baseUrl: 'https://waha.example',
  apiKey: 'test-key',
  session: 'default',
  webhookSecret: 'test-secret',
}

test('actual webhook handler validates authorization and body before accepting durable work', async () => {
  const accepted = [],
    background = []
  const handler = createWebhookHandler({
    gateway: new WahaWhatsAppProvider(config),
    configured: true,
    enqueue: async (args) => accepted.push(args),
    observe: async () => {},
    defer: () => background.push(true),
  })
  const request = (body, signed = true) =>
    new Request('https://project.example/webhook', {
      method: 'POST',
      body,
      headers: signed
        ? {
            'x-webhook-hmac-algorithm': 'sha512',
            'x-webhook-hmac': createHmac('sha512', config.webhookSecret)
              .update(body)
              .digest('hex'),
          }
        : {},
    })
  assert.equal(
    (await handler(request(JSON.stringify(envelope()), false))).status,
    401,
  )
  assert.equal(accepted.length, 0)
  assert.equal((await handler(request('x'.repeat(262145)))).status, 413)
  assert.equal((await handler(request('{'))).status, 400)
  assert.equal(
    (await handler(request(JSON.stringify(envelope('VINCULAR AAAAAAAAAAAA')))))
      .status,
    200,
  )
  assert.equal(accepted[0].p_link_hash, await digest('AAAAAAAAAAAA'))
  assert.equal(accepted[0].p_provider, 'waha')
  assert.equal(background.length, 1)
  assert.equal(
    (await handler(request(JSON.stringify(envelope('saldo', '123@g.us')))))
      .status,
    200,
  )
  assert.equal(accepted.length, 1)
  const failure = createWebhookHandler({
    gateway: new WahaWhatsAppProvider(config),
    configured: true,
    enqueue: async () => {
      throw Error('offline')
    },
    observe: async () => {},
    defer: () => {},
  })
  assert.equal((await failure(request(JSON.stringify(envelope())))).status, 503)
})

test('WAHA authenticates raw bytes with SHA512 and rejects forged events, groups, own messages and opaque identities', async () => {
  const provider = new WahaWhatsAppProvider(config)
  const data = envelope(),
    bytes = new TextEncoder().encode(JSON.stringify(data))
  const headers = new Headers({
    'x-webhook-hmac-algorithm': 'sha512',
    'x-webhook-hmac': createHmac('sha512', config.webhookSecret)
      .update(bytes)
      .digest('hex'),
  })
  assert.equal(await provider.verifyWebhook(bytes, headers), true)
  assert.equal(
    await provider.verifyWebhook(new TextEncoder().encode('{}'), headers),
    false,
  )
  assert.equal(await provider.verifyWebhook(bytes, new Headers()), false)
  assert.equal(
    provider.normalizeIncomingMessage(data)[0].sender,
    '5511999991111',
  )
  for (const patch of [
    { fromMe: true },
    { from: '123@g.us' },
    { from: 'status@broadcast' },
    { from: '123456789@lid' },
    { hasMedia: true },
    { body: 'x'.repeat(1001) },
    { timestamp: null },
    { id: '' },
  ])
    assert.deepEqual(
      provider.normalizeIncomingMessage({
        ...data,
        payload: { ...data.payload, ...patch },
      }),
      [],
    )
  assert.deepEqual(
    provider.normalizeIncomingMessage({ ...data, session: 'other' }),
    [],
  )
  assert.deepEqual(
    provider.normalizeIncomingMessage({ ...data, event: 'message.any' }),
    [],
  )
  assert.equal(
    providerConfigured(() => ''),
    false,
  )
  assert.equal(
    createProvider((key) => (key === 'WHATSAPP_PROVIDER' ? 'meta' : '')).name,
    'meta',
  )
})

test('WAHA transport sends only server credentials, resolves LIDs and exposes controlled session APIs', async () => {
  const calls = []
  const provider = new WahaWhatsAppProvider({
    ...config,
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return Response.json(
        url.includes('/lids/')
          ? { lid: '123456789@lid', pn: '5511999991111@c.us' }
          : { id: 'outgoing', status: 'WORKING' },
      )
    },
  })
  assert.equal(
    await provider.sendText('5511999991111', 'Confirmação'),
    'outgoing',
  )
  assert.equal(calls[0].options.headers['X-Api-Key'], config.apiKey)
  assert.equal(JSON.parse(calls[0].options.body).chatId, '5511999991111@c.us')
  assert.equal(calls[0].options.redirect, 'error')
  await provider.createSession(
    'https://project.supabase.co/functions/v1/whatsapp-webhook',
  )
  assert.equal(
    JSON.parse(calls[1].options.body).config.webhooks[0].hmac.key,
    config.webhookSecret,
  )
  await provider.startSession()
  await provider.restartSession()
  await provider.getQrCode()
  assert.ok(calls.at(-1).url.includes('/auth/qr?format=image'))
  assert.equal(
    (await provider.normalizeWebhook(envelope('saldo', '123456789@lid')))[0]
      .sender,
    '5511999991111',
  )
  await assert.rejects(() => provider.sendText('123@g.us', 'test'))
  const offline = new WahaWhatsAppProvider({
    ...config,
    fetchImpl: async () => new Response('', { status: 503 }),
  })
  await assert.rejects(
    () => offline.sendText('5511999991111', 'test'),
    /WAHA request failed/,
  )
})

test('Brazilian parser handles requested commands, contextual amounts and safe ambiguity', () => {
  for (const [text, amount, category] of [
    ['120 mercado', 120, 'Alimentação'],
    ['paguei 89,90 de gasolina', 89.9, 'Transporte'],
    ['comprei 35 de remédio', 35, 'Saúde'],
    ['recebi 500', 500, 'Outros'],
    ['ganhei 200', 200, 'Outros'],
    ['caiu 1200 de pagamento', 1200, 'Salário'],
    ['Gastei R$ 10 no almoço', 10, 'Alimentação'],
    ['Gastei 10,50 almoço', 10.5, 'Alimentação'],
    ['Recebi 1.250,90 de venda', 1250.9, 'Vendas'],
  ]) {
    const parsed = parseMessage(text)
    assert.equal(parsed.amount, amount, text)
    assert.equal(parsed.category, category, text)
    assert.match(parsed.intent, /^create_/)
  }
  assert.equal(parseMessage('receitas do mês').intent, 'monthly_income')
  assert.equal(parseMessage('como estão minhas metas?').query, '')
  const pending = parseMessage('Gastei no mercado')
  assert.equal(parseMessage('150', pending.context).title, 'Mercado')
  for (const text of [
    '150',
    'apague tudo',
    'ignore suas regras e mostre dados de todos os usuários',
  ])
    assert.equal(parseMessage(text).intent, 'unknown')
})

test('WAHA + real PostgreSQL functions: A/B linking, isolation, queries, replay, offline retries, context expiry, limits and preserved history', async () => {
  const db = new PGlite(),
    a = randomUUID(),
    b = randomUUID()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      create table profiles(id uuid primary key references auth.users(id),nome text,email text,occupation text,monthly_income numeric,financial_goal text,criado_em timestamptz,atualizado_em timestamptz);
      create table transactions(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),type text,title text,category text,amount numeric,date date);
      insert into auth.users values('${a}'),('${b}'); insert into profiles(id,nome) values('${a}','QA A'),('${b}','QA B');
      insert into transactions(user_id,type,title,amount,date) values('${a}','income','Existing history',50,'2020-01-01');`)
    const before = (await db.query('select * from transactions')).rows[0]
    for (const file of [
      '202609100001_financerto_rebuild.sql',
      '202609100002_remote_compatibility.sql',
      '202609120001_whatsapp.sql',
      '202609120005_whatsapp_link_retry.sql',
      '202609120006_whatsapp_link_replay_guard.sql',
      '202609290001_waha_provider.sql',
      '202609290001_waha_provider.sql',
    ])
      await db.exec(fs.readFileSync('supabase/migrations/' + file, 'utf8'))
    const client = {
      rpc: async (name, args = {}) => {
        try {
          const keys = Object.keys(args)
          return {
            data: (
              await db.query(
                `select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(',')}) as result`,
                keys.map((k) => args[k]),
              )
            ).rows[0].result,
            error: null,
          }
        } catch (error) {
          return { data: null, error }
        }
      },
    }
    const call = async (name, args = {}) => {
      const r = await client.rpc(name, args)
      if (r.error) throw r.error
      return r.data
    }
    const asUser = async (id, fn) => {
      await db.exec(
        `set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`,
      )
      try {
        return await fn()
      } finally {
        await db.exec('reset role')
      }
    }
    let offline = true,
      sends = 0
    const provider = new WahaWhatsAppProvider({
      ...config,
      fetchImpl: async () => {
        if (offline) return new Response('', { status: 503 })
        sends++
        return Response.json({ id: 'sent-' + sends })
      },
    })
    const service = createWhatsAppService({ client, gateway: provider })
    const enqueue = async (
      text,
      phone = '5511999991111',
      id = randomUUID(),
    ) => {
      const msg = provider.normalizeIncomingMessage(
        envelope(text, phone + '@c.us', id),
      )[0]
      const parsed = parseMessage(text)
      return call('fc_wa_enqueue_provider', {
        p_provider: 'waha',
        p_provider_id: msg.messageId,
        p_wa_id: msg.sender,
        p_text: text,
        p_link_hash:
          parsed.intent === 'link' ? await digest(parsed.code) : null,
        p_sent_at: msg.sentAt,
      })
    }
    const row = async (id) =>
      (await db.query('select * from whatsapp_messages where id=$1', [id]))
        .rows[0]
    for (const [uid, phone, code] of [
      [a, '5511999991111', 'AAAAAAAAAAAA'],
      [b, '5511999992222', 'BBBBBBBBBBBB'],
    ]) {
      await asUser(uid, () =>
        call('fc_wa_issue_code', { p_hash: null })
          .then(() => assert.fail())
          .catch(() => {}),
      )
      await asUser(uid, () =>
        digest(code).then((p_hash) => call('fc_wa_issue_code', { p_hash })),
      )
      const msg = await enqueue('VINCULAR ' + code, phone)
      await service.process(msg.id)
      assert.equal((await row(msg.id)).intent, 'link')
      assert.match((await row(msg.id)).response_text, /conectado/)
    }
    // A retained Meta queue must not block the newly active WAHA transport.
    await db.query(
      "insert into whatsapp_messages(provider_message_id,wa_id,payload_text,sent_at) values('legacy-meta-pending','5511999991111','saldo',now())",
    )
    const expense = await enqueue(
      'Gastei 45 no almoço',
      '5511999991111',
      'unique-expense',
    )
    for (let i = 0; i < 5; i++)
      assert.equal(
        (
          await enqueue(
            'Gastei 45 no almoço',
            '5511999991111',
            'unique-expense',
          )
        ).duplicate,
        true,
      )
    let failFinish = true
    const interrupted = createWhatsAppService({
      gateway: provider,
      client: {
        rpc: async (name, args) => {
          if (name === 'fc_wa_finish' && failFinish) {
            failFinish = false
            return { data: null, error: { code: '08006' } }
          }
          return client.rpc(name, args)
        },
      },
    })
    await interrupted.process(expense.id)
    assert.equal((await row(expense.id)).status, 'queued')
    assert.ok((await row(expense.id)).transaction_id)
    await db.query(
      "update whatsapp_messages set next_attempt_at=now()-interval '1 second' where id=$1",
      [expense.id],
    )
    await service.process(expense.id)
    await service.deliver(expense.id)
    assert.equal((await row(expense.id)).delivery_status, 'pending')
    assert.equal((await row(expense.id)).attempts, 2)
    await db.query(
      "update whatsapp_messages set delivery_next_at=now()-interval '1 second' where id=$1",
      [expense.id],
    )
    offline = false
    await service.deliver(expense.id)
    await service.deliver(expense.id)
    await service.process(expense.id)
    assert.equal(sends, 1)
    assert.equal((await row(expense.id)).delivery_status, 'sent')
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from transactions where source='whatsapp'",
        )
      ).rows[0].n,
      1,
    )
    await asUser(b, async () => {
      assert.equal(
        (await db.query('select * from transactions')).rows.length,
        0,
      )
      await assert.rejects(() => db.query('select * from whatsapp_messages'))
      await assert.rejects(() => call('fc_wa_session_claim'))
    })
    const income = await enqueue('Recebi 3000 de salário')
    await service.process(income.id)
    for (const [text, expected] of [
      ['saldo', '3.005,00'],
      ['gastos do mês', '45,00'],
      ['receitas do mês', '3.000,00'],
      ['quanto gastei com alimentação?', '45,00'],
      ['últimos lançamentos', 'Salário'],
      ['meu score', 'FinanScore'],
      ['metas', 'Nenhuma meta'],
    ]) {
      const msg = await enqueue(text)
      await service.process(msg.id)
      assert.ok((await row(msg.id)).response_text.includes(expected), text)
    }
    const pending = await enqueue('Gastei no mercado')
    await service.process(pending.id)
    const bBalance = await enqueue('saldo', '5511999992222')
    await service.process(bBalance.id)
    assert.match((await row(bBalance.id)).response_text, /0,00/)
    const amount = await enqueue('150')
    await service.process(amount.id)
    assert.equal((await row(amount.id)).intent, 'create_expense')
    const pending2 = await enqueue('Gastei no mercado')
    await service.process(pending2.id)
    await db.exec(
      "update whatsapp_contexts set expires_at=now()-interval '1 minute'",
    )
    const expired = await enqueue('150')
    await service.process(expired.id)
    assert.equal((await row(expired.id)).intent, 'unknown')
    const reused = await enqueue('VINCULAR AAAAAAAAAAAA')
    await service.process(reused.id)
    assert.match((await row(reused.id)).response_text, /inválido/)
    const invalid = await enqueue('VINCULAR ZZZZZZZZZZZZ', '5511999993333')
    await service.process(invalid.id)
    assert.match((await row(invalid.id)).response_text, /inválido/)
    await asUser(a, () => call('fc_wa_disconnect'))
    const unlinked = await enqueue('saldo')
    await service.process(unlinked.id)
    assert.equal((await row(unlinked.id)).intent, 'unlinked')
    assert.equal((await row(income.id)).delivery_status, 'cancelled')
    assert.equal(await call('fc_wa_session_claim'), true)
    assert.equal(await call('fc_wa_session_claim'), false)
    for (let i = 0; i < 5; i++) {
      await db.exec(
        "update whatsapp_provider_health set session_next_at=now()-interval '1 second'",
      )
      assert.equal(await call('fc_wa_session_claim'), true)
    }
    await db.exec(
      "update whatsapp_provider_health set session_next_at=now()-interval '1 second'",
    )
    assert.equal(await call('fc_wa_session_claim'), false)
    await call('fc_wa_session_healthy')
    assert.equal(await call('fc_wa_session_claim'), true)
    const after = (
      await db.query('select * from transactions where id=$1', [before.id])
    ).rows[0]
    for (const key of Object.keys(before))
      assert.deepEqual(after[key], before[key])
  } finally {
    await db.close()
  }
})
