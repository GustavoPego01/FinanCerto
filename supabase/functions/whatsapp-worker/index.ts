import { env, json, drain, admin } from '../_shared/runtime.ts'
import { verifySignature } from '../_shared/meta.js'
import { rpc } from '../../../src/integrations/whatsapp/whatsappService.js'
Deno.serve(async (request) => {
  if (request.method !== 'POST')
    return json({ error: 'Method not allowed' }, 405)
  const stamp = request.headers.get('x-worker-timestamp') || ''
  if (
    !/^\d{10}$/.test(stamp) ||
    Math.abs(Date.now() / 1000 - Number(stamp)) > 90 ||
    !(await verifySignature(
      'financerto-worker:' + stamp,
      'sha256=' + request.headers.get('x-worker-signature'),
      env('WHATSAPP_WORKER_SECRET'),
    ))
  )
    return json({ error: 'Unauthorized' }, 401)
  try {
    if (!(await rpc(admin(), 'fc_wa_claim_tick', { p_stamp: Number(stamp) })))
      return json({ duplicate: true })
    return json(await drain())
  } catch {
    return json({ error: 'Worker failed' }, 503)
  }
})
