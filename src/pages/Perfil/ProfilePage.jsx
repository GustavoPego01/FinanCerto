import { useState } from 'react'
import { PageHeading, Alert } from '../../components/UI.jsx'
import FinancialProfileForm from '../Onboarding/FinancialProfileForm.jsx'
import { profileService } from '../../services/profileService.js'
import { authService } from '../../services/authService.js'
import { errorMessage } from '../../services/errors.js'
import WhatsAppConnection from '../../components/WhatsApp/WhatsAppConnection.jsx'
export default function ProfilePage({ finance, user }) {
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false)
  async function toggle() {
    setBusy(true)
    setMessage('')
    try {
      await profileService.preferences(
        user.id,
        !finance.preferences.notifications_enabled,
      )
      await finance.reload()
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  async function recover() {
    setBusy(true)
    try {
      await authService.recover(user.email)
      setMessage('Link enviado. Confira seu e-mail para alterar a senha.')
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="DO SEU JEITO"
        title="Meu perfil"
        description="Seu planejamento acompanha as mudanças da sua vida."
      />
      <div className="dashboard-columns">
        <article className="card">
          <h2>Seu perfil financeiro</h2>
          <FinancialProfileForm
            user={user}
            profile={finance.profile}
            onSaved={finance.reload}
          />
        </article>
        <div className="stack">
          <article className="card">
            <h2>Sua conta</h2>
            <p className="break-word">{user.email}</p>
            <span className="badge">
              Plano {finance.preferences.plan || 'FREE'}
            </span>
            <p>
              Pro e Premium fazem parte da evolução do FinanCerto. Nenhuma
              cobrança está ativa.
            </p>
            <button
              className="button secondary"
              onClick={recover}
              disabled={busy}
            >
              Alterar senha por e-mail
            </button>
          </article>
          <article className="card">
            <h2>Preferências</h2>
            <label className="check-label">
              <input
                type="checkbox"
                checked={finance.preferences.notifications_enabled !== false}
                disabled={busy}
                onChange={toggle}
              />
              Gerar notificações internas
            </label>
            <p>Os alertas são atualizados ao abrir e usar o aplicativo.</p>
            <Alert success={message.startsWith('Link enviado')}>
              {message}
            </Alert>
          </article>
          <WhatsAppConnection />
        </div>
      </div>
    </>
  )
}
