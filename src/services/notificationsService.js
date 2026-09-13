import { supabase } from '../supabase/client.js'
import { check } from './errors.js'
import { today } from '../utils/date.js'
export const notificationsService = {
  async list(userId) {
    return check(
      await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100),
    )
  },
  async markRead(userId, id) {
    return check(
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('id', id)
        .select('id')
        .single(),
    )
  },
  async sync(userId, insights, month) {
    const rows = insights
      .filter(
        (i) =>
          i.type === 'warning' || i.type === 'success' || i.key === 'daily',
      )
      .map((i) => ({
        user_id: userId,
        title: i.title,
        message: i.message,
        type: i.type,
        dedupe_key: `${i.key === 'daily' ? today() : month}:${i.key}`,
      }))
    if (rows.length)
      check(
        await supabase
          .from('notifications')
          .upsert(rows, {
            onConflict: 'user_id,dedupe_key',
            ignoreDuplicates: true,
          }),
      )
  },
}
