import {
  PageHeading,
  StatCard,
  ScoreCard,
  TransactionList,
  GoalCard,
  EmptyState,
} from '../../components/UI.jsx'
import FinancialChart from '../../components/FinancialChart.jsx'
import { inMonth, history } from '../../utils/financialMath.js'
import { currency } from '../../utils/currency.js'
import { monthLabel } from '../../utils/date.js'
export default function ReportsPage({ finance, analysis, month }) {
  const rows = inMonth(finance.transactions, month),
    summary = analysis.summary
  return (
    <>
      <PageHeading
        eyebrow="INFORMAÇÃO QUE ORIENTA"
        title="Relatórios"
        description="Entenda seus hábitos e acompanhe sua evolução."
      />
      <div className="stats-grid three">
        <StatCard
          title="Entradas"
          value={summary.income}
          subtitle={monthLabel(month)}
        />
        <StatCard
          title="Gastos"
          value={summary.expenses}
          subtitle={monthLabel(month)}
        />
        <StatCard
          title="Resultado do mês"
          value={summary.balance}
          subtitle={`Variação do saldo: ${currency(summary.balance - analysis.previous.balance)}`}
          variant="primary"
        />
      </div>
      <FinancialChart transactions={finance.transactions} month={month} />
      <div className="two-columns section-space">
        <article className="card">
          <h2>Gastos por categoria</h2>
          {analysis.categories.length ? (
            analysis.categories.map((c) => (
              <div className="category-item" key={c.name}>
                <div className="between">
                  <span>{c.name}</span>
                  <b>{currency(c.amount)}</b>
                </div>
                <progress max={summary.expenses || 1} value={c.amount} />
                <small>
                  {Math.round((c.amount / summary.expenses) * 100)}% dos gastos
                </small>
              </div>
            ))
          ) : (
            <EmptyState title="Nenhum gasto registrado" />
          )}
        </article>
        <ScoreCard score={analysis.score} />
      </div>
      <article className="card section-space">
        <h2>Histórico dos últimos seis meses</h2>
        <p>Meses em andamento representam valores parciais.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th>Entradas</th>
                <th>Gastos</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {history(finance.transactions, month).map((h) => (
                <tr key={h.month}>
                  <td>{monthLabel(h.month)}</td>
                  <td>{currency(h.income)}</td>
                  <td>{currency(h.expenses)}</td>
                  <td className={h.balance >= 0 ? 'positive' : 'negative'}>
                    {currency(h.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
      <article className="card section-space">
        <h2>Maiores gastos do mês</h2>
        <TransactionList
          rows={rows
            .filter((t) => t.type === 'expense')
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5)}
        />
      </article>
      <h2 className="section-space">Suas metas no planejamento</h2>
      <div className="goals-grid">
        {finance.goals.map((g) => (
          <GoalCard key={g.id} goal={g} savings={summary.balance} />
        ))}
      </div>
    </>
  )
}
