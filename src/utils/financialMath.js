import { cents } from './currency.js'
import {
  monthKey,
  shiftMonth,
  dateRange,
  parseDate,
  toISODate,
  daysBetween,
  today,
} from './date.js'
export function totals(rows) {
  const income = rows
    .filter(
      (t) =>
        t.type === 'income' &&
        Number.isFinite(Number(t.amount)) &&
        Number(t.amount) >= 0,
    )
    .reduce((sum, t) => sum + cents(t.amount), 0)
  const expenses = rows
    .filter(
      (t) =>
        t.type === 'expense' &&
        Number.isFinite(Number(t.amount)) &&
        Number(t.amount) >= 0,
    )
    .reduce((sum, t) => sum + cents(t.amount), 0)
  return {
    income: income / 100,
    expenses: expenses / 100,
    balance: (income - expenses) / 100,
  }
}
export const inMonth = (rows, month) =>
  rows.filter((t) => monthKey(t.date) === month)
export function byCategory(rows) {
  const groups = new Map()
  rows
    .filter(
      (t) =>
        t.type === 'expense' &&
        Number.isFinite(Number(t.amount)) &&
        Number(t.amount) >= 0,
    )
    .forEach((t) =>
      groups.set(t.category, (groups.get(t.category) || 0) + cents(t.amount)),
    )
  return [...groups]
    .map(([name, amount]) => ({ name, amount: amount / 100 }))
    .sort((a, b) => b.amount - a.amount)
}
export function chartSeries(rows, period, month) {
  const { start, end } = dateRange(period, month)
  let balance = cents(
    totals(rows.filter((t) => t.date && t.date < start)).balance,
  )
  const result = []
  for (
    const day = parseDate(start);
    toISODate(day) <= end;
    day.setDate(day.getDate() + 1)
  ) {
    const date = toISODate(day)
    const daily = totals(rows.filter((t) => t.date === date))
    balance += cents(daily.balance)
    result.push({
      date,
      label: `${date.slice(8)}/${date.slice(5, 7)}`,
      ...daily,
      balance: balance / 100,
    })
  }
  return result
}
export const history = (rows, month) =>
  Array.from({ length: 6 }, (_, i) => {
    const key = shiftMonth(month, i - 5)
    return { month: key, ...totals(inMonth(rows, key)) }
  })
export function goalMetrics(goal, monthlySavings = 0) {
  const remaining =
    Math.max(0, cents(goal.target_amount) - cents(goal.current_amount)) / 100
  const months = goal.target_date
    ? Math.max(1, Math.ceil(daysBetween(today(), goal.target_date) / 30.4375))
    : null
  return {
    remaining,
    progress: Math.min(
      100,
      Math.max(
        0,
        (Number(goal.current_amount) / Number(goal.target_amount)) * 100,
      ),
    ),
    recommended: months ? remaining / months : null,
    estimate:
      remaining === 0
        ? 0
        : monthlySavings > 0
          ? Math.ceil(remaining / monthlySavings)
          : null,
  }
}
