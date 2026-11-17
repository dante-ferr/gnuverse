'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { formatGameDate } from '../model/presentation'
import type { ChatMessage, User } from '../model/types'
import styles from '../game-shell.module.css'

const SCROLL_NEAR_BOTTOM_PX = 48

type Props = {
  messages: ChatMessage[]
  user: User | null
  loginHref: string
  maxLength: number
  busy?: boolean
  onSend: (text: string) => void
}

/** Room sidebar chat: history, compose for signed-in users, login redirect for guests. */
export function RoomChat({ messages, user, loginHref, maxLength, busy, onSend }: Props) {
  const [draft, setDraft] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  const scrollToBottom = useCallback(() => {
    const node = logRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [])

  const onLogScroll = () => {
    const node = logRef.current
    if (!node) return
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight
    stickToBottomRef.current = distance <= SCROLL_NEAR_BOTTOM_PX
  }

  useEffect(() => {
    if (stickToBottomRef.current) scrollToBottom()
  }, [messages, scrollToBottom])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!user) return
    const text = draft.trim()
    if (!text || busy) return
    onSend(text)
    setDraft('')
    stickToBottomRef.current = true
  }

  return (
    <section className={`${styles.roomChat} ${styles.sidebarBlock}`} aria-labelledby="room-chat-heading">
      <h2 id="room-chat-heading" className={styles.sidebarSectionTitle}>
        Chat
      </h2>
      <div
        ref={logRef}
        className={styles.roomChatLog}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        onScroll={onLogScroll}
      >
        {messages.length === 0 ? (
          <p className={styles.controlsHint}>Nenhuma mensagem.</p>
        ) : (
          <ul className={styles.roomChatList}>
            {messages.map((message) => (
              <li key={message.id} className={styles.roomChatMessage}>
                <p className={styles.roomChatBody}>
                  <strong>{message.authorNickname}</strong>
                  <span>{message.text}</span>
                </p>
                <time className={styles.roomChatTime} dateTime={new Date(message.createdAt).toISOString()}>
                  {formatGameDate(message.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
      {user ? (
        <form className={styles.roomChatForm} onSubmit={submit}>
          <label className={styles.roomChatField}>
            Escreva uma mensagem
            <textarea
              value={draft}
              disabled={busy}
              maxLength={maxLength}
              rows={2}
              placeholder="Escreva uma mensagem"
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <button type="submit" className={styles.primary} disabled={busy || !draft.trim()}>
            Enviar
          </button>
        </form>
      ) : (
        <div className={styles.roomChatGuest}>
          <p className={styles.controlsHint}>Visitantes podem ler o histórico.</p>
          <Link href={loginHref} className={styles.primary}>
            Entre para conversar
          </Link>
        </div>
      )}
    </section>
  )
}