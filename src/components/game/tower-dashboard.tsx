'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreateTowerPanel } from './construction/create-tower-panel'
import { createTowerFromForm } from './api/create-tower'
import { useActionFeedback } from './hooks/use-action-feedback'
import { DEFAULT_TOWER_FILTERS, type TowerFilters, useTowerLobby } from './hooks/use-tower-lobby'
import { useGameSession } from './hooks/use-game-session'
import { TowerCover } from './construction/tower-cover'
import styles from './tower-game.module.css'

export function TowerDashboard() {
  const session = useGameSession()
  const router = useRouter()
  const lobby = useTowerLobby(session.api, session.user?.id)
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

  const createTower = (form: HTMLFormElement) => feedback.run(async () => {
    const result = await createTowerFromForm(session.api, form)
    setShowCreate(false)
    router.push(`/jogo/torre/?id=${encodeURIComponent(result.tower.id)}`)
  })

  return (
    <main className={styles.game}>
      <header className={styles.dashboardPageHeading}>
        <div>
          <p className={styles.eyebrow}>GNUverse · Comunidade</p>
          <h1>Árvores na caverna</h1>
          <p>Escolha uma sala para cultivar galhos com a comunidade.</p>
        </div>
        <button type="button" className={styles.primary} onClick={() => {
          feedback.setError('')
          if (!session.user) {
            router.push('/login/?next=%2Fjogo%2F%3Fnovo%3D1&notice=login-required')
            return
          }
          setShowCreate(true)
        }}>Nova caverna</button>
      </header>

      {feedback.notice && <p className={styles.message} role="status">{feedback.notice}</p>}
      {showCreate && (
        <CreateTowerPanel
          key={lobby.rules ? 'ready' : 'loading'}
          busy={feedback.busy}
          error={feedback.error || (lobby.connection === 'offline' ? 'Servidor indisponível. Reconectando…' : '')}
          loading={!lobby.rules}
          loginHref={session.user ? undefined : '/login/?next=%2Fjogo%2F%3Fnovo%3D1'}
          maxCost={Number(lobby.rules?.maxCost ?? 0)}
          defaultCost={Number(lobby.rules?.defaultCost ?? 0)}
          minContributions={Number(lobby.rules?.minContributions ?? 1)}
          onClose={() => setShowCreate(false)}
          onCreateTower={createTower}
        />
      )}

      <section className={styles.towerDashboard} aria-labelledby="tower-dashboard-title">
        <div className={styles.dashboardHeading}>
          <div>
            <h2 id="tower-dashboard-title">Cavernas disponíveis</h2>
            <p role="status">{lobby.connection === 'connecting' ? 'Buscando salas…' : `${lobby.total} ${lobby.total === 1 ? 'sala encontrada' : 'salas encontradas'}`}</p>
          </div>
          <span className={`${styles.connection} ${lobby.connection === 'live' ? styles.live : ''}`}>
            <i />
            {lobby.connection === 'live' ? 'Atualizado ao vivo' : lobby.connection === 'connecting' ? 'Carregando' : 'Offline'}
          </span>
        </div>
        <form className={styles.towerFilters} role="search" aria-label="Pesquisar e filtrar salas" onSubmit={(event) => {
          event.preventDefault()
          setFilters({ search: search.trim() })
        }}>
          <div className={styles.towerSearch}>
            <label htmlFor="tower-search">Pesquisar salas</label>
            <div className={styles.towerSearchInput}>
              <input id="tower-search" type="search" placeholder="Nome da caverna" maxLength={60} value={search}
                onChange={(event) => setSearch(event.target.value)} />
              <button type="submit" className={styles.secondary}>Pesquisar</button>
            </div>
          </div>
          <label>
            Custo de referência
            <select value={filters.cost} onChange={(event) => setFilters({ cost: event.target.value as TowerFilters['cost'] })}>
              <option value="all">Todos os custos</option>
              <option value="free">Gratuitas</option>
              <option value="paid">Com custo</option>
            </select>
          </label>
          <label>
            Ordenar por
            <select value={filters.sort} onChange={(event) => setFilters({ sort: event.target.value as TowerFilters['sort'] })}>
              <option value="oldest">Ordem de criação</option>
              <option value="name">Nome (A–Z)</option>
              <option value="cost-asc">Menor custo</option>
              <option value="cost-desc">Maior custo</option>
              <option value="segments-desc">Mais galhos</option>
            </select>
          </label>
          <div className={styles.towerFilterActions}>
            <label className={styles.mineFilter}>
              <input type="checkbox" checked={filters.mine} disabled={!session.user}
                onChange={(event) => setFilters({ mine: event.target.checked })} />
              Minhas salas
            </label>
            <button type="button" className={styles.clearTowerFilters}
              disabled={!hasFilters && !search && filters.sort === 'oldest'} onClick={() => {
              setSearch('')
              setFilters(DEFAULT_TOWER_FILTERS)
            }}>Limpar filtros</button>
          </div>
        </form>
        {!session.user && <p className={styles.filterHint}><a href="/login/?next=%2Fjogo%2F">Entre na sua conta</a> para ver as torres que você criou.</p>}
        <div aria-busy={lobby.connection === 'connecting'}>
          {lobby.towers.length ? (
            <div className={styles.towerGrid}>
              {lobby.towers.map((tower) => (
                <a className={styles.towerCard} key={tower.id} href={`/jogo/torre/?id=${encodeURIComponent(tower.id)}`}>
                  <TowerCover tower={tower} />
                  <span className={styles.towerCardInfo}>
                    <span className={styles.towerCardTop}>
                      <span>{tower.segmentCount} galhos</span><span aria-hidden="true">↗</span>
                    </span>
                    <strong>{tower.name}</strong>
                    <span className={styles.towerCardMeta}>Custo ref.: {tower.cost} moedas</span>
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className={styles.emptyTowers}>
              {lobby.connection === 'connecting' ? 'Carregando torres…'
                : lobby.connection === 'offline' ? 'Não foi possível carregar as torres. Tentando reconectar…'
                : hasFilters ? 'Nenhuma torre encontrada com esses filtros.'
                : 'Nenhuma torre disponível ainda. Crie a primeira.'}
            </p>
          )}
          {lobby.pageCount > 1 && (
            <nav className={styles.pagination} aria-label="Paginação das torres">
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
