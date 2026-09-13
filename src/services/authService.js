import { supabase } from '../supabase/client.js'
import { check } from './errors.js'
export const authService = {
  async login(email, password) {
    return check(
      await supabase.auth.signInWithPassword({ email: email.trim(), password }),
    )
  },
  async signup(nome, email, password) {
    return check(
      await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { nome: nome.trim() },
          emailRedirectTo: window.location.origin,
        },
      }),
    )
  },
  async logout() {
    return check(await supabase.auth.signOut())
  },
  async recover(email) {
    return check(
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/?recovery=1`,
      }),
    )
  },
  async password(password) {
    return check(await supabase.auth.updateUser({ password }))
  },
}
