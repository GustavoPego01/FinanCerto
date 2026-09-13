export function validateSupabaseConfig(environment = {}) {
  const url = environment.VITE_SUPABASE_URL?.trim() || ''
  const key = (
    environment.VITE_SUPABASE_PUBLISHABLE_KEY ||
    environment.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim()
  const problems = []
  let hostname = ''
  try {
    const parsed = new URL(url)
    hostname = parsed.hostname
    if (
      parsed.protocol !== 'https:' &&
      !['localhost', '127.0.0.1'].includes(hostname)
    )
      problems.push('VITE_SUPABASE_URL deve usar HTTPS.')
    if (
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !['', '/'].includes(parsed.pathname)
    )
      problems.push(
        'VITE_SUPABASE_URL deve conter somente a origem do projeto.',
      )
    if (/SEU-PROJETO|PROJECT_REF|placeholder/i.test(hostname))
      problems.push('VITE_SUPABASE_URL contém um placeholder.')
  } catch {
    problems.push('VITE_SUPABASE_URL ausente ou inválida.')
  }
  if (!key)
    problems.push(
      'VITE_SUPABASE_PUBLISHABLE_KEY ou VITE_SUPABASE_ANON_KEY ausente.',
    )
  let role = '',
    ref = ''
  try {
    const payload = JSON.parse(
      atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
    )
    role = payload.role
    ref = payload.ref
  } catch {
    /* Publishable keys are opaque. */
  }
  if (key.startsWith('sb_secret_') || role === 'service_role')
    problems.push('Use apenas a chave pública do Supabase no aplicativo.')
  if (key && !key.startsWith('sb_publishable_') && role !== 'anon')
    problems.push('Formato da chave pública do Supabase inválido.')
  if (
    ref &&
    hostname.endsWith('.supabase.co') &&
    hostname.split('.')[0] !== ref
  )
    problems.push('A URL e a chave pública pertencem a projetos diferentes.')
  return {
    url: url.replace(/\/$/, ''),
    key,
    configured: problems.length === 0,
    problems,
  }
}
