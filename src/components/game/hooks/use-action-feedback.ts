'use client'
import { useRef, useState } from 'react'

const failureMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : 'O servidor não respondeu. Confira a conexão.'

export function useActionFeedback() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const running = useRef(false)
  const queued = useRef(0)
  const queueTail = useRef<Promise<void>>(Promise.resolve())
  const settle = () => setBusy(running.current || queued.current > 0)
  /** Exclusive action: ignored while another `run` is in flight (buttons, purchases). */
  async function run(action: () => Promise<void>) {
    if (running.current) return
    running.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
    } catch (cause) {
      setError(failureMessage(cause))
    } finally {
      running.current = false
      settle()
    }
  }
  /**
   * Ordered action: waits for earlier queued actions instead of being dropped.
   * Canvas placements use this so a fast second stroke is never lost.
   */
  function queue(action: () => Promise<void>) {
    queued.current++
    setBusy(true)
    const next = queueTail.current
      .then(() => {
        setError('')
        return action()
      })
      .catch((cause) => setError(failureMessage(cause)))
      .finally(() => {
        queued.current--
        settle()
      })
    queueTail.current = next
    return next
  }
  return { busy, error, notice, setError, setNotice, run, queue }
}
