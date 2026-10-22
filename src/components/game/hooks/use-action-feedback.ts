'use client'
import { useRef, useState } from 'react'

export function useActionFeedback() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const running = useRef(false)
  async function run(action: () => Promise<void>) {
    if (running.current) return
    running.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'O servidor não respondeu. Confira a conexão.',
      )
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  return { busy, error, notice, setError, setNotice, run }
}
