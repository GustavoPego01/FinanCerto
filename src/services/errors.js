export function check(result) {
  if (result.error) throw result.error
  return result.data
}
export const missingSchema = (error) =>
  ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error?.code)
export function errorMessage(error) {
  if (missingSchema(error))
    return 'Este recurso precisa da migration do FinanCerto no Supabase. Seus dados existentes foram preservados.'
  const message = error?.message || ''
  if (/invalid login credentials/i.test(message))
    return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(message))
    return 'Confirme seu e-mail antes de entrar.'
  if (/fetch|network|timeout/i.test(message))
    return 'Não foi possível conectar. Verifique sua conexão e tente novamente.'
  if (/rate limit/i.test(message))
    return 'Muitas tentativas. Aguarde alguns minutos.'
  return message || 'Não foi possível concluir. Tente novamente.'
}
