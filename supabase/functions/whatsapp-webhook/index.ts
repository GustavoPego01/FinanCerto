import {
  admin,
  configured,
  env,
  drain,
  provider,
  activeProvider,
  json,
} from '../_shared/runtime.ts'
import { createWebhookHandler } from '../_shared/webhook.js'
import { rpc } from '../../../src/integrations/whatsapp/whatsappService.js'
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

Deno.serve(async (request) => {
  try {
    const handler = createWebhookHandler({
      gateway: provider(),
      configured: configured(),
      verifyToken: env('WHATSAPP_VERIFY_TOKEN'),
      enqueue: (args: Record<string, unknown>) =>
        rpc(admin(), 'fc_wa_enqueue_provider', args),
      observe: async (payload: {
        session?: string
        event?: string
        payload?: { status?: string }
      }) => {
        if (
          activeProvider() === 'waha' &&
          payload?.session === env('WAHA_SESSION') &&
          ['message', 'session.status'].includes(payload?.event || '')
        ) {
          await rpc(admin(), 'fc_wa_webhook_seen', { p_provider: 'waha' })
          if (
            payload.event === 'session.status' &&
            [
              'WORKING',
              'STOPPED',
              'FAILED',
              'STARTING',
              'SCAN_QR_CODE',
            ].includes(payload.payload?.status || '')
          )
            console.info('WAHA session status:', payload.payload?.status)
        }
      },
      defer: () =>
        EdgeRuntime.waitUntil(
          drain().catch(() =>
            console.error('WhatsApp background processing deferred'),
          ),
        ),
    })
    return await handler(request)
  } catch {
    return json({ error: 'Webhook unavailable' }, 503)
  }
})
