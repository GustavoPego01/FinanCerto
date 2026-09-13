import { useEffect, useState } from 'react'
import { supabase } from '../../supabase/client.js'
import { Alert } from '../UI.jsx'
async function invoke(action) {
  const { data, error } = await supabase.functions.invoke('whatsapp-link', {
    body: { action },
  })
  if (error || data?.error)
    throw new Error(
      data?.error ||
        'Não foi possível acessar a conexão WhatsApp. Tente novamente.',
    )
  return data
}
export default function WhatsAppConnection() {
  const [status, setStatus] = useState(null),
    [code, setCode] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    const refresh = () =>
      invoke('status')
        .then((data) => {
          if (active) {
            setStatus(data)
            if (data.connection?.status === 'active') setCode(null)
          }
        })
        .catch((e) => {
          if (active) setError(e.message)
        })
    refresh()
    const timer = setInterval(refresh, 10000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])
  async function act(action) {
    setBusy(true)
    setError('')
    try {
      const data = await invoke(action)
      setCode(action === 'request_code' ? data : null)
      setStatus(await invoke('status'))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  const connected =
    status?.connection?.status === 'active' && status.connection.verified
  return (
    <article className="card">
      <h2>WhatsApp</h2>
      <span className="badge">
        {connected
          ? 'Conectado'
          : status
            ? 'Não vinculado'
            : 'Verificando conexão…'}
      </span>
      <p>
        {connected
          ? status.connection.phone_e164
          : 'Registre e consulte suas finanças por mensagem.'}
      </p>
      {status && !status.configured && (
        <p>
          A ativação do número empresarial +55 62 98276-7026 está aguardando
          configuração na Meta.
        </p>
      )}
      {connected ? (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => act('disconnect')}
        >
          Desconectar WhatsApp
        </button>
      ) : (
        <button
          className="button secondary"
          disabled={busy || !status?.configured}
          onClick={() => act('request_code')}
        >
          Gerar código de vínculo
        </button>
      )}
      {code && (
        <div className="stack">
          <p>
            Envie <strong>VINCULAR {code.code}</strong> para +55 62 98276-7026.
            Válido até {new Date(code.expiresAt).toLocaleTimeString('pt-BR')}.
            Não compartilhe o código.
          </p>
          <a
            className="button secondary"
            href={code.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir WhatsApp
          </a>
        </div>
      )}
      <Alert>{error}</Alert>
    </article>
  )
}
