import { useEffect, useRef, useState } from 'react'
import {
  X,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Pencil,
  Archive,
  Sparkles,
} from 'lucide-react'
import { currency } from '../utils/currency.js'
import { formatDate } from '../utils/date.js'
import { goalMetrics } from '../utils/financialMath.js'
export function Brand() {
  return (
    <a className="brand" href="#dashboard" aria-label="FinanCerto início">
      <span className="brand-icon">
        <Wallet size={23} />
      </span>
      <span>
        Finan<span className="blue">Certo</span>
        <small>Seu dinheiro, com direção.</small>
      </span>
    </a>
  )
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      Organizando seu espaço…
    </div>
  )
}
export function EmptyState({
  title = 'Tudo começa com o primeiro passo',
  message = 'Seus registros aparecerão aqui.',
  action,
}) {
  return (
    <div className="empty">
      <Wallet size={30} />
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  )
}
export function Alert({ children, success = false }) {
  return children ? (
    <div
      className={`alert ${success ? 'success' : ''}`}
      role={success ? 'status' : 'alert'}
    >
      {children}
    </div>
  ) : null
}
export function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}
export function Modal({ title, onClose, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="section-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Fechar">
          <X />
        </button>
      </div>
      {children}
    </dialog>
  )
}
export function StatCard({ title, value, subtitle, variant = '', icon }) {
  return (
    <article className={`stat-card ${variant}`}>
      <div className="stat-label">
        {title}
        {icon}
      </div>
      <strong>{currency(value)}</strong>
      <small>{subtitle}</small>
    </article>
  )
}
export function ScoreCard({ score }) {
  return (
    <article className="card score-card">
      <div className="section-heading">
        <h2>Seu FinanScore</h2>
        <span className="badge">Saúde financeira</span>
      </div>
      <div className="score-body">
        <div
          className="score-ring"
          style={{ '--score': `${score.value ?? 0}%` }}
        >
          <div>
            <strong>{score.value ?? '—'}</strong>
            <small>de 100</small>
          </div>
        </div>
        <div>
          <h3>{score.label}</h3>
          <p>Um retrato dos seus hábitos, para evoluir um passo de cada vez.</p>
        </div>
      </div>
      <details>
        <summary>Como calculamos</summary>
        <p>
          Indicador educativo por regras; não é score de crédito. Dados não
          informados não geram pontos.
        </p>
        {score.factors.map((f) => (
          <div className="factor" key={f.label}>
            <span>{f.label}</span>
            <b>
              {Math.round(f.points)}/{f.max}
            </b>
          </div>
        ))}
      </details>
    </article>
  )
}
export function InsightCard({ insight }) {
  return (
    <article className={`insight ${insight.type}`}>
      <span className="insight-icon">
        <Sparkles size={18} />
      </span>
      <div>
        <h3>{insight.title}</h3>
        <p>{insight.message}</p>
      </div>
    </article>
  )
}
export function TransactionList({ rows, onEdit, onArchive }) {
  const [confirm, setConfirm] = useState(null)
  return !rows.length ? (
    <EmptyState
      title="Nenhuma transação neste período"
      message="Registre uma entrada ou um gasto para começar."
    />
  ) : (
    <div className="transaction-list">
      {rows.map((t) => (
        <div className="transaction-row" key={t.id}>
          <span className={`transaction-icon ${t.type}`}>
            {t.type === 'income' ? (
              <ArrowDownLeft size={20} />
            ) : (
              <ArrowUpRight size={20} />
            )}
          </span>
          <div className="transaction-description">
            <strong>{t.title}</strong>
            <small>
              {t.category} · {formatDate(t.date || t.originalDate)} · {t.source}
            </small>
          </div>
          <strong
            className={`transaction-amount ${t.type === 'income' ? 'positive' : ''}`}
          >
            {t.type === 'income' ? '+' : '−'} {currency(t.amount)}
          </strong>
          {onEdit && (
            <button
              className="icon-button"
              aria-label={`Editar ${t.title}`}
              onClick={() => onEdit(t)}
            >
              <Pencil size={16} />
            </button>
          )}
          {onArchive && (
            <button
              className="icon-button"
              aria-label={`Arquivar ${t.title}`}
              onClick={() => setConfirm(t)}
            >
              <Archive size={16} />
            </button>
          )}
        </div>
      ))}
      {confirm && (
        <Modal title="Arquivar transação?" onClose={() => setConfirm(null)}>
          <p>
            “{confirm.title}” sairá dos cálculos. O registro continuará
            preservado no banco.
          </p>
          <button
            className="button"
            onClick={() => {
              onArchive(confirm)
              setConfirm(null)
            }}
          >
            Confirmar arquivamento
          </button>
        </Modal>
      )}
    </div>
  )
}
export function GoalCard({ goal, savings, onEdit }) {
  const m = goalMetrics(goal, savings)
  return (
    <article className="card goal-card">
      <div className="section-heading">
        <span className="badge">{goal.category}</span>
        {onEdit && (
          <button
            className="icon-button"
            onClick={() => onEdit(goal)}
            aria-label={`Editar meta ${goal.title}`}
          >
            <Pencil size={17} />
          </button>
        )}
      </div>
      <h3>{goal.title}</h3>
      <div className="goal-values">
        <strong>{currency(goal.current_amount)}</strong>
        <small>de {currency(goal.target_amount)}</small>
      </div>
      <progress value={m.progress} max="100" />
      <div className="between">
        <small>{Math.round(m.progress)}% concluído</small>
        <small>
          {goal.status === 'completed'
            ? 'Concluída'
            : goal.status === 'paused'
              ? 'Pausada'
              : goal.target_date
                ? formatDate(goal.target_date)
                : 'Sem prazo'}
        </small>
      </div>
      <p>
        Faltam <b>{currency(m.remaining)}</b>
        {m.recommended !== null && (
          <> · {currency(m.recommended)}/mês para o prazo</>
        )}
      </p>
      {m.estimate !== null && (
        <small>
          Estimativa: {m.estimate} meses dedicando o saldo mensal atual a esta
          meta.
        </small>
      )}
    </article>
  )
}
