'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreateRoomPanel } from './construction/create-room-panel'
import { createRoomFromForm } from './api/create-room'
import { useActionFeedback } from './hooks/use-action-feedback'
import { DEFAULT_ROOM_FILTERS, type RoomFilters, useRoomLobby } from './hooks/use-room-lobby'
import { useGameSession } from './hooks/use-game-session'
import { RoomCover } from './construction/room-cover'
import styles from './game-shell.module.css'

export function PipelineLobby() {
  const session = useGameSession()
  const router = useRouter()
  const lobby = useRoomLobby(session.api, session.user?.id)
  const feedback = useActionFeedback()
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const { filters, setFilters } = lobby
  const hasFilters = Boolean(filters.search.trim() || filters.cost !== 'all' || filters.mine)

  useEffect(() => {
    if (!session.user && filters.mine) setFilters({ mine: false })
  }, [session.user, filters.mine, setFilters])

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('novo')) setShowCreate(true)
  }, [])

  const createRoom = (form: HTMLFormElement) => feedback.run(async () => {
    const result = await createRoomFromForm(session.api, form)
    setShowCreate(false)
    router.push(`/jogo/torre/?id=${encodeURIComponent(result.room.id)}`)
  })

  return (
    <main className={styles.game}>
      <header className={styles.dashboardPageHeading}>
        <div>
          <p className={styles.eyebrow}>GNUverse · Comunidade</p>
          <h1>Open Pipeline</h1>
          <p>Escolha uma sala para ligar esteiras com a comunidade.</p>
        </div>
        <button
          type="button"
          className={styles.primary}
          onClick={() => {
            feedback.setError('')
            if (!session.user) {
              router.push('/login/?next=%2Fjogo%2F%3Fnovo%3D1&notice=login-required')
              return
            }
            setShowCreate(true)
          }}
        >
          Nova sala
        </button>
      </header>

      {feedback.notice && <p className={styles.message} role="status">{feedback.notice}</p>}
      {showCreate && (
        <CreateRoomPanel
          key={lobby.rules ? 'ready' : 'loading'}
          busy={feedback.busy}
          error={feedback.error || (lobby.connection === 'offline' ? 'Servidor indisponível. Reconectando…' : '')}
          loading={!lobby.rules}
          loginHref={session.user ? undefined : '/login/?next=%2Fjogo%2F%3Fnovo%3D1'}
          maxCost={Number(lobby.rules?.maxCost ?? 0)}
          defaultCost={Number(lobby.rules?.defaultCost ?? 0)}
          minContributions={Number(lobby.rules?.minContributions ?? 1)}
          onClose={() => setShowCreate(false)}
          onCreateRoom={createRoom}
        />
      )}

      <section className={styles.roomDashboard} aria-labelledby="room-dashboard-title">
        <div className={styles.dashboardHeading}>
          <div>
            <h2 id="room-dashboard-title">Salas</h2>
            <p role="status">{lobby.connection === 'connecting' ? 'Buscando salas…' : `${lobby.total} ${lobby.total === 1 ? 'sala encontrada' : 'salas encontradas'}`}</p>
          </div>
          <span className={`${styles.connection} ${lobby.connection === 'live' ? styles.live : ''}`}>
            <i />
            {lobby.connection === 'live' ? 'Atualizado ao vivo' : lobby.connection === 'connecting' ? 'Carregando' : 'Offline'}
          </span>
        </div>
        <form className={styles.roomFilters} role="search" aria-label="Pesquisar e filtrar salas" onSubmit={(event) => {
          event.preventDefault()
          setFilters({ search: search.trim() })
        }}>
          <div className={styles.roomSearch}>
            <label htmlFor="room-search">Pesquisar salas</label>
            <div className={styles.roomSearchInput}>
              <input id="room-search" type="search" placeholder="Nome da sala" maxLength={60} value={search}
                onChange={(event) => setSearch(event.target.value)} />
              <button type="submit" className={styles.secondary}>Pesquisar</button>
            </div>
          </div>
          <label>
            Custo de referência
            <select value={filters.cost} onChange={(event) => setFilters({ cost: event.target.value as RoomFilters['cost'] })}>
              <option value="all">Todos os custos</option>
              <option value="free">Gratuitas</option>
              <option value="paid">Com custo</option>
            </select>
          </label>
          <label>
            Ordenar por
            <select value={filters.sort} onChange={(event) => setFilters({ sort: event.target.value as RoomFilters['sort'] })}>
              <option value="oldest">Ordem de criação</option>
              <option value="name">Nome (A–Z)</option>
              <option value="cost-asc">Menor custo</option>
              <option value="cost-desc">Maior custo</option>
              <option value="belts-desc">Mais esteiras</option>
            </select>
          </label>
          <div className={styles.roomFilterActions}>
            <label className={styles.mineFilter}>
              <input type="checkbox" checked={filters.mine} disabled={!session.user}
                onChange={(event) => setFilters({ mine: event.target.checked })} />
              Minhas salas
            </label>
            <button type="button" className={styles.clearRoomFilters}
              disabled={!hasFilters && !search && filters.sort === 'oldest'} onClick={() => {
              setSearch('')
              setFilters(DEFAULT_ROOM_FILTERS)
            }}>Limpar filtros</button>
          </div>
        </form>
        {!session.user && <p className={styles.filterHint}><a href="/login/?next=%2Fjogo%2F">Entre na sua conta</a> para ver as salas que você criou.</p>}
        <div aria-busy={lobby.connection === 'connecting'}>
          {lobby.rooms.length ? (
            <div className={styles.roomGrid}>
              {lobby.rooms.map((room) => (
                <a className={styles.roomCard} key={room.id} href={`/jogo/torre/?id=${encodeURIComponent(room.id)}`}>
                  <RoomCover room={room} />
                  <span className={styles.roomCardInfo}>
                    <span className={styles.roomCardTop}>
                      <span>{room.beltCount} esteiras</span><span aria-hidden="true">↗</span>
                    </span>
                    <strong>{room.name}</strong>
                    <span className={styles.roomCardMeta}>Custo ref.: {room.cost} moedas</span>
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className={styles.emptyRooms}>
              {lobby.connection === 'connecting' ? 'Carregando salas…'
                : lobby.connection === 'offline' ? 'Não foi possível carregar as salas. Tentando reconectar…'
                : hasFilters ? 'Nenhuma sala encontrada com esses filtros.'
                : 'Nenhuma sala disponível ainda. Crie a primeira.'}
            </p>
          )}
          {lobby.pageCount > 1 && (
            <nav className={styles.pagination} aria-label="Paginação das salas">
              <button className={styles.secondary} disabled={lobby.page <= 1 || lobby.connection === 'connecting'} onClick={() => lobby.goToPage(lobby.page - 1)}>Anterior</button>
              <span>Página {lobby.page} de {lobby.pageCount}</span>
              <button className={styles.secondary} disabled={lobby.page >= lobby.pageCount || lobby.connection === 'connecting'} onClick={() => lobby.goToPage(lobby.page + 1)}>Próxima</button>
            </nav>
          )}
        </div>
      </section>
    </main>
  )
}
