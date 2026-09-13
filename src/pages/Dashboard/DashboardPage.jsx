import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  ArrowRight,
} from 'lucide-react'
import {
  PageHeading,
  StatCard,
  ScoreCard,
  InsightCard,
  TransactionList,
  GoalCard,
  EmptyState,
} from '../../components/UI.jsx'
import FinancialChart from '../../components/FinancialChart.jsx'
import { inMonth, totals } from '../../utils/financialMath.js'
import { monthLabel } from '../../utils/date.js'
import { currency } from '../../utils/currency.js'
export default function DashboardPage({
  finance,
  analysis,
  month,
  onNew,
  navigate,
}) {
  const { summary, previous } = analysis
  const available =
    Number(finance.profile.monthly_income || 0) - summary.expenses
  return (
    <>
      <PageHeading
        eyebrow="CADA ESCOLHA CONTA"
        title={`Olá, ${finance.profile.nome?.split(' ')[0] || 'você'} 👋`}
        description="Vamos dar mais direção ao seu dinheiro?"
        action={
          <button className="button" onClick={onNew}>
            <Plus size={18} />
            Nova transação
          </button>
        }
      />
      <div className="between period-line">
        <h2>Seu mês em perspectiva</h2>
        <span className="badge">{monthLabel(month)}</span>
      </div>
      <div className="stats-grid">
        <StatCard
          title="Saldo acumulado"
          value={
            totals(
              finance.transactions.filter(
                (t) => t.date && t.date.slice(0, 7) <= month,
              ),
            ).balance
          }
          subtitle="Desde o primeiro registro até este mês"
          variant="primary"
          icon={<Wallet size={20} />}
        />
        <StatCard
          title="Entradas do mês"
          value={summary.income}
          subtitle={`Mês anterior: ${currency(previous.income)}`}
          icon={<ArrowDownLeft size={20} />}
        />
        <StatCard
          title="Gastos do mês"
          value={summary.expenses}
          subtitle={`Mês anterior: ${currency(previous.expenses)}`}
          icon={<ArrowUpRight size={20} />}
        />
        <StatCard
          title="Renda disponível"
          value={available}
          subtitle="Renda declarada menos gastos do mês"
          icon={<Wallet size={20} />}
        />
      </div>
      <div className="dashboard-columns">
        <div className="stack">
          <FinancialChart transactions={finance.transactions} month={month} />
          <article className="card">
            <div className="section-heading">
              <div>
                <h2>Últimas transações</h2>
                <p>Os detalhes que fazem a diferença</p>
              </div>
              <button
                className="text-button"
                onClick={() => navigate('transacoes')}
              >
                Ver todas <ArrowRight size={15} />
              </button>
            </div>
            <TransactionList
              rows={inMonth(finance.transactions, month).slice(0, 5)}
            />
          </article>
        </div>
        <div className="stack">
          <ScoreCard score={analysis.score} />
          <article className="card">
            <div className="section-heading">
              <h2>Um olhar para você</h2>
              <span className="sparkle">✧</span>
            </div>
            {analysis.insights.slice(0, 3).map((i) => (
              <InsightCard key={i.key} insight={i} />
            ))}
            <button
              className="text-button"
              onClick={() => navigate('inteligencia')}
            >
              Explorar meus insights <ArrowRight size={15} />
            </button>
          </article>
        </div>
      </div>
      <div className="section-heading section-space">
        <div>
          <h2>Planos que ganham forma</h2>
          <p>Cada conquista começa com uma meta.</p>
        </div>
        <button className="text-button" onClick={() => navigate('metas')}>
          Ver metas <ArrowRight size={15} />
        </button>
      </div>
      {finance.goals.length ? (
        <div className="goals-grid">
          {finance.goals.slice(0, 3).map((g) => (
            <GoalCard key={g.id} goal={g} savings={summary.balance} />
          ))}
        </div>
      ) : (
        <article className="card">
          <EmptyState
            title="Qual é o seu próximo sonho?"
            message="Uma reserva, uma viagem ou um novo começo. Dê o primeiro passo."
            action={
              <button
                className="button secondary"
                onClick={() => navigate('metas')}
              >
                Criar minha primeira meta
              </button>
            }
          />
        </article>
      )}
    </>
  )
}
