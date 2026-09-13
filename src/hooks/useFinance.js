import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase/client.js'
import { createTransactionService } from '../services/transactionService.js'
import { profileService } from '../services/profileService.js'
import { goalsService } from '../services/goalsService.js'
import { notificationsService } from '../services/notificationsService.js'
import { errorMessage } from '../services/errors.js'
import { analyzeFinance } from '../services/financialEngineService.js'
import { monthKey } from '../utils/date.js'
const initial = {
  loading: true,
  transactions: [],
  goals: [],
  notifications: [],
  profile: {},
  preferences: {},
  errors: [],
  migrationNeeded: false,
}
function withTimeout(promise) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('A conexão demorou. Tente novamente.')),
      15000,
    )
    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}
export function useFinance(user) {
  const [state, setState] = useState(initial)
  const generation = useRef(0)
  const reload = useCallback(async () => {
    const version = ++generation.current
    const results = await Promise.allSettled(
      [
        profileService.load(user),
        createTransactionService(supabase).list(user.id),
        goalsService.list(user.id),
        notificationsService.list(user.id),
      ].map(withTimeout),
    )
    if (version !== generation.current) return
    setState((previous) => {
      const next = { ...previous, loading: false, errors: [] }
      results.forEach((r, i) => {
        if (r.status === 'rejected')
          next.errors.push(
            `${['Perfil', 'Transações', 'Metas', 'Notificações'][i]}: ${errorMessage(r.reason)}`,
          )
        else if (i === 0) Object.assign(next, r.value)
        else next[['', 'transactions', 'goals', 'notifications'][i]] = r.value
      })
      next.transactionsReady = results[1].status === 'fulfilled'
      next.profileReady = results[0].status === 'fulfilled'
      return next
    })
    if (
      results.every((r) => r.status === 'fulfilled') &&
      results[0].value.preferences.notifications_enabled !== false
    ) {
      try {
        const analysis = analyzeFinance(
          results[1].value,
          results[0].value.profile,
          results[2].value,
          monthKey(),
        )
        await notificationsService.sync(user.id, analysis.insights, monthKey())
        const notifications = await notificationsService.list(user.id)
        if (version === generation.current)
          setState((previous) => ({ ...previous, notifications }))
      } catch (error) {
        if (version === generation.current)
          setState((previous) => ({
            ...previous,
            errors: [...previous.errors, `Alertas: ${errorMessage(error)}`],
          }))
      }
    }
  }, [user])
  useEffect(() => {
    const requestGeneration = generation
    const timer = setTimeout(reload, 0)
    const onFocus = () => {
      if (document.visibilityState === 'visible') reload()
    }
    window.addEventListener('online', reload)
    document.addEventListener('visibilitychange', onFocus)
    const channel = supabase
      .channel(`finance-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        reload,
      )
      .subscribe()
    return () => {
      clearTimeout(timer)
      requestGeneration.current++
      window.removeEventListener('online', reload)
      document.removeEventListener('visibilitychange', onFocus)
      supabase.removeChannel(channel)
    }
  }, [reload, user.id])
  return { ...state, reload }
}
