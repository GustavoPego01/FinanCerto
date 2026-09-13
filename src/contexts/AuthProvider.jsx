import { useEffect, useState } from 'react'
import { supabase } from '../supabase/client.js'
import { AuthContext } from './AuthContext.js'
export default function AuthProvider({ children }) {
  const [state, setState] = useState({
    session: null,
    loading: true,
    error: null,
    recovery: new URLSearchParams(window.location.search).has('recovery'),
  })
  useEffect(() => {
    if (!supabase) return
    let active = true,
      eventReceived = false
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      eventReceived = true
      if (active)
        setState((previous) => ({
          session,
          loading: false,
          error: null,
          recovery: event === 'PASSWORD_RECOVERY' || previous.recovery,
        }))
    })
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active && !eventReceived)
          setState((previous) => ({
            ...previous,
            session: data?.session ?? null,
            loading: false,
            error,
          }))
      })
      .catch((error) => {
        if (active)
          setState((previous) => ({ ...previous, loading: false, error }))
      })
    const timeout = setTimeout(() => {
      if (active)
        setState((previous) =>
          previous.loading
            ? {
                ...previous,
                loading: false,
                error: new Error(
                  'A conexão demorou. Tente recarregar a página.',
                ),
              }
            : previous,
        )
    }, 15000)
    return () => {
      active = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])
  return (
    <AuthContext.Provider
      value={{
        ...state,
        user: state.session?.user ?? null,
        finishRecovery: () => {
          window.history.replaceState(null, '', '/')
          setState((previous) => ({ ...previous, recovery: false }))
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
