import test from 'node:test'
import assert from 'node:assert/strict'
import { validateSupabaseConfig } from '../src/supabase/config.js'
test('Supabase configuration rejects missing variables, mismatched refs and privileged keys without leaking keys', () => {
  assert.equal(validateSupabaseConfig({}).configured, false)
  const environment = {
    VITE_SUPABASE_URL: 'https://fzqstnkrklgficdurqsd.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-only',
  }
  assert.equal(validateSupabaseConfig(environment).configured, true)
  assert.equal(
    validateSupabaseConfig({
      ...environment,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_test-only',
    }).configured,
    false,
  )
  assert.equal(
    validateSupabaseConfig({
      ...environment,
      VITE_SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',
    }).configured,
    false,
  )
  const jwt = (payload) =>
    `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`
  assert.equal(
    validateSupabaseConfig({
      ...environment,
      VITE_SUPABASE_PUBLISHABLE_KEY: jwt({ role: 'service_role' }),
    }).configured,
    false,
  )
  assert.equal(
    validateSupabaseConfig({
      ...environment,
      VITE_SUPABASE_PUBLISHABLE_KEY: jwt({
        role: 'anon',
        ref: 'another-project',
      }),
    }).configured,
    false,
  )
  assert.ok(
    !validateSupabaseConfig({
      ...environment,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_test-only',
    })
      .problems.join(' ')
      .includes('sb_secret_test-only'),
  )
})
