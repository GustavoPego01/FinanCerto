import { Component } from 'react'
export default class ErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error) {
    console.error('Falha de renderização:', error.message)
  }
  render() {
    return this.state.failed ? (
      <main className="fatal-error">
        <h1>Vamos tentar de novo?</h1>
        <p>
          Não foi possível abrir esta tela. Seus dados continuam no Supabase.
        </p>
        <button className="button" onClick={() => window.location.reload()}>
          Recarregar aplicativo
        </button>
      </main>
    ) : (
      this.props.children
    )
  }
}
