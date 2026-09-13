import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Alert, PageHeading, TransactionList } from '../../components/UI.jsx'
import { createTransactionService } from '../../services/transactionService.js'
import { supabase } from '../../supabase/client.js'
import { errorMessage } from '../../services/errors.js'
import { monthKey } from '../../utils/date.js'
export default function TransactionsPage({
  finance,
  user,
  month,
  onNew,
  onEdit,
}) {
  const [query, setQuery] = useState(''),
    [type, setType] = useState('all'),
    [all, setAll] = useState(false),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false)
  const rows = finance.transactions.filter(
    (t) =>
      (all || monthKey(t.date) === month) &&
      (type === 'all' || t.type === type) &&
      `${t.title} ${t.category}`
        .toLocaleLowerCase('pt-BR')
        .includes(query.toLocaleLowerCase('pt-BR')),
  )
  async function archive(t) {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      await createTransactionService(supabase).archiveTransaction(user.id, t.id)
      await finance.reload()
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="SEU DIA A DIA"
        title="Transações"
        description="Cada registro traz mais clareza ao seu planejamento."
        action={
          <button className="button" onClick={onNew}>
            <Plus size={18} />
            Nova transação
          </button>
        }
      />
      <Alert>{message}</Alert>
      <article className="card">
        <div className="filters">
          <label className="search-input">
            <Search size={18} />
            <input
              aria-label="Buscar transações"
              placeholder="Buscar descrição ou categoria"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Tipo de transação"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="all">Todos os tipos</option>
            <option value="income">Entradas</option>
            <option value="expense">Gastos</option>
          </select>
          <label className="check-label">
            <input
              type="checkbox"
              checked={all}
              onChange={(e) => setAll(e.target.checked)}
            />
            Todo o histórico
          </label>
        </div>
        <p className="muted">
          {rows.length} registros{busy ? ' · Arquivando…' : ''}
        </p>
        <TransactionList
          rows={rows}
          onEdit={onEdit}
          onArchive={busy ? undefined : archive}
        />
      </article>
    </>
  )
}
