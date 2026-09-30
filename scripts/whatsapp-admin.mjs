import fs from 'node:fs'
import path from 'node:path'

const action = process.argv[2] || 'health'
if (!['health', 'create', 'start', 'reconnect', 'qr'].includes(action))
  throw new Error('Use health, create, start, reconnect or qr')
const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
if (!base || !process.env.WHATSAPP_ADMIN_SECRET)
  throw new Error(
    'Configure SUPABASE_URL and WHATSAPP_ADMIN_SECRET in a private env file',
  )
try {
  const response = await fetch(
    `${base.replace(/\/$/, '')}/functions/v1/whatsapp-admin`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ADMIN_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action }),
      signal: AbortSignal.timeout(20000),
      redirect: 'error',
    },
  )
  const data = await response.json()
  if (!response.ok)
    throw new Error(
      `Operation failed (${response.status}): ${data.error || 'unavailable'}`,
    )
  if (action === 'qr') {
    if (data.mimetype !== 'image/png' || typeof data.data !== 'string')
      throw new Error('Unexpected QR format')
    fs.mkdirSync('.cache', { recursive: true })
    const target = path.resolve('.cache/waha-qr.png')
    fs.writeFileSync(target, Buffer.from(data.data, 'base64'), { mode: 0o600 })
    console.log(
      `QR saved locally: ${target}. Scan with the business phone; do not share it.`,
    )
  } else console.log(JSON.stringify(data, null, 2))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
