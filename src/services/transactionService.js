import { toISODate } from '../utils/date.js'
import { parseMoney } from '../utils/currency.js'
import { check } from './errors.js'
export function normalizeTransaction(row) {
  const aliases = {
    entrada: 'income',
    receita: 'income',
    gasto: 'expense',
    despesa: 'expense',
  }
  return {
    ...row,
    type: aliases[row.type] || row.type,
    amount: parseMoney(row.amount),
    date: toISODate(row.date),
    originalDate: row.date,
    source: row.source || 'app',
    category: row.category || 'Outros',
  }
}
export function validateTransaction(input) {
  const amount = parseMoney(input.amount)
  const date = toISODate(input.date)
  if (!['income', 'expense'].includes(input.type))
    throw new Error('Tipo de transação inválido.')
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999)
    throw new Error('Informe um valor positivo e válido.')
  if (!date) throw new Error('Informe uma data válida.')
  if (!input.title?.trim()) throw new Error('Informe uma descrição.')
  const source = input.source || 'app'
  if (!['app', 'whatsapp', 'import', 'automation'].includes(source))
    throw new Error('Origem inválida.')
  return {
    type: input.type,
    amount: Math.round(amount * 100) / 100,
    date,
    title: input.title.trim().slice(0, 160),
    category: input.category || 'Outros',
    source,
  }
}
// Client injection lets the app and a server-side WhatsApp adapter share validation and persistence.
export function createTransactionService(client, { persistTransaction } = {}) {
  return {
    async list(userId) {
      const rows = []
      for (let offset = 0; ; offset += 1000) {
        const page = check(
          await client
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('id')
            .range(offset, offset + 999),
        )
        rows.push(...page)
        if (page.length < 1000) break
      }
      return rows
        .filter((row) => !row.archived_at)
        .map(normalizeTransaction)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    },
    async createTransaction(userId, input) {
      if (persistTransaction)
        return normalizeTransaction(
          await persistTransaction(validateTransaction(input)),
        )
      const row = {
        ...validateTransaction(input),
        user_id: userId,
        id: crypto.randomUUID(),
      }
      if (input.external_message_id && row.source === 'whatsapp') {
        row.external_message_id = String(input.external_message_id).slice(
          0,
          300,
        )
        const existing = check(
          await client
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .eq('source', 'whatsapp')
            .eq('external_message_id', row.external_message_id)
            .maybeSingle(),
        )
        if (existing) return normalizeTransaction(existing)
      }
      const result = await client
        .from('transactions')
        .insert(row)
        .select()
        .single()
      if (result.error?.code === '23505' && row.external_message_id)
        return normalizeTransaction(
          check(
            await client
              .from('transactions')
              .select('*')
              .eq('user_id', userId)
              .eq('source', 'whatsapp')
              .eq('external_message_id', row.external_message_id)
              .single(),
          ),
        )
      return normalizeTransaction(check(result))
    },
    async updateTransaction(userId, id, input) {
      return normalizeTransaction(
        check(
          await client
            .from('transactions')
            .update(validateTransaction(input))
            .eq('user_id', userId)
            .eq('id', id)
            .select()
            .single(),
        ),
      )
    },
    async archiveTransaction(userId, id) {
      // Soft deletion preserves financial history; never deletes real rows.
      return check(
        await client
          .from('transactions')
          .update({ archived_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('id', id)
          .select('id')
          .single(),
      )
    },
  }
}
