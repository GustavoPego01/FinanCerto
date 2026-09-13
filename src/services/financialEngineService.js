import {
  totals,
  inMonth,
  byCategory,
  goalMetrics,
} from '../utils/financialMath.js'
import { shiftMonth, today } from '../utils/date.js'
import { currency } from '../utils/currency.js'
import { finanScore } from './finanScore.js'
export function analyzeFinance(transactions, profile = {}, goals = [], month) {
  const rows = inMonth(transactions, month),
    summary = totals(rows)
  const previousRows = inMonth(transactions, shiftMonth(month, -1)),
    previous = totals(previousRows)
  const categories = byCategory(rows),
    oldCategories = byCategory(previousRows)
  const income = summary.income || Number(profile.monthly_income) || 0
  const usage = income > 0 ? (summary.expenses / income) * 100 : null
  const score = finanScore(transactions, profile, goals, month)
  const insights = []
  const add = (key, title, message, type = 'info') =>
    insights.push({ key, title, message, type })
  if (!rows.length)
    add(
      'start',
      'Seu próximo passo',
      'Registre suas entradas e gastos para conhecer seu mês.',
    )
  if (usage !== null && rows.length)
    add(
      'usage',
      'Sua renda em perspectiva',
      `Você utilizou ${Math.round(usage)}% ${summary.income ? 'das entradas registradas' : 'da renda declarada'}.`,
      usage >= 80 ? 'warning' : 'info',
    )
  if (summary.balance > 0)
    add(
      'savings',
      'Espaço para seus objetivos',
      `Suas entradas superaram seus gastos em ${currency(summary.balance)} neste mês.`,
      'success',
    )
  if (summary.balance < 0)
    add(
      'negative',
      'Atenção ao saldo',
      `Os gastos superaram as entradas em ${currency(-summary.balance)}.`,
      'warning',
    )
  if (categories.length)
    add(
      'largest',
      'Onde seu dinheiro vai',
      `${categories[0].name} é sua maior categoria: ${currency(categories[0].amount)}.`,
    )
  categories.forEach((c) => {
    const old = oldCategories.find((o) => o.name === c.name)
    if (old?.amount > 0 && c.amount > old.amount * 1.1)
      add(
        `category-${c.name}`,
        `${c.name} cresceu`,
        `Seus gastos aumentaram ${Math.round((c.amount / old.amount - 1) * 100)}% em relação ao mês anterior. Meses em andamento têm períodos diferentes.`,
        'warning',
      )
  })
  if (profile.has_debts)
    add(
      'debt',
      'Priorize suas dívidas',
      'Liste taxas e vencimentos. Direcione o valor disponível às dívidas mais caras antes de assumir novos compromissos.',
      'warning',
    )
  if (profile.has_reserve === false)
    add(
      'reserve',
      'Comece sua reserva',
      `Separe um valor possível todo mês. Seus gastos fixos declarados de ${currency(profile.fixed_expenses)} ajudam a dimensionar a reserva.`,
    )
  if (profile.income_type === 'Variável')
    add(
      'variable',
      'Renda variável pede margem',
      `Como ${profile.occupation || 'profissional com renda variável'}, planeje suas despesas usando os meses de menor renda como referência.`,
    )
  if (profile.financial_goal)
    add(
      'objective',
      'Mantenha seu objetivo à vista',
      `Seu foco é ${profile.financial_goal}. Transforme esse objetivo em uma meta com prazo e valor.`,
    )
  goals
    .filter((g) => g.status === 'active')
    .forEach((g) => {
      const m = goalMetrics(g, Math.max(0, summary.balance))
      if (m.estimate !== null)
        add(
          `goal-${g.id}`,
          g.title,
          `Mantendo o saldo mensal atual e destinando-o integralmente a esta meta, faltam cerca de ${m.estimate} meses. Estimativa, sem considerar rendimentos.`,
        )
      if (m.progress >= 70)
        add(
          `milestone-${g.id}`,
          'Você está chegando lá',
          `Sua meta ${g.title} atingiu ${Math.floor(m.progress)}%.`,
          'success',
        )
    })
  if (!transactions.some((t) => t.date === today()))
    add(
      'daily',
      'Seu hábito de hoje',
      'Lembrete: registre seus gastos de hoje.',
    )
  return { summary, previous, categories, usage, score, insights }
}
