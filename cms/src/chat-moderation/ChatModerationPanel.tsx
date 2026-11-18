'use client'

import { useCallback, useEffect, useState } from 'react'
import styles from './chat-moderation.module.css'

type ModerationRoom = {
  id: string
  name: string
  creatorId: string
  chatCount: number
  lastChatAt: number | null
}

type ChatMessage = {
  id: string
  authorId: string
  authorNickname: string
  text: string
  createdAt: number
}

type RoomsResponse = { rooms: ModerationRoom[] }
type RoomDetailResponse = { room: ModerationRoom; chat: ChatMessage[] }

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function formatLastChat(value: number | null) {
  return value == null ? 'Sem mensagens' : dateTime.format(value)
}

async function request<T>(path: string, method: 'GET' | 'DELETE' = 'GET'): Promise<T> {
  const response = await fetch(`/api/game-chat${path}`, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a solicitação.')
  return data
}

export function ChatModerationPanel() {
  const [rooms, setRooms] = useState<ModerationRoom[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)

  const loadRooms = useCallback(async (active: { current: boolean }) => {
    const data = await request<RoomsResponse>('/rooms')
    if (!active.current) return
    setRooms(data.rooms)
    setSelectedId((current) => {
      if (current && data.rooms.some((room) => room.id === current)) return current
      return null
    })
  }, [])

  const loadMessages = useCallback(async (roomId: string, active: { current: boolean }) => {
    setLoadingMessages(true)
    setError('')
    try {
      const data = await request<RoomDetailResponse>(`/rooms/${encodeURIComponent(roomId)}`)
      if (!active.current) return
      setMessages(data.chat)
    } catch (reason) {
      if (active.current) setError((reason as Error).message)
    } finally {
      if (active.current) setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    const active = { current: true }
    setLoading(true)
    setError('')
    void loadRooms(active)
      .catch((reason: Error) => {
        if (active.current) setError(reason.message)
      })
      .finally(() => {
        if (active.current) setLoading(false)
      })
    return () => {
      active.current = false
    }
  }, [reload, loadRooms])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    const active = { current: true }
    void loadMessages(selectedId, active)
    return () => {
      active.current = false
    }
  }, [selectedId, reload, loadMessages])

  function selectRoom(room: ModerationRoom) {
    setSelectedId(room.id)
    setNotice('')
    setError('')
    document.getElementById('chat-editor')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  async function refreshAfterMutation(message: string) {
    const active = { current: true }
    try {
      await loadRooms(active)
      if (selectedId) await loadMessages(selectedId, active)
      setNotice(message)
    } catch (reason) {
      setError((reason as Error).message)
    }
  }

  async function clearRoomChat() {
    if (!selectedId) return
    const room = rooms.find((item) => item.id === selectedId)
    const label = room?.name || 'esta sala'
    if (
      !window.confirm(
        `Limpar todas as mensagens do chat de «${label}»? Esta ação não pode ser desfeita.`,
      )
    )
      return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request(`/rooms/${encodeURIComponent(selectedId)}/messages`, 'DELETE')
      await refreshAfterMutation('Chat da sala limpo.')
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function removeMessage(message: ChatMessage) {
    if (!selectedId) return
    if (
      !window.confirm(
        `Remover esta mensagem de ${message.authorNickname}? Esta ação não pode ser desfeita.`,
      )
    )
      return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request(
        `/rooms/${encodeURIComponent(selectedId)}/messages/${encodeURIComponent(message.id)}`,
        'DELETE',
      )
      await refreshAfterMutation('Mensagem removida.')
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const searchText = search.toLocaleLowerCase('pt-BR').trim()
  const visibleRooms = rooms.filter((room) =>
    room.name.toLocaleLowerCase('pt-BR').includes(searchText),
  )
  const selectedRoom = rooms.find((room) => room.id === selectedId) ?? null
  const totalMessages = rooms.reduce((sum, room) => sum + room.chatCount, 0)

  return (
    <main className={styles.page}>
      <a className={styles.back} href="/admin">
        ← Painel do GNUverse
      </a>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>ADMINISTRAÇÃO DO SITE</p>
          <h1>Moderação do chat</h1>
          <p>Revise e remova mensagens do chat das salas Open Pipeline.</p>
        </div>
        <button
          type="button"
          className={styles.secondary}
          disabled={loading || busy}
          onClick={() => setReload((value) => value + 1)}
        >
          Recarregar lista
        </button>
      </header>
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className={styles.notice} role="status">
          {notice}
        </div>
      )}
      {loading && <p role="status">Carregando salas…</p>}
      {!loading && (
        <>
          <div className={styles.summary}>
            <span>
              <strong>{rooms.length}</strong>{' '}
              {rooms.length === 1 ? 'sala com chat' : 'salas com chat'}
            </span>
            <span>
              <strong>{totalMessages}</strong>{' '}
              {totalMessages === 1 ? 'mensagem no total' : 'mensagens no total'}
            </span>
          </div>
          <div className={styles.layout}>
            <section className={styles.rooms} aria-labelledby="rooms-heading">
              <div className={styles.sectionHeading}>
                <h2 id="rooms-heading">Salas</h2>
              </div>
              <label className={styles.search}>
                Buscar sala
                <input
                  type="search"
                  placeholder="Nome da sala"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <div className={styles.list}>
                {!visibleRooms.length && (
                  <p className={styles.empty}>
                    {rooms.length
                      ? 'Nenhuma sala corresponde à busca.'
                      : 'Nenhuma sala Open Pipeline com histórico de chat.'}
                  </p>
                )}
                {visibleRooms.map((room) => (
                  <article
                    key={room.id}
                    className={`${styles.room} ${selectedId === room.id ? styles.selected : ''}`}
                    onClick={() => selectRoom(room)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        selectRoom(room)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selectedId === room.id}
                  >
                    <div className={styles.roomHeading}>
                      <h3>{room.name}</h3>
                    </div>
                    <div className={styles.meta}>
                      <span>
                        <strong>{room.chatCount}</strong>{' '}
                        {room.chatCount === 1 ? 'mensagem' : 'mensagens'}
                      </span>
                      <span>Última atividade: {formatLastChat(room.lastChatAt)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <section className={styles.editor} id="chat-editor" aria-labelledby="editor-heading">
              <div className={styles.sectionHeading}>
                <h2 id="editor-heading">Mensagens</h2>
              </div>
              {!selectedRoom && (
                <p className={styles.empty}>Selecione uma sala para ver o chat.</p>
              )}
              {selectedRoom && loadingMessages && (
                <p role="status">Carregando mensagens…</p>
              )}
              {selectedRoom && !loadingMessages && !messages.length && (
                <p className={styles.empty}>
                  A sala «{selectedRoom.name}» ainda não tem mensagens no histórico.
                </p>
              )}
              {selectedRoom && !loadingMessages && messages.length > 0 && (
                <>
                  <ul className={styles.messages}>
                    {messages.map((message) => (
                      <li key={message.id} className={styles.message}>
                        <div className={styles.messageHeader}>
                          <div>
                            <span className={styles.messageAuthor}>{message.authorNickname}</span>
                            <span className={styles.messageTime}>
                              {' '}
                              · {dateTime.format(message.createdAt)}
                            </span>
                          </div>
                          <button
                            type="button"
                            className={styles.danger}
                            disabled={busy}
                            onClick={() => void removeMessage(message)}
                          >
                            Remover
                            <span className={styles.srOnly}>
                              {' '}
                              mensagem de {message.authorNickname}
                            </span>
                          </button>
                        </div>
                        <p className={styles.messageText}>{message.text}</p>
                      </li>
                    ))}
                  </ul>
                  <div className={styles.editorActions}>
                    <button
                      type="button"
                      className={styles.danger}
                      disabled={busy}
                      onClick={() => void clearRoomChat()}
                    >
                      Limpar chat
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  )
}