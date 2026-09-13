import fs from 'node:fs'
const env = Object.fromEntries(
  fs
    .readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^['"]|['"]$/g, ''),
      ]
    }),
)
const headers = { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY }
for (const table of [
  'profiles',
  'transactions',
  'goals',
  'notifications',
  'user_financial_profiles',
  'user_preferences',
]) {
  try {
    const response = await fetch(
      `${env.VITE_SUPABASE_URL}/rest/v1/${table}?select=*&limit=0`,
      { headers },
    )
    const data = await response.json()
    console.log(
      table,
      response.status,
      Array.isArray(data)
        ? 'schema available; zero rows requested'
        : data.message,
    )
  } catch (error) {
    console.log(table, error.cause?.code || 'unreachable')
  }
}
try {
  const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/`, {
    headers: { ...headers, Accept: 'application/openapi+json' },
  })
  const schema = await response.json()
  for (const [name, definition] of Object.entries(schema.definitions || {}))
    console.log(name, JSON.stringify(definition.properties))
} catch {
  console.log('OpenAPI unavailable')
}
