import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AuthProvider from './contexts/AuthProvider.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import App from './app/App.jsx'
import './styles/tokens.css'
import './styles/app.css'
import './styles/auth.css'
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
