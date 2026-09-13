export async function digest(text) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
export function secureEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length)
    return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
export async function verifySignature(raw, signature, secret) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature || '')) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const bytes = Uint8Array.from(signature.slice(7).match(/../g), (x) =>
    parseInt(x, 16),
  )
  return crypto.subtle.verify('HMAC', key, bytes, typeof raw === 'string' ? new TextEncoder().encode(raw) : raw)
}
export function normalizeMeta(payload, phoneId, businessId) {
  if (payload?.object !== 'whatsapp_business_account') return []
  const messages = []
  for (const entry of payload.entry || []) {
    if (entry.id !== businessId) continue
    for (const change of entry.changes || []) {
      if (
        change.field !== 'messages' ||
        change.value?.metadata?.phone_number_id !== phoneId
      )
        continue
      for (const msg of change.value.messages || []) {
        if (
          msg.type !== 'text' ||
          typeof msg.text?.body !== 'string' ||
          msg.text.body.length > 1000 ||
          !/^[1-9][0-9]{7,14}$/.test(msg.from) ||
          typeof msg.id !== 'string' ||
          !msg.id.length ||
          msg.id.length > 300 ||
          !/^\d{10}$/.test(String(msg.timestamp))
        )
          continue
        messages.push({
          messageId: msg.id,
          sender: msg.from,
          text: msg.text.body,
          sentAt: new Date(Number(msg.timestamp) * 1000).toISOString(),
        })
      }
    }
  }
  if (messages.length > 100) throw new Error('Batch too large')
  return messages
}
