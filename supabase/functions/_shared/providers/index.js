import { WahaWhatsAppProvider } from './waha.js'
import { MetaWhatsAppProvider } from './meta.js'

export const providerName = (env) => env('WHATSAPP_PROVIDER') || 'waha'
export function providerConfigured(env) {
  const name = providerName(env)
  const keys =
    name === 'waha'
      ? ['WAHA_BASE_URL', 'WAHA_API_KEY', 'WAHA_SESSION', 'WAHA_WEBHOOK_SECRET']
      : name === 'meta'
        ? [
            'WHATSAPP_ACCESS_TOKEN',
            'WHATSAPP_PHONE_NUMBER_ID',
            'WHATSAPP_BUSINESS_ACCOUNT_ID',
            'META_APP_SECRET',
            'WHATSAPP_VERIFY_TOKEN',
          ]
        : []
  return keys.length > 0 && keys.every((key) => !!env(key))
}
export function createProvider(env, fetchImpl = fetch) {
  if (providerName(env) === 'meta')
    return new MetaWhatsAppProvider(env, fetchImpl)
  if (providerName(env) !== 'waha') throw new Error('Unknown WhatsApp provider')
  return new WahaWhatsAppProvider({
    baseUrl: env('WAHA_BASE_URL'),
    apiKey: env('WAHA_API_KEY'),
    session: env('WAHA_SESSION'),
    webhookSecret: env('WAHA_WEBHOOK_SECRET'),
    fetchImpl,
  })
}
