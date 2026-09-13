import { createClient } from '@supabase/supabase-js'
import { validateSupabaseConfig } from './config.js'
const {
  url,
  key,
  configured: valid,
  problems,
} = validateSupabaseConfig(import.meta.env)
export const configured = valid
if (!configured && import.meta.env.DEV)
  console.error('[FinanCerto] Configuração Supabase:', problems.join(' '))
export const supabase = configured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
