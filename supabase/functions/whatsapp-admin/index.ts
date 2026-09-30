import {
  admin,
  env,
  json,
  provider,
  configured,
  activeProvider,
} from '../_shared/runtime.ts'
import { secureEqual } from '../_shared/meta.js'
import { rpc } from '../../../src/integrations/whatsapp/whatsappService.js'
import { WahaWhatsAppProvider } from '../_shared/providers/waha.js'

// Separate operational credential; never accepted from a user JWT or sent to React.
Deno.serve(async (request) => {
  if (
    !env('WHATSAPP_ADMIN_SECRET') ||
    !secureEqual(
      request.headers.get('authorization'),
      `Bearer ${env('WHATSAPP_ADMIN_SECRET')}`,
    )
  )
    return json({ error: 'Unauthorized' }, 401)
  if (request.method !== 'POST')
    return json({ error: 'Method not allowed' }, 405)
  if (Number(request.headers.get('content-length') || 0) > 1024)
    return json({ error: 'Body too large' }, 413)
  try {
    const { action } = await request.json()
    const client = admin()
    if (action === 'health') {
      const { data, error } = await client
        .from('whatsapp_provider_health')
        .select('last_webhook_at,session_attempts,session_next_at')
        .eq('provider', activeProvider())
        .maybeSingle()
      let waha = 'OFFLINE',
        session = 'UNCONFIGURED'
      if (configured() && activeProvider() === 'waha') {
        try {
          session = (await provider().getSessionStatus()).status
          waha =
            {
              WORKING: 'ONLINE',
              STARTING: 'STARTING',
              SCAN_QR_CODE: 'STARTING',
              FAILED: 'ERROR',
              STOPPED: 'OFFLINE',
            }[session] || 'ERROR'
          if (session === 'WORKING' && !error)
            await rpc(client, 'fc_wa_session_healthy')
        } catch {
          waha = 'ERROR'
        }
      }
      return json({
        provider: activeProvider(),
        configured: configured(),
        waha,
        session,
        supabase: error ? 'ERROR' : 'HEALTHY',
        webhook: error
          ? 'ERROR'
          : data?.last_webhook_at
            ? 'HEALTHY'
            : 'UNVERIFIED',
        lastWebhookAt: data?.last_webhook_at || null,
        sessionAttempts: data?.session_attempts || 0,
        nextSessionAttemptAt: data?.session_next_at || null,
        note: 'Webhook health records the last authenticated event; it does not prove current network reachability.',
      })
    }
    if (activeProvider() !== 'waha' || !configured())
      return json({ error: 'WAHA configuration required' }, 409)
    const gateway = provider()
    if (!(gateway instanceof WahaWhatsAppProvider))
      return json({ error: 'WAHA required' }, 409)
    if (action === 'qr') {
      if (
        !(await rpc(client, 'fc_wa_rate', {
          p_key: 'admin-qr',
          p_limit: 6,
          p_seconds: 60,
        }))
      )
        return json({ error: 'Rate limited' }, 429)
      if ((await gateway.getSessionStatus()).status !== 'SCAN_QR_CODE')
        return json({ error: 'Session is not waiting for QR' }, 409)
      return json(await gateway.getQrCode())
    }
    if (!['create', 'start', 'reconnect'].includes(action))
      return json({ error: 'Invalid action' }, 400)
    if (!(await rpc(client, 'fc_wa_session_claim')))
      return json(
        {
          error:
            'Session backoff or six-attempt limit reached; inspect health and WAHA logs',
        },
        429,
      )
    if (action === 'create')
      await gateway.createSession(
        `${env('SUPABASE_URL')}/functions/v1/whatsapp-webhook`,
      )
    else {
      const status = (await gateway.getSessionStatus()).status
      if (status === 'WORKING') {
        await rpc(client, 'fc_wa_session_healthy')
        return json({ status })
      }
      if (['STARTING', 'SCAN_QR_CODE'].includes(status))
        return json({ status, pending: true })
      if (action === 'start') await gateway.startSession()
      else await gateway.restartSession()
    }
    return json({ accepted: true })
  } catch {
    return json({ error: 'Administrative operation unavailable' }, 503)
  }
})
