import { supabase } from '../supabase/client.js'
import { check, missingSchema } from './errors.js'
export const profileService = {
  async load(user) {
    const [legacy, financial, preferences] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase
        .from('user_financial_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])
    for (const result of [legacy, financial, preferences])
      if (result.error && !missingSchema(result.error)) throw result.error
    return {
      profile: {
        nome: user.user_metadata?.nome || 'Você',
        ...legacy.data,
        ...financial.data,
      },
      preferences: preferences.data || {
        notifications_enabled: legacy.data?.notificacoes ?? true,
        plan: 'FREE',
      },
      migrationNeeded: [financial, preferences].some((r) =>
        missingSchema(r.error),
      ),
    }
  },
  async save(user, input) {
    const { nome, occupation, monthly_income, financial_goal, ...financial } =
      input
    check(
      await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            nome: nome.trim(),
            email: user.email,
            occupation,
            monthly_income,
            financial_goal,
          },
          { onConflict: 'id' },
        ),
    )
    return check(
      await supabase
        .from('user_financial_profiles')
        .upsert(
          { ...financial, user_id: user.id, onboarding_completed: true },
          { onConflict: 'user_id' },
        ),
    )
  },
  async preferences(userId, enabled) {
    return check(
      await supabase
        .from('user_preferences')
        .upsert(
          { user_id: userId, notifications_enabled: enabled },
          { onConflict: 'user_id' },
        ),
    )
  },
}
