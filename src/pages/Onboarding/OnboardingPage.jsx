import { Brand } from '../../components/UI.jsx'
import { authService } from '../../services/authService.js'
import FinancialProfileForm from './FinancialProfileForm.jsx'
export default function OnboardingPage({ user, profile, onSaved }) {
  return (
    <main className="onboarding-page">
      <Brand />
      <section className="card onboarding-card">
        <span className="eyebrow">FEITO PARA O SEU MOMENTO</span>
        <FinancialProfileForm
          user={user}
          profile={profile}
          onSaved={onSaved}
          onboarding
        />
      </section>
      <button
        className="text-button"
        onClick={() =>
          authService.logout().catch(() => window.location.reload())
        }
      >
        Sair da conta
      </button>
    </main>
  )
}
