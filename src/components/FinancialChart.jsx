import { useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Area,
  Bar,
} from 'recharts'
import { chartSeries } from '../utils/financialMath.js'
import { currency } from '../utils/currency.js'
import { EmptyState } from './UI.jsx'
export default function FinancialChart({ transactions, month }) {
  const [period, setPeriod] = useState('month')
  const data = chartSeries(transactions, period, month)
  return (
    <article className="card chart-card">
      <div className="section-heading">
        <div>
          <h2>Seu dinheiro em movimento</h2>
          <p>Entradas, gastos e saldo acumulado</p>
        </div>
        <div className="segmented">
          {[
            ['7', '7 dias'],
            ['30', '30 dias'],
            ['month', 'Mês'],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
              className={period === value ? 'active' : ''}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {transactions.length ? (
        <div
          className="chart"
          role="img"
          aria-label="Gráfico financeiro com dados reais. Valores detalhados disponíveis em transações e relatórios."
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ComposedChart
              data={data}
              margin={{ left: 0, right: 8, top: 20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3478f6" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="#3478f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="4 5"
                vertical={false}
                stroke="#e9edf5"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                minTickGap={35}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                width={48}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : v
                }
              />
              <Tooltip formatter={(value) => currency(value)} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar
                isAnimationActive={false}
                name="Entradas"
                dataKey="income"
                fill="#20ad8d"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                isAnimationActive={false}
                name="Gastos"
                dataKey="expenses"
                fill="#f49b7e"
                radius={[3, 3, 0, 0]}
              />
              <Area
                isAnimationActive={false}
                name="Saldo"
                type="monotone"
                dataKey="balance"
                stroke="#3478f6"
                strokeWidth={2.5}
                fill="url(#balanceFill)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState
          title="Um gráfico da sua vida real"
          message="Adicione transações para visualizar sua evolução."
        />
      )}
    </article>
  )
}
