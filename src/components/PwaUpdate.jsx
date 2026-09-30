import { useRegisterSW } from 'virtual:pwa-register/react'

export default function PwaUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div className="alert" role="status">
      <p>
        Uma nova versão do FinanCerto está disponível. Salve o que estiver
        editando antes de atualizar.
      </p>
      <button
        className="button secondary"
        onClick={() => updateServiceWorker(true)}
      >
        Atualizar aplicativo
      </button>
      <button
        className="button secondary"
        onClick={() => setNeedRefresh(false)}
      >
        Mais tarde
      </button>
    </div>
  )
}
