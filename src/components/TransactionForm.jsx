import { useState } from 'react'
import { supabase } from '../supabase/client.js'
import { createTransactionService } from '../services/transactionService.js'
import { errorMessage } from '../services/errors.js'
import { categories } from '../constants/finance.js'
import { today } from '../utils/date.js'
import { Alert, Modal } from './UI.jsx'
export default function TransactionForm({
  userId,
  transaction,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(
    transaction || {
      title: '',
      amount: '',
      type: 'expense',
      category: 'Alimentação',
      date: today(),
      source: 'app',
    },
  )
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm({ ...form, [name]: e.target.value }),
  })
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const service = createTransactionService(supabase)
      if (transaction)
        await service.updateTransaction(userId, transaction.id, form)
      else await service.createTransaction(userId, form)
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
      title={transaction ? 'Editar transação' : 'Nova transação'}
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={submit} className="form">
        <div className="segmented wide">
          {[
            ['expense', 'Gasto'],
            ['income', 'Entrada'],
          ].map(([type, label]) => (
            <button
              type="button"
              key={type}
              className={form.type === type ? 'active' : ''}
              onClick={() => setForm({ ...form, type })}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          Descrição
          <input
            autoFocus
            required
            maxLength={160}
            placeholder="Ex.: Compras no mercado"
            {...field('title')}
          />
        </label>
        <div className="form-grid">
          <label>
            Valor (R$)
            <input
              required
              type="number"
              min="0.01"
              max="999999999"
              step="0.01"
              inputMode="decimal"
              {...field('amount')}
            />
          </label>
          <label>
            Data
            <input required type="date" {...field('date')} />
          </label>
        </div>
        <label>
          Categoria
          <select {...field('category')}>
            {[...new Set([...categories, form.category])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <Alert>{error}</Alert>
        <button className="button" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar transação'}
        </button>
      </form>
    </Modal>
  )
}
