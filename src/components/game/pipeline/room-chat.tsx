'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
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
  /** When false, omit the section title (parent chrome supplies it). */
  showHeading?: boolean
}

/** Room sidebar chat: history, compose for signed-in users, login redirect for guests. */
export function RoomChat({
  messages,
  user,
  loginHref,
  maxLength,
  busy,
  onSend,
  showHeading = true,
}: Props) {
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

  const sendMessage = useCallback(() => {
    if (!user || busy) return false
    const text = draft.trim()
    if (!text) return false
    onSend(text)
    setDraft('')
    stickToBottomRef.current = true
    return true
  }, [user, busy, draft, onSend])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    sendMessage()
  }

  const onComposeKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    sendMessage()
  }

  return (
    <section
      className={styles.roomChat}
      aria-labelledby={showHeading ? 'room-chat-heading' : undefined}
      aria-label={showHeading ? undefined : 'Mensagens do chat'}
    >
      {showHeading ? (
        <h2 id="room-chat-heading" className={styles.sidebarSectionTitle}>
          Chat
        </h2>
      ) : null}
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
              onKeyDown={onComposeKeyDown}
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