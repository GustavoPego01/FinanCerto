import { admin, configured, env, drain, json } from '../_shared/runtime.ts'
import {
  verifySignature,
  secureEqual,
  normalizeMeta,
  digest,
} from '../_shared/meta.js'
import { parseMessage } from '../../../src/integrations/whatsapp/messageParser.js'
import { rpc } from '../../../src/integrations/whatsapp/whatsappService.js'
Deno.serve(async (request) => {
  const url = new URL(request.url)
  if (request.method === 'GET') {
    if (
      env('WHATSAPP_VERIFY_TOKEN') &&
      url.searchParams.get('hub.mode') === 'subscribe' &&
      secureEqual(
        url.searchParams.get('hub.verify_token'),
        env('WHATSAPP_VERIFY_TOKEN'),
      )
    )
      return new Response(url.searchParams.get('hub.challenge') || '', {
        headers: { 'Cache-Control': 'no-store' },
      })
    return json({ error: 'Verification failed' }, 403)
  }
  if (request.method !== 'POST')
    return json({ error: 'Method not allowed' }, 405)
  if (!configured()) return json({ error: 'Meta configuration pending' }, 503)
  // Bound the streaming body before decoding or parsing it.
  const reader = request.body?.getReader()
  if (!reader) return json({ error: 'Missing body' }, 400)
  let size = 0
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > 262144) {
      await reader.cancel()
      return json({ error: 'Body too large' }, 413)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  if (
    !(await verifySignature(
      bytes,
      request.headers.get('x-hub-signature-256'),
      env('META_APP_SECRET'),
    ))
  )
    return json({ error: 'Invalid signature' }, 401)
  try {
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    const messages = normalizeMeta(
      JSON.parse(raw),
      env('WHATSAPP_PHONE_NUMBER_ID'),
      env('WHATSAPP_BUSINESS_ACCOUNT_ID'),
    )
    const client = admin()
    for (const msg of messages) {
      const parsed = parseMessage(msg.text)
      await rpc(client, 'fc_wa_enqueue', {
        p_provider_id: msg.messageId,
        p_wa_id: msg.sender,
        p_text: msg.text,
        p_link_hash:
          parsed.intent === 'link' ? await digest(parsed.code) : null,
        p_sent_at: msg.sentAt,
      })
    }
    EdgeRuntime.waitUntil(
      drain().catch(() =>
        console.error('WhatsApp background processing deferred'),
      ),
    )
    return json({ received: true })
  } catch {
    return json({ error: 'Message processing unavailable' }, 503)
  }
})
