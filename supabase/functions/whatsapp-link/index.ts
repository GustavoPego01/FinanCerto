import { createClient } from 'npm:@supabase/supabase-js@2.112.4'
import { configured, env, json, cors } from '../_shared/runtime.ts'
import { digest } from '../_shared/meta.js'
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (request.method !== 'POST')
    return json({ error: 'Method not allowed' }, 405)
  const authorization = request.headers.get('authorization') || ''
  if (!/^Bearer\s+\S+$/.test(authorization))
    return json({ error: 'Authentication required' }, 401)
  const client = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
    error,
  } = await client.auth.getUser(authorization.replace(/^Bearer\s+/, ''))
  if (error || !user) return json({ error: 'Authentication required' }, 401)
  try {
    const { action } = await request.json()
    if (action === 'status') {
      const { data, error } = await client
        .from('whatsapp_connections')
        .select('phone_e164,verified,status,verified_at')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      return json({
        configured: configured(),
        businessPhone: '+5562982767026',
        connection: data,
      })
    }
    if (action === 'disconnect') {
      const { error } = await client.rpc('fc_wa_disconnect')
      if (error) throw error
      return json({ disconnected: true })
    }
    if (action === 'request_code') {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
      const code = Array.from(
        crypto.getRandomValues(new Uint8Array(12)),
        (byte) => alphabet[byte & 31],
      ).join('')
      const { data, error } = await client.rpc('fc_wa_issue_code', {
        p_hash: await digest(code),
      })
      if (error)
        return json(
          {
            error:
              'Não foi possível gerar o código. Verifique se já está vinculado ou aguarde 15 minutos.',
          },
          409,
        )
      return json({
        code,
        expiresAt: data,
        businessPhone: '+5562982767026',
        url: `https://wa.me/5562982767026?text=${encodeURIComponent('VINCULAR ' + code)}`,
        configured: configured(),
      })
    }
    return json({ error: 'Invalid action' }, 400)
  } catch {
    return json({ error: 'Não foi possível concluir. Tente novamente.' }, 503)
  }
})
