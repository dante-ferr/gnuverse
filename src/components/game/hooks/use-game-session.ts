'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GameApi } from '../api/game-api'
import { type User, type Wallet } from '../model/types'

const SESSION_KEY = 'gnuverse-game-session'
type Credentials = { token: string; user: User; wallet: Wallet }

export function useGameSession() {
  const [token, setToken] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(0)
  const clear = useCallback(() => {
    setToken('')
    setUser(null)
    setWallet(null)
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* In-memory sessions remain available. */
    }
  }, [])
  const expire = useCallback(() => {
    clear()
    setNotice('Sua sessão expirou. Entre novamente para construir.')
  }, [clear])
  const api = useMemo(() => new GameApi(token, expire), [token, expire])

  useEffect(() => {
    try {
      setToken(sessionStorage.getItem(SESSION_KEY) || '')
    } catch {
      /* Storage may be unavailable. */
    }
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!token) return
    let active = true
    const refresh = () =>
      api
        .request<{ user: User; wallet: Wallet }>('/api/me')
        .then((result) => {
          if (active) {
            setUser(result.user)
            setWallet(result.wallet)
          }
        })
        .catch(() => {})
    void refresh()
    const interval = setInterval(refresh, 5000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [token, api])

  async function authenticate(
    mode: 'login' | 'register',
    form: HTMLFormElement,
  ) {
    const data = new FormData(form)
    const result = await api.request<Credentials>(`/api/${mode}`, {
      email: data.get('email'),
      password: data.get('password'),
      ...(mode === 'register' ? { nickname: data.get('nickname') } : {}),
    })
    try {
      sessionStorage.setItem(SESSION_KEY, result.token)
    } catch {
      /* Keep session in memory. */
    }
    setToken(result.token)
    setUser(result.user)
    setWallet(result.wallet)
    setNotice('')
  }
  async function logout() {
    await api.request('/api/logout', {})
    clear()
  }
  const secondsToCoin = wallet?.nextCoinAt
    ? Math.max(0, Math.ceil((wallet.nextCoinAt - now) / 1000))
    : 0
  return {
    api,
    user,
    wallet,
    notice,
    secondsToCoin,
    authenticate,
    logout,
    setWallet,
  }
}
