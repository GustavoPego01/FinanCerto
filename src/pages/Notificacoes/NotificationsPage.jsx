import { useState } from 'react'
import { PageHeading, EmptyState, Alert } from '../../components/UI.jsx'
import { notificationsService } from '../../services/notificationsService.js'
import { errorMessage } from '../../services/errors.js'
import { formatDate } from '../../utils/date.js'
export default function NotificationsPage({ finance, user }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(null)
  async function read(id) {
    setBusy(id)
    try {
      await notificationsService.markRead(user.id, id)
      await finance.reload()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="NO SEU RITMO"
        title="Notificações"
        description="Lembretes e sinais importantes para seu planejamento."
      />
      <Alert>{error}</Alert>
      <article className="card">
        {finance.notifications.length ? (
          finance.notifications.map((n) => (
            <div
              className={`notification-item ${n.read ? 'read' : ''}`}
              key={n.id}
            >
              <div>
                <span className="badge">{formatDate(n.created_at)}</span>
                <h3>{n.title}</h3>
                <p>{n.message}</p>
              </div>
              {!n.read && (
                <button
                  className="text-button"
                  disabled={busy === n.id}
                  onClick={() => read(n.id)}
                >
                  Marcar como lida
                </button>
              )}
            </div>
          ))
        ) : (
          <EmptyState
            title="Tudo em dia por aqui"
            message="Seus alertas financeiros aparecerão neste espaço."
          />
        )}
      </article>
    </>
  )
}
