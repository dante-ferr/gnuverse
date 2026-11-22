'use client'

import { useId, useState } from 'react'
import type { ChatMessage, User } from '../model/types'
import { RoomChat } from './room-chat'
import styles from '../game-shell.module.css'

type Props = {
  messages: ChatMessage[]
  user: User | null
  loginHref: string
  maxLength: number
  busy?: boolean
  onSend: (text: string) => void
}

/** Collapsible left sidebar wrapping room chat. */
export function RoomChatSidebar({
  messages,
  user,
  loginHref,
  maxLength,
  busy,
  onSend,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const panelId = useId()

  return (
    <aside
      className={
        collapsed
          ? `${styles.chatSidebar} ${styles.chatSidebarCollapsed}`
          : styles.chatSidebar
      }
      aria-label="Chat"
    >
      {collapsed ? (
        <button
          type="button"
          className={styles.chatSidebarExpandRail}
          aria-expanded={false}
          aria-controls={panelId}
          aria-label="Expandir chat"
          onClick={() => setCollapsed(false)}
        >
          <span className={styles.chatSidebarRailLabel} aria-hidden>
            Chat
          </span>
          <span className={styles.chatSidebarRailChevron} aria-hidden>
            »
          </span>
        </button>
      ) : (
        <div className={styles.chatSidebarHeader}>
          <h2 id="room-chat-heading" className={styles.sidebarSectionTitle}>
            Chat
          </h2>
          <button
            type="button"
            className={styles.chatSidebarCollapseButton}
            aria-expanded
            aria-controls={panelId}
            aria-label="Recolher chat"
            onClick={() => setCollapsed(true)}
          >
            «
          </button>
        </div>
      )}
      <div
        id={panelId}
        className={styles.chatSidebarBody}
        hidden={collapsed}
      >
        <RoomChat
          messages={messages}
          user={user}
          loginHref={loginHref}
          maxLength={maxLength}
          busy={busy}
          onSend={onSend}
          showHeading={false}
        />
      </div>
    </aside>
  )
}
