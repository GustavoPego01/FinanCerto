import dns from 'node:dns/promises'
import { loadEnv } from 'vite'
import { validateSupabaseConfig } from '../src/supabase/config.js'
const mode = process.argv[2] || 'development'
const configuration = validateSupabaseConfig(
  loadEnv(mode, process.cwd(), 'VITE_'),
)
console.log(
  JSON.stringify({
    mode,
    url: configuration.url,
    publicKeyFound: Boolean(configuration.key),
    configured: configuration.configured,
    problems: configuration.problems,
  }),
)
if (!configuration.configured) process.exitCode = 1
else {
  try {
    const resolved = await dns.lookup(new URL(configuration.url).hostname)
    console.log('DNS resolved:', resolved.family === 6 ? 'IPv6' : 'IPv4')
    for (const endpoint of [
      '/auth/v1/settings',
      '/rest/v1/profiles?select=id&limit=0',
      '/rest/v1/transactions?select=id&limit=0',
    ]) {
      const response = await fetch(configuration.url + endpoint, {
        headers: { apikey: configuration.key },
        signal: AbortSignal.timeout(15000),
      })
      const body = await response.json()
      const protectedTable = response.status === 401 && body.code === '42501'
      console.log(
        'Real API:',
        endpoint,
        response.status,
        protectedTable ? '(private table: authenticated session required)' : '',
      )
      if (!response.ok && !protectedTable) process.exitCode = 1
    }
  } catch (error) {
    console.error('Connectivity failed:', error.cause?.code || error.name)
    process.exitCode = 1
  }
}
