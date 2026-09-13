import { lazy, Suspense, useEffect, useState } from 'react'
import { configured } from '../supabase/client.js'
import { useAuth } from '../hooks/useAuth.js'
import { useFinance } from '../hooks/useFinance.js'
import { analyzeFinance } from '../services/financialEngineService.js'
import { errorMessage } from '../services/errors.js'
import { monthKey } from '../utils/date.js'
import { Alert, Loading } from '../components/UI.jsx'
import Layout from '../components/Layout.jsx'
import TransactionForm from '../components/TransactionForm.jsx'
import AuthPage from '../pages/Auth/AuthPage.jsx'
import OnboardingPage from '../pages/Onboarding/OnboardingPage.jsx'
const DashboardPage = lazy(() => import('../pages/Dashboard/DashboardPage.jsx'))
const TransactionsPage = lazy(
  () => import('../pages/Transacoes/TransactionsPage.jsx'),
)
const ReportsPage = lazy(() => import('../pages/Relatorios/ReportsPage.jsx'))
const GoalsPage = lazy(() => import('../pages/Metas/GoalsPage.jsx'))
const IntelligencePage = lazy(
  () => import('../pages/Inteligencia/IntelligencePage.jsx'),
)
const NotificationsPage = lazy(
  () => import('../pages/Notificacoes/NotificationsPage.jsx'),
)
const EducationPage = lazy(
  () => import('../pages/EducacaoFinanceira/EducationPage.jsx'),
)
const ProfilePage = lazy(() => import('../pages/Perfil/ProfilePage.jsx'))
function Workspace({ user }) {
  const finance = useFinance(user)
  const [page, setPage] = useState(
      window.location.hash.slice(1) || 'dashboard',
    ),
    [month, setMonth] = useState(monthKey()),
    [editing, setEditing] = useState(undefined)
  useEffect(() => {
    const change = () => setPage(window.location.hash.slice(1) || 'dashboard')
    window.addEventListener('hashchange', change)
    return () => window.removeEventListener('hashchange', change)
  }, [])
  const navigate = (id) => {
    window.location.hash = id
    setPage(id)
    window.scrollTo({ top: 0 })
  }
  if (finance.loading) return <Loading />
  if (
    finance.profileReady &&
    !finance.migrationNeeded &&
    !finance.profile.onboarding_completed
  )
    return (
      <OnboardingPage
        user={user}
        profile={finance.profile}
        onSaved={finance.reload}
      />
    )
  const analysis = analyzeFinance(
    finance.transactions,
    finance.profile,
    finance.goals,
    month,
  )
  const props = {
    finance,
    analysis,
    month,
    user,
    navigate,
    onNew: () => setEditing(null),
    onEdit: setEditing,
  }
  const pages = {
    dashboard: DashboardPage,
    transacoes: TransactionsPage,
    relatorios: ReportsPage,
    metas: GoalsPage,
    inteligencia: IntelligencePage,
    notificacoes: NotificationsPage,
    educacao: EducationPage,
    perfil: ProfilePage,
  }
  const Page = pages[page] || DashboardPage
  const invalid = finance.transactions.filter(
    (t) =>
      !t.date ||
      !Number.isFinite(t.amount) ||
      !['income', 'expense'].includes(t.type),
  ).length
  return (
    <Layout
      page={page}
      navigate={navigate}
      name={finance.profile.nome}
      unread={finance.notifications.filter((n) => !n.read).length}
      onNew={props.onNew}
    >
      {finance.errors.length > 0 && (
        <Alert>
          {finance.errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
          <button className="text-button" onClick={finance.reload}>
            Tentar novamente
          </button>
        </Alert>
      )}
      {finance.migrationNeeded && (
        <Alert>
          A atualização do banco está pendente. Aplique a migration aditiva para
          ativar perfil financeiro, metas e alertas.
        </Alert>
      )}
      {invalid > 0 && (
        <Alert>
          {invalid} registros antigos precisam de revisão de data, valor ou
          tipo. Eles foram preservados; use “Todo o histórico” em Transações
          para corrigi-los.
        </Alert>
      )}
      {['dashboard', 'transacoes', 'relatorios', 'inteligencia'].includes(
        page,
      ) && (
        <label className="month-picker">
          Período
          <input
            aria-label="Mês de referência"
            type="month"
            value={month}
            onChange={(e) => {
              if (/^\d{4}-\d{2}$/.test(e.target.value)) setMonth(e.target.value)
            }}
          />
        </label>
      )}
      {!finance.transactionsReady &&
      ['dashboard', 'relatorios', 'inteligencia'].includes(page) ? (
        <Alert>
          Não foi possível carregar as transações. Os totais não serão exibidos
          até a conexão ser restabelecida.
        </Alert>
      ) : (
        <Suspense fallback={<Loading />}>
          <Page {...props} profile={finance.profile} />
        </Suspense>
      )}
      {editing !== undefined && (
        <TransactionForm
          userId={user.id}
          transaction={editing}
          onClose={() => setEditing(undefined)}
          onSaved={finance.reload}
        />
      )}
    </Layout>
  )
}
export default function App() {
  const auth = useAuth()
  if (!configured)
    return (
      <main className="fatal-error">
        <h1>Configure seu FinanCerto</h1>
        <p>
          Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente
          para conectar seu banco.
        </p>
      </main>
    )
  if (auth.loading) return <Loading />
  if (auth.error)
    return (
      <main className="fatal-error">
        <Alert>{errorMessage(auth.error)}</Alert>
        <button className="button" onClick={() => window.location.reload()}>
          Tentar novamente
        </button>
      </main>
    )
  if (auth.recovery && auth.user)
    return <AuthPage recovery onRecovered={auth.finishRecovery} />
  if (!auth.user) return <AuthPage />
  return <Workspace key={auth.user.id} user={auth.user} />
}
