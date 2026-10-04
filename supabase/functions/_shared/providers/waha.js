// Server-side transport only. No financial decisions belong in a provider.
export class WahaWhatsAppProvider {
  constructor({
    baseUrl,
    apiKey,
    session = 'default',
    webhookSecret,
    fetchImpl = fetch,
  }) {
    this.name = 'waha'
    this.baseUrl = baseUrl?.replace(/\/$/, '')
    this.apiKey = apiKey
    this.session = session
    this.webhookSecret = webhookSecret
    this.fetch = fetchImpl
  }

  async request(path, body) {
    const url = new URL(this.baseUrl)
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error('Invalid WAHA URL')
    if (!this.apiKey) throw new Error('WAHA not configured')
    const response = await this.fetch(`${this.baseUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(12000),
      redirect: 'error',
    })
    if (!response.ok)
      throw Object.assign(new Error('WAHA request failed'), {
        status: response.status,
        retryable: response.status === 429,
        deliveryUnknown: response.status >= 500,
      })
    return response.status === 204 ? {} : response.json()
  }

  async sendText(to, text) {
    if (
      !/^[1-9]\d{7,14}$/.test(to) ||
      typeof text !== 'string' ||
      !text ||
      text.length > 3500
    )
      throw new Error('Invalid outgoing message')
    const data = await this.request('/api/sendText', {
      session: this.session,
      chatId: `${to}@c.us`,
      text,
      linkPreview: false,
    })
    const id =
      typeof data.id === 'string'
        ? data.id
        : data.id?._serialized || data.key?.id
    if (!id) throw new Error('Missing WAHA acknowledgement')
    return id
  }
  send(to, text) {
    return this.sendText(to, text)
  }
  sendMessage({ to, text }) {
    return this.sendText(to, text)
  }
  getSessionStatus() {
    return this.request(`/api/sessions/${encodeURIComponent(this.session)}`)
  }
  startSession() {
    return this.request(
      `/api/sessions/${encodeURIComponent(this.session)}/start`,
      {},
    )
  }
  restartSession() {
    return this.request(
      `/api/sessions/${encodeURIComponent(this.session)}/restart`,
      {},
    )
  }
  getQrCode() {
    return this.request(
      `/api/${encodeURIComponent(this.session)}/auth/qr?format=image`,
    )
  }
  createSession(webhookUrl) {
    if (!this.webhookSecret || new URL(webhookUrl).protocol !== 'https:')
      throw new Error('Secure webhook required')
    return this.request('/api/sessions', {
      name: this.session,
      start: true,
      config: {
        noweb: { store: { enabled: true, fullSync: false } },
        webhooks: [
          {
            url: webhookUrl,
            events: ['message', 'session.status'],
            hmac: { key: this.webhookSecret },
            retries: { delaySeconds: 2, attempts: 5, policy: 'exponential' },
          },
        ],
      },
    })
  }
  async verifyWebhook(bytes, headers) {
    const signature = headers.get('x-webhook-hmac') || ''
    if (
      !this.webhookSecret ||
      headers.get('x-webhook-hmac-algorithm') !== 'sha512' ||
      !/^[a-f0-9]{128}$/i.test(signature)
    )
      return false
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.webhookSecret),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['verify'],
    )
    return crypto.subtle.verify(
      'HMAC',
      key,
      Uint8Array.from(signature.match(/../g), (byte) => parseInt(byte, 16)),
      bytes,
    )
  }
  getSenderId(payload) {
    // LIDs are opaque identifiers, never phone numbers. Fail closed.
    const from = payload?.payload?.from
    return typeof from === 'string' &&
      /^[1-9]\d{7,14}@(c\.us|s\.whatsapp\.net)$/.test(from)
      ? from.split('@')[0]
      : null
  }
  getMessageId(payload) {
    const id = payload?.payload?.id
    return typeof id === 'string' &&
      id.length > 0 &&
      id.length <= 250 &&
      !/\s/.test(id) &&
      !Array.from(id).some((char) => char.charCodeAt(0) < 32)
      ? `waha:${this.session}:${id}`
      : null
  }
  normalizeIncomingMessage(payload) {
    if (payload?.session !== this.session || payload?.event !== 'message')
      return []
    const msg = payload.payload,
      sender = this.getSenderId(payload),
      messageId = this.getMessageId(payload)
    if (
      !sender ||
      !messageId ||
      messageId.length > 300 ||
      msg.fromMe !== false ||
      msg.from_me === true ||
      msg.key?.fromMe === true ||
      msg._data?.key?.fromMe === true ||
      msg.from === payload.me?.id ||
      msg.hasMedia === true ||
      typeof msg.body !== 'string' ||
      !msg.body.trim() ||
      msg.body.length > 1000 ||
      !Number.isSafeInteger(msg.timestamp) ||
      msg.timestamp < 1000000000 ||
      msg.timestamp > 9999999999
    )
      return []
    return [
      {
        provider: 'waha',
        messageId,
        sender,
        senderId: msg.from,
        senderPhone: sender,
        text: msg.body.trim(),
        type: 'text',
        sentAt: new Date(msg.timestamp * 1000).toISOString(),
      },
    ]
  }
  async normalizeWebhook(payload) {
    const direct = this.normalizeIncomingMessage(payload)
    if (
      direct.length ||
      payload?.session !== this.session ||
      payload?.event !== 'message' ||
      payload?.payload?.fromMe !== false ||
      !/^\d{5,25}@lid$/.test(payload?.payload?.from || '')
    )
      return direct
    const lid = payload.payload.from
    const mapping = await this.request(
      `/api/${encodeURIComponent(this.session)}/lids/${encodeURIComponent(lid)}`,
    )
    if (
      mapping?.lid !== lid ||
      !/^[1-9]\d{7,14}@c\.us$/.test(mapping?.pn || '')
    )
      throw new Error('WAHA sender mapping unavailable')
    return this.normalizeIncomingMessage({
      ...payload,
      payload: { ...payload.payload, from: mapping.pn },
    })
  }
}
