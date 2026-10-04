import {
  createProvider,
  providerConfigured,
  providerName,
} from './providers/index.js'
import { createClient } from 'npm:@supabase/supabase-js@2.112.4'
import {
  createWhatsAppService,
  rpc,
} from '../../../src/integrations/whatsapp/whatsappService.js'
export const env = (name: string) => Deno.env.get(name) || ''
export const configured = () => providerConfigured(env)
export const provider = () => createProvider(env)
export const activeProvider = () => providerName(env)
export const admin = () =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
export function service(client: ReturnType<typeof admin>) {
  return createWhatsAppService({
    client,
    gateway: provider(),
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
    .eq('provider', activeProvider())
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
    .eq('provider', activeProvider())
    .in('delivery_status', ['pending', 'sending'])
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
