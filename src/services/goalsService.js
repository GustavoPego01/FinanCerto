import { supabase } from '../supabase/client.js'
import { check } from './errors.js'
import { toISODate } from '../utils/date.js'
export const goalsService = {
  async list(userId) {
    return check(
      await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ).filter((goal) => !goal.archived_at)
  },
  async archive(userId, id) {
    return check(
      await supabase
        .from('goals')
        .update({ archived_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('id', id)
        .select('id')
        .single(),
    )
  },
  async save(userId, input) {
    const target = Number(input.target_amount),
      current = Number(input.current_amount)
    if (
      !input.title?.trim() ||
      !Number.isFinite(target) ||
      target <= 0 ||
      !Number.isFinite(current) ||
      current < 0
    )
      throw new Error('Preencha a meta com valores válidos.')
    if (input.target_date && !toISODate(input.target_date))
      throw new Error('Prazo inválido.')
    const row = {
      user_id: userId,
      title: input.title.trim(),
      target_amount: target,
      current_amount: current,
      target_date: toISODate(input.target_date),
      category: input.category,
      status:
        current >= target
          ? 'completed'
          : input.status === 'paused'
            ? 'paused'
            : 'active',
    }
    return check(
      await (
        input.id
          ? supabase
              .from('goals')
              .update(row)
              .eq('user_id', userId)
              .eq('id', input.id)
          : supabase.from('goals').insert(row)
      )
        .select()
        .single(),
    )
  },
}
