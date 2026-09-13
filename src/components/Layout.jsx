import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  ArrowLeftRight,
  ChartNoAxesCombined,
  Target,
  Sparkles,
  BookOpen,
  UserRound,
  Bell,
  LogOut,
  Plus,
  Menu,
  Download,
  X,
} from 'lucide-react'
import { Brand, Alert } from './UI.jsx'
import { authService } from '../services/authService.js'
import { errorMessage } from '../services/errors.js'
const links = [
  ['dashboard', 'Visão geral', LayoutDashboard],
  ['transacoes', 'Transações', ArrowLeftRight],
  ['relatorios', 'Relatórios', ChartNoAxesCombined],
  ['metas', 'Minhas metas', Target],
  ['inteligencia', 'Inteligência', Sparkles],
  ['educacao', 'Aprender', BookOpen],
  ['perfil', 'Meu perfil', UserRound],
]
export default function Layout({
  page,
  navigate,
  name,
  unread,
  onNew,
  children,
}) {
  const [menu, setMenu] = useState(false),
    [install, setInstall] = useState(null),
    [error, setError] = useState(''),
    [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const prompt = (e) => {
      e.preventDefault()
      setInstall(e)
    }
    const online = () => setOffline(!navigator.onLine)
    window.addEventListener('beforeinstallprompt', prompt)
    window.addEventListener('online', online)
    window.addEventListener('offline', online)
    return () => {
      window.removeEventListener('beforeinstallprompt', prompt)
      window.removeEventListener('online', online)
      window.removeEventListener('offline', online)
    }
  }, [])
  const go = (id) => {
    navigate(id)
    setMenu(false)
  }
  async function logout() {
    try {
      await authService.logout()
    } catch (err) {
      setError(errorMessage(err))
    }
  }
  return (
    <div className="app-shell">
      {menu && (
        <button
          className="sidebar-overlay"
          aria-label="Fechar menu"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <Brand />
        <div className="nav-label">SEU ESPAÇO FINANCEIRO</div>
        <nav>
          {links.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? 'selected' : ''}
              onClick={() => go(id)}
              aria-current={page === id ? 'page' : undefined}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="plan-card">
            <Sparkles size={20} />
            <strong>
              Pequenos passos.
              <br />
              Grandes conquistas.
            </strong>
            <p>Construa uma vida financeira mais tranquila.</p>
            <span className="badge">Plano Free</span>
          </div>
          {install && (
            <button
              className="nav-action"
              onClick={async () => {
                await install.prompt()
                setInstall(null)
              }}
            >
              <Download size={18} />
              Instalar aplicativo
            </button>
          )}
          <button className="nav-action" onClick={logout}>
            <LogOut size={18} />
            Sair da conta
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="header">
          <div className="header-left">
            <button
              className="icon-button mobile-menu"
              aria-label={menu ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
            <span className="header-caption">
              Mais clareza. Mais conquistas.
            </span>
          </div>
          <div className="header-actions">
            <button
              className="icon-button notification-button"
              aria-label={`Notificações, ${unread} não lidas`}
              onClick={() => go('notificacoes')}
            >
              <Bell size={21} />
              {unread > 0 && <i />}
            </button>
            <span className="header-divider" />
            <button
              className="avatar"
              aria-label="Abrir perfil"
              onClick={() => go('perfil')}
            >
              {name?.slice(0, 1).toUpperCase() || 'F'}
            </button>
          </div>
        </header>
        <main className="main-content">
          <Alert>{error}</Alert>
          {offline && (
            <Alert>
              Você está offline. Reconecte-se para consultar e salvar seus dados
              com segurança.
            </Alert>
          )}
          {children}
        </main>
        <footer className="app-footer">
          FinanCerto <span>Seu futuro começa nas escolhas de hoje.</span>
        </footer>
      </div>
      <button
        className="floating-add"
        aria-label="Nova transação"
        onClick={onNew}
      >
        <Plus />
      </button>
      <nav className="bottom-nav">
        {links.slice(0, 4).map(([id, label, Icon]) => (
          <button
            key={id}
            className={page === id ? 'selected' : ''}
            onClick={() => go(id)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
        <button onClick={() => setMenu(true)}>
          <Menu size={20} />
          <span>Mais</span>
        </button>
      </nav>
    </div>
  )
}
