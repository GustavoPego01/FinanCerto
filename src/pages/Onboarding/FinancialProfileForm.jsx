import { useState } from 'react'
import { profileService } from '../../services/profileService.js'
import { errorMessage } from '../../services/errors.js'
import { Alert } from '../../components/UI.jsx'
export default function FinancialProfileForm({
  user,
  profile,
  onSaved,
  onboarding = false,
}) {
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('')
  const [form, setForm] = useState({
    nome: profile.nome || user.user_metadata?.nome || '',
    occupation: profile.occupation || '',
    monthly_income: profile.monthly_income ?? '',
    income_type: profile.income_type || 'Fixa',
    financial_goal: profile.financial_goal || 'Organizar minhas finanças',
    has_debts: profile.has_debts ?? false,
    has_reserve: profile.has_reserve ?? false,
    fixed_expenses: profile.fixed_expenses ?? '',
    risk_profile: profile.risk_profile || 'Conservador',
    investment_experience: profile.investment_experience || 'Iniciante',
  })
  const field = (name) => ({
    value: String(form[name]),
    onChange: (e) =>
      setForm({
        ...form,
        [name]: ['has_debts', 'has_reserve'].includes(name)
          ? e.target.value === 'true'
          : e.target.value,
      }),
  })
  const show = (n) => !onboarding || n === step
  async function submit(e) {
    e.preventDefault()
    if (onboarding && step < 2) {
      setStep(step + 1)
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await profileService.save(user, {
        ...form,
        monthly_income: Number(form.monthly_income),
        fixed_expenses: Number(form.fixed_expenses),
      })
      await onSaved()
      setMessage('Perfil atualizado.')
    } catch (err) {
      setMessage(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="form" onSubmit={submit}>
      {onboarding && (
        <>
          <div className="step-indicators">
            {['Sua rotina', 'Seus objetivos', 'Seu momento'].map((label, i) => (
              <span className={i <= step ? 'active' : ''} key={label}>
                <b>{i + 1}</b>
                {label}
              </span>
            ))}
          </div>
          <h2>
            {
              [
                'Vamos conhecer você',
                'Dê uma direção ao seu dinheiro',
                'Um plano que respeita seu momento',
              ][step]
            }
          </h2>
        </>
      )}
      {show(0) && (
        <>
          <label>
            Nome
            <input
              required
              maxLength={100}
              autoComplete="name"
              {...field('nome')}
            />
          </label>
          <label>
            Profissão
            <input
              required
              maxLength={100}
              placeholder="Ex.: Professor, autônomo, estudante"
              {...field('occupation')}
            />
          </label>
          <div className="form-grid">
            <label>
              Renda mensal (R$)
              <input
                required
                type="number"
                min="0"
                max="999999999"
                step="0.01"
                {...field('monthly_income')}
              />
            </label>
            <label>
              Tipo de renda
              <select {...field('income_type')}>
                {['Fixa', 'Variável', 'Mista', 'Sem renda'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}
      {show(1) && (
        <>
          <label>
            Principal objetivo
            <select {...field('financial_goal')}>
              {[
                ...new Set([
                  form.financial_goal,
                  'Organizar minhas finanças',
                  'Quitar dívidas',
                  'Criar uma reserva',
                  'Comprar uma casa',
                  'Viajar',
                  'Investir',
                  'Abrir um negócio',
                ]),
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Possui dívidas?
            <select {...field('has_debts')}>
              <option value="false">Não</option>
              <option value="true">Sim</option>
            </select>
          </label>
          <label>
            Possui reserva financeira?
            <select {...field('has_reserve')}>
              <option value="false">Não</option>
              <option value="true">Sim</option>
            </select>
          </label>
          <label>
            Gastos fixos aproximados (R$)
            <input
              required
              type="number"
              min="0"
              max="999999999"
              step="0.01"
              {...field('fixed_expenses')}
            />
          </label>
        </>
      )}
      {show(2) && (
        <>
          <label>
            Como você se identifica em relação ao risco?
            <select {...field('risk_profile')}>
              {['Conservador', 'Moderado', 'Arrojado'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Experiência com investimentos
            <select {...field('investment_experience')}>
              {['Iniciante', 'Intermediária', 'Avançada'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <p className="muted">
            Usamos essas informações para personalizar conteúdos educativos.
            Você pode alterá-las no perfil.
          </p>
        </>
      )}
      <Alert success={message === 'Perfil atualizado.'}>{message}</Alert>
      <div className="form-actions">
        {onboarding && step > 0 && (
          <button
            type="button"
            className="button secondary"
            onClick={() => setStep(step - 1)}
          >
            Voltar
          </button>
        )}
        <button className="button" disabled={busy}>
          {busy
            ? 'Salvando…'
            : onboarding && step < 2
              ? 'Continuar'
              : onboarding
                ? 'Começar meu planejamento'
                : 'Salvar perfil'}
        </button>
      </div>
    </form>
  )
}
