import { useState } from 'react'
import { ArrowRight, Check, ShieldCheck, TrendingUp } from 'lucide-react'
import { authService } from '../../services/authService.js'
import { errorMessage } from '../../services/errors.js'
import { Brand, Alert } from '../../components/UI.jsx'
export default function AuthPage({ recovery = false, onRecovered }) {
  const [mode, setMode] = useState(recovery ? 'password' : 'login'),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [success, setSuccess] = useState(false)
  const [form, setForm] = useState({
    nome: '',
    email: '',
    password: '',
    confirm: '',
  })
  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm({ ...form, [name]: e.target.value }),
  })
  const changeMode = (next) => {
    setMode(next)
    setMessage('')
    setSuccess(false)
  }
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    setSuccess(false)
    try {
      if (
        ['signup', 'password'].includes(mode) &&
        form.password !== form.confirm
      )
        throw new Error('As senhas não coincidem.')
      if (mode === 'login') await authService.login(form.email, form.password)
      if (mode === 'signup') {
        const data = await authService.signup(
          form.nome,
          form.email,
          form.password,
        )
        if (!data.session) {
          setMessage(
            'Confira seu e-mail para confirmar o cadastro. Depois, entre na sua conta.',
          )
          setSuccess(true)
        }
      }
      if (mode === 'recover') {
        await authService.recover(form.email)
        setMessage(
          'Se o e-mail estiver cadastrado, enviaremos o link de recuperação.',
        )
        setSuccess(true)
      }
      if (mode === 'password') {
        await authService.password(form.password)
        onRecovered()
      }
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  const titles = {
    login: 'Bom ter você de volta.',
    signup: 'Seu próximo capítulo começa aqui.',
    recover: 'Vamos recuperar seu acesso.',
    password: 'Uma nova senha para sua conta.',
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-content">
          <span className="story-badge">
            <span /> SUA VIDA FINANCEIRA, MAIS LEVE
          </span>
          <h1>
            Mais controle hoje.
            <br />
            <span>Mais liberdade amanhã.</span>
          </h1>
          <p>
            Entenda seu dinheiro, cuide dos seus objetivos e faça planos com
            confiança.
          </p>
          <div className="story-illustration">
            <div className="illustration-icon">
              <TrendingUp size={42} />
            </div>
            <div>
              <span>UM PASSO DE CADA VEZ</span>
              <h3>Seu futuro merece um plano.</h3>
              <div className="illustration-bars">
                {[28, 43, 35, 60, 51, 76, 92].map((n, i) => (
                  <i key={i} style={{ height: `${n}%` }} />
                ))}
              </div>
            </div>
          </div>
          <div className="story-features">
            {[
              'Tudo em um só lugar',
              'Metas que fazem sentido',
              'Insights para seu dia a dia',
            ].map((t) => (
              <span key={t}>
                <Check size={16} />
                {t}
              </span>
            ))}
          </div>
        </div>
        <small>FinanCerto · Clareza para ir mais longe.</small>
      </section>
      <section className="auth-panel">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow">BEM-VINDO AO FINANCERTO</span>
          <h2>{titles[mode]}</h2>
          <p>
            {mode === 'signup'
              ? 'Crie sua conta gratuita. Seu planejamento vem no próximo passo.'
              : mode === 'login'
                ? 'Entre para cuidar do que importa para você.'
                : 'Preencha os dados abaixo para continuar.'}
          </p>
          <form className="form" onSubmit={submit}>
            {mode === 'signup' && (
              <label>
                Seu nome
                <input
                  required
                  autoComplete="name"
                  maxLength={100}
                  placeholder="Como podemos chamar você?"
                  {...field('nome')}
                />
              </label>
            )}
            {mode !== 'password' && (
              <label>
                E-mail
                <input
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                  {...field('email')}
                />
              </label>
            )}
            {mode !== 'recover' && (
              <label>
                Senha
                <input
                  required
                  type="password"
                  minLength={mode === 'login' ? 1 : 8}
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  placeholder={
                    mode === 'login' ? 'Sua senha' : 'Pelo menos 8 caracteres'
                  }
                  {...field('password')}
                />
              </label>
            )}
            {['signup', 'password'].includes(mode) && (
              <label>
                Confirme a senha
                <input
                  required
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  {...field('confirm')}
                />
              </label>
            )}
            {mode === 'login' && (
              <button
                type="button"
                className="text-button align-right"
                onClick={() => changeMode('recover')}
              >
                Esqueci minha senha
              </button>
            )}
            <Alert success={success}>{message}</Alert>
            <button className="button" disabled={busy}>
              {busy
                ? 'Aguarde…'
                : {
                    login: 'Entrar na minha conta',
                    signup: 'Criar conta gratuita',
                    recover: 'Enviar link de recuperação',
                    password: 'Salvar nova senha',
                  }[mode]}
              <ArrowRight size={18} />
            </button>
          </form>
          {!recovery && (
            <div className="auth-switch">
              {mode === 'login'
                ? 'Ainda não tem uma conta?'
                : 'Já tem uma conta?'}{' '}
              <button
                className="text-button"
                onClick={() =>
                  changeMode(mode === 'login' ? 'signup' : 'login')
                }
              >
                {mode === 'login' ? 'Comece aqui' : 'Entrar'}
              </button>
            </div>
          )}
          <div className="auth-security">
            <ShieldCheck size={17} />
            Um espaço privado para suas finanças.
          </div>
        </div>
      </section>
    </main>
  )
}
