import { parseMessage, normalize } from './messageParser.js'
import {
  createTransactionService,
  normalizeTransaction,
} from '../../services/transactionService.js'
import { today, monthKey, formatDate } from '../../utils/date.js'
import { inMonth, totals, goalMetrics } from '../../utils/financialMath.js'
import { currency } from '../../utils/currency.js'
import { finanScore } from '../../services/finanScore.js'
import { analyzeFinance } from '../../services/financialEngineService.js'
export const HELP =
  'Envie: Gastei 45 no almoço; Recebi 2200 de salário; Quanto tenho de saldo?; Quanto gastei esse mês?; Quanto recebi esse mês?; Últimas transações; Meu FinanScore; Como está minha meta da viagem? Apenas lançamentos de hoje. Para corrigir ou arquivar, use o app.'
export async function rpc(client, name, args = {}) {
  const { data, error } = await client.rpc(name, args)
  if (error)
    throw Object.assign(new Error('Database operation failed'), {
      code: error.code,
    })
  return data
}
export function answerQuery(parsed, snapshot) {
  const rows = snapshot.transactions
    .map(normalizeTransaction)
    .filter((t) => t.date && t.date <= today())
  const monthly = inMonth(rows, monthKey()),
    sum = totals(monthly)
  switch (parsed.intent) {
    case 'balance': {
      const all = totals(rows)
      return `Saldo registrado: ${currency(all.balance)}.\nEntradas: ${currency(all.income)}. Saídas: ${currency(all.expenses)}.`
    }
    case 'financial_summary': {
      const analysis = analyzeFinance(
        rows,
        snapshot.profile,
        snapshot.goals,
        monthKey(),
      )
      return `FinanScore: ${analysis.score.value ?? 'Sem dados'}${analysis.score.value === null ? '' : '/100 — ' + analysis.score.label}.\nSaldo registrado: ${currency(totals(rows).balance)}.\nGastos/renda do mês: ${analysis.usage === null ? 'sem renda informada' : Math.round(analysis.usage) + '%'}.\nPrincipal categoria: ${analysis.categories[0]?.name || 'sem gastos'}.\n${analysis.insights[0]?.message || ''}`
    }
    case 'monthly_expenses':
      return `Gastos deste mês: ${currency(sum.expenses)}.`
    case 'monthly_income':
      return `Entradas deste mês: ${currency(sum.income)}.`
    case 'category_expenses':
      return `${parsed.category} neste mês: ${currency(totals(monthly.filter((t) => t.category === parsed.category)).expenses)}.`
    case 'largest_expense': {
      const top = monthly
        .filter((t) => t.type === 'expense')
        .sort((a, b) => b.amount - a.amount)[0]
      return top
        ? `Maior gasto do mês: ${top.title}, ${currency(top.amount)}.`
        : 'Nenhum gasto registrado neste mês.'
    }
    case 'last_transactions':
      return (
        rows
          .filter((t) => !parsed.expensesOnly || t.type === 'expense')
          .slice(0, 5)
          .map(
            (t) =>
              `${formatDate(t.date)} · ${t.title}: ${t.type === 'income' ? '+' : '-'}${currency(t.amount)}`,
          )
          .join('\n') || 'Nenhuma transação registrada.'
      )
    case 'score': {
      const score = finanScore(
        rows,
        snapshot.profile,
        snapshot.goals,
        monthKey(),
      )
      return score.value === null
        ? 'FinanScore: sem dados suficientes neste mês.'
        : `Seu FinanScore: ${score.value}/100 — ${score.label}.`
    }
    case 'goal_status': {
      const goals = snapshot.goals.filter(
        (g) => !parsed.query || normalize(g.title).includes(parsed.query),
      )
      if (goals.length !== 1)
        return goals.length
          ? `Informe o nome da meta: ${goals
              .slice(0, 8)
              .map((g) => g.title)
              .join(', ')}.`
          : 'Nenhuma meta encontrada com esse nome.'
      const g = goals[0],
        m = goalMetrics(g, Math.max(0, sum.balance))
      return `${g.title}: ${currency(g.current_amount)} de ${currency(g.target_amount)} (${Math.round(m.progress)}%). Faltam ${currency(m.remaining)}.${m.estimate !== null ? ` Estimativa: ${m.estimate} meses destinando o saldo mensal atual à meta, sem considerar rendimentos.` : ''}`
    }
    case 'cancel':
      return 'Conversa pendente cancelada. Nenhum lançamento foi alterado.'
    default:
      return HELP
  }
}
// Backend only: identity and persistence are resolved atomically from the verified inbox binding.
export function createWhatsAppService({ client, gateway }) {
  return {
    async process(id) {
      const msg = await rpc(client, 'fc_wa_claim', { p_id: id })
      if (!msg) return
      const args = { p_id: id, p_lease: msg.lease }
      try {
        let response,
          intent,
          context = null
        if (msg.link_hash) {
          const linked = await rpc(client, 'fc_wa_link', args)
          response = linked
            ? 'WhatsApp vinculado ao FinanCerto. ' + HELP
            : 'Código inválido, expirado ou já utilizado. Gere outro no Perfil do app. Desconecte um vínculo existente antes de trocar de conta.'
          intent = 'link'
        } else {
          const snapshot = await rpc(client, 'fc_wa_snapshot', args)
          if (!snapshot.authorized) {
            response =
              'Vincule este número em Perfil → WhatsApp no FinanCerto. Envie o código recebido no app para este número empresarial.'
            intent = 'unlinked'
          } else {
            const parsed = parseMessage(msg.payload_text, snapshot.context)
            intent = parsed.intent
            if (intent.startsWith('create_')) {
              const service = createTransactionService(client, {
                persistTransaction: (data) =>
                  rpc(client, 'fc_wa_create_transaction', {
                    ...args,
                    p_data: data,
                  }),
              })
              const tx = await service.createTransaction(snapshot.userId, {
                ...parsed,
                type: intent === 'create_income' ? 'income' : 'expense',
                date: today(),
                source: 'whatsapp',
              })
              const updated = await rpc(client, 'fc_wa_snapshot', args)
              const balance = updated.authorized
                ? totals(
                    updated.transactions
                      .map(normalizeTransaction)
                      .filter((t) => t.date && t.date <= today()),
                  ).balance
                : null
              response = `${tx.type === 'income' ? 'Entrada registrada' : 'Saída registrada'}: ${tx.title}, ${currency(tx.amount)}.\nCategoria: ${tx.category}. Data: ${formatDate(tx.date)}.${balance === null ? '' : '\nSaldo atualizado: ' + currency(balance) + '.'}`
            } else if (intent === 'clarify') {
              response = parsed.message
              context = parsed.context || null
            } else response = answerQuery(parsed, snapshot)
          }
        }
        await rpc(client, 'fc_wa_finish', {
          ...args,
          p_response: response,
          p_intent: intent,
          p_context: context,
        })
      } catch (error) {
        await rpc(client, 'fc_wa_fail', {
          ...args,
          p_error: /^[0-9A-Z]{5}$/.test(error.code || '')
            ? error.code
            : 'PROCESS_FAILED',
        })
      }
    },
    async deliver(id) {
      const out = await rpc(client, 'fc_wa_claim_delivery', { p_id: id })
      if (!out) return
      try {
        const providerId = await gateway.send(out.waId, out.text)
        await rpc(client, 'fc_wa_delivery_result', {
          p_id: id,
          p_lease: out.lease,
          p_success: true,
          p_provider_id: providerId,
        })
      } catch {
        await rpc(client, 'fc_wa_delivery_result', {
          p_id: id,
          p_lease: out.lease,
          p_success: false,
          p_error: 'DELIVERY_FAILED',
        })
      }
    },
  }
}
