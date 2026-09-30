import { normalizeMeta, verifySignature } from '../meta.js'

export class MetaWhatsAppProvider {
  constructor(env, fetchImpl = fetch) {
    this.name = 'meta'
    this.env = env
    this.fetch = fetchImpl
  }
  normalizeIncomingMessage(payload) {
    return normalizeMeta(
      payload,
      this.env('WHATSAPP_PHONE_NUMBER_ID'),
      this.env('WHATSAPP_BUSINESS_ACCOUNT_ID'),
    )
  }
  getSenderId(payload) {
    return this.normalizeIncomingMessage(payload)[0]?.sender || null
  }
  getMessageId(payload) {
    return this.normalizeIncomingMessage(payload)[0]?.messageId || null
  }
  verifyWebhook(bytes, headers) {
    return verifySignature(
      bytes,
      headers.get('x-hub-signature-256'),
      this.env('META_APP_SECRET'),
    )
  }
  async getSessionStatus() {
    return { status: 'NOT_APPLICABLE' }
  }
  send(to, text) {
    return this.sendText(to, text)
  }
  sendMessage({ to, text }) {
    return this.sendText(to, text)
  }
  async sendText(to, body) {
    const version = this.env('WHATSAPP_GRAPH_API_VERSION') || 'v23.0'
    if (!/^v\d+\.0$/.test(version)) throw new Error('Invalid Graph version')
    const response = await this.fetch(
      `https://graph.facebook.com/${version}/${this.env('WHATSAPP_PHONE_NUMBER_ID')}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.env('WHATSAPP_ACCESS_TOKEN')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { body, preview_url: false },
        }),
        signal: AbortSignal.timeout(12000),
        redirect: 'error',
      },
    )
    if (!response.ok) throw new Error('Meta delivery failed')
    const data = await response.json()
    if (!data.messages?.[0]?.id) throw new Error('Missing Meta acknowledgement')
    return data.messages[0].id
  }
}
