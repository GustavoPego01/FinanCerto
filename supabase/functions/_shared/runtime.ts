import { createClient } from 'npm:@supabase/supabase-js@2.112.4'
import {
  createWhatsAppService,
  rpc,
} from '../../../src/integrations/whatsapp/whatsappService.js'
export const env = (name: string) => Deno.env.get(name) || ''
export const configured = () =>
  [
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_BUSINESS_ACCOUNT_ID',
    'META_APP_SECRET',
    'WHATSAPP_VERIFY_TOKEN',
  ].every((n) => !!env(n))
export const admin = () =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
export function service(client: ReturnType<typeof admin>) {
  return createWhatsAppService({
    client,
    gateway: {
      async send(to: string, body: string) {
        if (!configured()) throw new Error('Meta not configured')
        const version = env('WHATSAPP_GRAPH_API_VERSION') || 'v23.0'
        if (!/^v\d+\.0$/.test(version)) throw new Error('Invalid Graph version')
        const result = await fetch(
          `https://graph.facebook.com/${version}/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env('WHATSAPP_ACCESS_TOKEN')}`,
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
          },
        )
        if (!result.ok) throw new Error('Meta delivery failed')
        const data = await result.json()
        if (!data.messages?.[0]?.id)
          throw new Error('Missing Meta acknowledgement')
        return data.messages[0].id
      },
    },
  })
}
export async function drain() {
  if (!configured()) return { configured: false }
  const client = admin(),
    handler = service(client)
  await rpc(client, 'fc_wa_expire')
  const now = new Date().toISOString()
  const { data: queue, error } = await client
    .from('whatsapp_messages')
    .select('id')
    .in('status', ['queued', 'processing'])
    .lt('attempts', 5)
    .lte('next_attempt_at', now)
    .order('created_at')
    .limit(15)
  if (error) throw new Error('Queue unavailable')
  for (const msg of queue || []) await handler.process(msg.id)
  const { data: out, error: outError } = await client
    .from('whatsapp_messages')
    .select('id')
    .in('delivery_status', ['pending', 'sending'])
    .lt('delivery_attempts', 8)
    .lte('delivery_next_at', now)
    .order('created_at')
    .limit(10)
  if (outError) throw new Error('Outbox unavailable')
  for (const msg of out || []) await handler.deliver(msg.id)
  return {
    configured: true,
    processed: queue?.length || 0,
    deliveries: out?.length || 0,
  }
}
export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
