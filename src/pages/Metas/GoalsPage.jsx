import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  PageHeading,
  GoalCard,
  EmptyState,
  Modal,
  Alert,
} from '../../components/UI.jsx'
import { goalsService } from '../../services/goalsService.js'
import { goalCategories } from '../../constants/finance.js'
import { errorMessage } from '../../services/errors.js'
function GoalForm({ goal, userId, onClose, onSaved }) {
  const [form, setForm] = useState(
      goal || {
        title: '',
        target_amount: '',
        current_amount: 0,
        target_date: '',
        category: 'Reserva de emergência',
        status: 'active',
      },
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const field = (name) => ({
    value: form[name] ?? '',
    onChange: (e) => setForm({ ...form, [name]: e.target.value }),
  })
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (goal && form.status === 'archived')
        await goalsService.archive(userId, goal.id)
      else await goalsService.save(userId, form)
      await onSaved()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={goal ? 'Atualizar meta' : 'Um novo objetivo'}
      onClose={() => !busy && onClose()}
    >
      <form className="form" onSubmit={submit}>
        <label>
          Nome da meta
          <input
            autoFocus
            required
            maxLength={120}
            placeholder="Ex.: Minha viagem"
            {...field('title')}
          />
        </label>
        <label>
          Categoria
          <select {...field('category')}>
            {goalCategories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          <label>
            Objetivo (R$)
            <input
              type="number"
              min="0.01"
              max="999999999"
              step="0.01"
              required
              {...field('target_amount')}
            />
          </label>
          <label>
            Já reservado (R$)
            <input
              type="number"
              min="0"
              max="999999999"
              step="0.01"
              required
              {...field('current_amount')}
            />
          </label>
        </div>
        <label>
          Prazo desejado
          <input type="date" {...field('target_date')} />
        </label>
        <label>
          Situação
          <select {...field('status')}>
            <option value="active">Ativa</option>
            <option value="paused">Pausada</option>
            {goal && (
              <option value="archived">Arquivar (preservar histórico)</option>
            )}
            {form.status === 'completed' && (
              <option value="completed">Concluída</option>
            )}
          </select>
        </label>
        <p className="muted">
          O valor reservado é informado por você. Atualizar uma meta não cria
          uma transação.
        </p>
        <Alert>{error}</Alert>
        <button className="button" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar meta'}
        </button>
      </form>
    </Modal>
  )
}
export default function GoalsPage({ finance, user, analysis }) {
  const [editing, setEditing] = useState(undefined)
  return (
    <>
      <PageHeading
        eyebrow="SEUS PLANOS MERECEM ESPAÇO"
        title="Minhas metas"
        description="Transforme o que você quer em um caminho possível."
        action={
          <button className="button" onClick={() => setEditing(null)}>
            <Plus size={18} />
            Nova meta
          </button>
        }
      />
      {finance.goals.length ? (
        <div className="goals-grid">
          {finance.goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              savings={analysis.summary.balance}
              onEdit={setEditing}
            />
          ))}
        </div>
      ) : (
        <article className="card">
          <EmptyState
            title="O que você quer conquistar?"
            message="Defina um valor, um prazo e acompanhe cada passo."
            action={
              <button className="button" onClick={() => setEditing(null)}>
                Criar minha primeira meta
              </button>
            }
          />
        </article>
      )}
      {editing !== undefined && (
        <GoalForm
          goal={editing}
          userId={user.id}
          onClose={() => setEditing(undefined)}
          onSaved={finance.reload}
        />
      )}
    </>
  )
}
