import { secureEqual, digest } from './meta.js'
import { parseMessage } from '../../../src/integrations/whatsapp/messageParser.js'

const reply = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
export function createWebhookHandler({
  gateway,
  configured,
  verifyToken,
  enqueue,
  observe,
  defer,
}) {
  return async (request) => {
    const url = new URL(request.url)
    if (request.method === 'GET') {
      if (
        gateway.name === 'meta' &&
        verifyToken &&
        url.searchParams.get('hub.mode') === 'subscribe' &&
        secureEqual(url.searchParams.get('hub.verify_token'), verifyToken)
      )
        return new Response(url.searchParams.get('hub.challenge') || '', {
          headers: { 'Cache-Control': 'no-store' },
        })
      return reply({ error: 'Verification failed' }, 403)
    }
    if (request.method !== 'POST')
      return reply({ error: 'Method not allowed' }, 405)
    if (!configured)
      return reply({ error: 'WhatsApp configuration pending' }, 503)
    const reader = request.body?.getReader()
    if (!reader) return reply({ error: 'Missing body' }, 400)
    let size = 0
    const chunks = []
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > 262144) {
          await reader.cancel()
          return reply({ error: 'Body too large' }, 413)
        }
        chunks.push(value)
      }
    } catch {
      return reply({ error: 'Invalid body' }, 400)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.length
    }
    if (!(await gateway.verifyWebhook(bytes, request.headers)))
      return reply({ error: 'Invalid signature' }, 401)
    let payload
    try {
      payload = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      )
    } catch {
      return reply({ error: 'Invalid JSON' }, 400)
    }
    try {
      const messages = gateway.normalizeWebhook
        ? await gateway.normalizeWebhook(payload)
        : gateway.normalizeIncomingMessage(payload)
      await observe(payload)
      for (const msg of messages) {
        const parsed = parseMessage(msg.text)
        await enqueue({
          p_provider: gateway.name,
          p_provider_id: msg.messageId,
          p_wa_id: msg.sender,
          p_text: msg.text,
          p_link_hash:
            parsed.intent === 'link' ? await digest(parsed.code) : null,
          p_sent_at: msg.sentAt,
        })
      }
      if (messages.length) defer()
      return reply({ received: true })
    } catch {
      return reply({ error: 'Message processing unavailable' }, 503)
    }
  }
}
