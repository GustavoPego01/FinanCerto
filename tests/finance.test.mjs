import test from 'node:test'
import assert from 'node:assert/strict'
import {
  toISODate,
  formatDate,
  dateRange,
  shiftMonth,
  monthKey,
} from '../src/utils/date.js'
import { totals, chartSeries, goalMetrics } from '../src/utils/financialMath.js'
import {
  validateTransaction,
  normalizeTransaction,
} from '../src/services/transactionService.js'
import { finanScore } from '../src/services/finanScore.js'
import { analyzeFinance } from '../src/services/financialEngineService.js'
import { parseMessage } from '../src/integrations/whatsapp/messageParser.js'
import { validateEnvelope } from '../src/integrations/whatsapp/webhookSchema.js'
test('dates preserve local calendar days, validate leap years and read legacy formats', () => {
  assert.equal(toISODate('29/02/2024'), '2024-02-29')
  assert.equal(toISODate('29/02/2025'), null)
  assert.equal(toISODate('31/04/2026'), null)
  assert.equal(toISODate('2026-09-10T00:00:00Z'), '2026-09-10')
  assert.equal(formatDate('2026-09-10'), '10/09/2026')
  assert.equal(monthKey('invalid'), '')
  assert.equal(shiftMonth('2026-01', -1), '2025-12')
  assert.deepEqual(dateRange('month', '2024-02'), {
    start: '2024-02-01',
    end: '2024-02-29',
  })
})
test('money is summed in cents; graph carries opening balance across months', () => {
  assert.equal(
    totals([
      { type: 'income', amount: 0.1 },
      { type: 'income', amount: 0.2 },
    ]).income,
    0.3,
  )
  const rows = [
    { date: '2026-08-31', type: 'income', amount: 100 },
    { date: '2026-09-01', type: 'expense', amount: 30 },
    { date: '2026-09-02', type: 'income', amount: 20 },
  ]
  const series = chartSeries(rows, 'month', '2026-09')
  assert.equal(series.length, 30)
  assert.equal(series[0].balance, 70)
  assert.equal(series[1].balance, 90)
  assert.equal(series[29].balance, 90)
})
test('transaction validation rejects malformed values and preserves source', () => {
  const input = {
    title: ' Mercado ',
    amount: '1.234,56',
    date: '10/09/2026',
    type: 'expense',
    source: 'app',
  }
  assert.equal(validateTransaction(input).amount, 1234.56)
  assert.equal(validateTransaction(input).date, '2026-09-10')
  assert.throws(() => validateTransaction({ ...input, amount: -5 }))
  assert.throws(() => validateTransaction({ ...input, date: '31/02/2026' }))
  assert.throws(() => validateTransaction({ ...input, source: 'fake' }))
  assert.equal(
    normalizeTransaction({
      type: 'entrada',
      date: '10/09/2026',
      amount: '35,20',
    }).amount,
    35.2,
  )
})
test('score has no fabricated empty-history score and stays bounded', () => {
  assert.equal(finanScore([], {}, [], '2026-09').value, null)
  for (const income of [0, 100, 1000])
    for (const expenses of [0, 500, 5000]) {
      const rows = [
        { type: 'income', amount: income, date: '2026-09-01' },
        { type: 'expense', amount: expenses, date: '2026-09-02' },
      ]
      const score = finanScore(rows, {}, [], '2026-09')
      assert.ok(score.value >= 0 && score.value <= 100)
    }
})
test('insights and goals handle debts, zero savings, completion, monthly comparison', () => {
  const rows = [
    {
      type: 'expense',
      amount: 100,
      category: 'Alimentação',
      date: '2026-08-01',
    },
    {
      type: 'expense',
      amount: 118,
      category: 'Alimentação',
      date: '2026-09-01',
    },
  ]
  const analysis = analyzeFinance(
    rows,
    { monthly_income: 200, has_debts: true },
    [],
    '2026-09',
  )
  assert.ok(analysis.insights.some((i) => i.message.includes('18%')))
  assert.ok(analysis.insights.some((i) => i.key === 'debt'))
  assert.equal(
    goalMetrics({ target_amount: 100, current_amount: 0 }, 0).estimate,
    null,
  )
  assert.equal(
    goalMetrics({ target_amount: 100, current_amount: 150 }, 20).remaining,
    0,
  )
})
test('WhatsApp parses supplied examples and refuses ambiguity', () => {
  assert.deepEqual(parseMessage('Gastei 35 no mercado'), {
    intent: 'create_expense',
    amount: 35,
    category: 'Alimentação',
    title: 'Mercado',
  })
  assert.deepEqual(parseMessage('Recebi 3000 de salário'), {
    intent: 'create_income',
    amount: 3000,
    category: 'Salário',
    title: 'Salário',
  })
  assert.equal(
    parseMessage('Quanto gastei esse mês?').intent,
    'monthly_expenses',
  )
  assert.equal(parseMessage('Quanto tenho de saldo?').intent, 'balance')
  assert.equal(
    parseMessage('Qual foi meu maior gasto?').intent,
    'largest_expense',
  )
  assert.equal(parseMessage('Como está minha meta da viagem?').query, 'viagem')
  assert.equal(
    parseMessage('Adiciona 80 reais de gasolina').category,
    'Transporte',
  )
  assert.equal(parseMessage('Gastei 1.234,56 no mercado').amount, 1234.56)
  assert.equal(parseMessage('Gastei -40 no mercado').intent, 'clarify')
  assert.equal(
    parseMessage('Gastei 40 no mercado e 20 no almoço').intent,
    'clarify',
  )
  assert.equal(parseMessage('Gastei 20 ontem').intent, 'clarify')
  assert.equal(parseMessage('Olá').intent, 'unknown')
  assert.throws(() =>
    validateEnvelope({ sender: 'invalid', messageId: '1', text: 'oi' }),
  )
})
