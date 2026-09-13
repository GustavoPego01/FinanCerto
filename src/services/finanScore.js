import { totals, inMonth, byCategory } from '../utils/financialMath.js'
import { shiftMonth, monthKey } from '../utils/date.js'
export function finanScore(transactions, profile, goals, month) {
  const current = inMonth(transactions, month),
    summary = totals(current)
  if (!current.length) return { value: null, label: 'Sem dados', factors: [] }
  const previous = totals(inMonth(transactions, shiftMonth(month, -1)))
  const income = summary.income || Number(profile.monthly_income) || 0
  const ratio = income > 0 ? summary.expenses / income : 2
  const categories = byCategory(current)
  const factors = [
    {
      label: 'Gastos em relação à renda',
      points: Math.round(Math.max(0, 1 - ratio) * 25),
      max: 25,
    },
    { label: 'Saldo do mês', points: summary.balance >= 0 ? 10 : 0, max: 10 },
    {
      label: 'Capacidade de poupar',
      points: income
        ? Math.round(
            Math.min(1, Math.max(0, summary.balance / income) / 0.2) * 15,
          )
        : 0,
      max: 15,
    },
    {
      label: 'Dívidas declaradas',
      points: profile.has_debts === false ? 10 : 0,
      max: 10,
    },
    {
      label: 'Reserva declarada',
      points: profile.has_reserve === true ? 10 : 0,
      max: 10,
    },
    {
      label: 'Consistência de registros',
      points: Math.min(
        10,
        (new Set(
          transactions
            .filter(
              (t) =>
                t.date &&
                monthKey(t.date) <= month &&
                monthKey(t.date) >= shiftMonth(month, -2),
            )
            .map((t) => monthKey(t.date)),
        ).size *
          10) /
          3,
      ),
      max: 10,
    },
    {
      label: 'Evolução mensal',
      points:
        inMonth(transactions, shiftMonth(month, -1)).length &&
        summary.balance >= previous.balance
          ? 10
          : 0,
      max: 10,
    },
    {
      label: 'Categorias organizadas',
      points:
        categories.length &&
        !categories.some(
          (c) => c.name === 'Outros' && c.amount > summary.expenses * 0.4,
        )
          ? 5
          : 0,
      max: 5,
    },
    {
      label: 'Progresso nas metas',
      points: goals.some((g) => Number(g.current_amount) > 0) ? 5 : 0,
      max: 5,
    },
  ]
  const value = Math.min(
    100,
    Math.max(0, Math.round(factors.reduce((sum, f) => sum + f.points, 0))),
  )
  return {
    value,
    label:
      value >= 90
        ? 'Excelente'
        : value >= 75
          ? 'Muito bom'
          : value >= 60
            ? 'Estável'
            : value >= 40
              ? 'Atenção'
              : 'Crítico',
    factors,
  }
}
