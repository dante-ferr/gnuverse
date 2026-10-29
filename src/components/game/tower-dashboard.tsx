'use client'

import { useEffect, useState } from 'react'
import { CreateTowerPanel } from './construction/create-tower-panel'
import { createTowerFromForm } from './api/create-tower'
import { useActionFeedback } from './hooks/use-action-feedback'
import { useTowerLobby } from './hooks/use-tower-lobby'
import { useGameSession } from './hooks/use-game-session'
import { TowerCover } from './construction/tower-cover'
import styles from './tower-game.module.css'

export function TowerDashboard() {
  const session = useGameSession()
  const lobby = useTowerLobby(session.api)
  const feedback = useActionFeedback()
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('novo')) setShowCreate(true)
  }, [])

  const createTower = (form: HTMLFormElement) => feedback.run(async () => {
    await createTowerFromForm(session.api, form)
    await lobby.refresh(1)
    setShowCreate(false)
    feedback.setNotice('Torre criada.')
  })

  return (
    <main className={styles.game}>
      <header className={styles.dashboardPageHeading}>
        <div>
          <p className={styles.eyebrow}>GNUverse · Comunidade</p>
          <h1>Torres colaborativas</h1>
          <p>Escolha uma torre para acompanhar e construir com a comunidade.</p>
        </div>
        <button type="button" className={styles.primary} onClick={() => {
          feedback.setError('')
          setShowCreate(true)
        }}>Criar torre</button>
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
          blockIntervalMs={Number(lobby.rules?.cooldownMs ?? 0)}
          windMinBlocks={Number(lobby.rules?.windMinBlocks ?? 1)}
          windEveryBlocks={Number(lobby.rules?.windEveryBlocks ?? 1)}
          minContributions={Number(lobby.rules?.minContributions ?? 1)}
          onClose={() => setShowCreate(false)}
          onCreateTower={createTower}
        />
      )}

      <section className={styles.towerDashboard} aria-labelledby="tower-dashboard-title">
        <div className={styles.dashboardHeading}>
          <div>
            <h2 id="tower-dashboard-title">Torres disponíveis</h2>
            <p>{lobby.total == null ? 'Escolha uma torre para explorar' : `${lobby.total} ${lobby.total === 1 ? 'torre disponível' : 'torres disponíveis'}`}</p>
          </div>
          <span className={`${styles.connection} ${lobby.connection === 'live' ? styles.live : ''}`}>
            <i />
            {lobby.connection === 'live' ? 'Atualizado ao vivo' : lobby.connection === 'connecting' ? 'Carregando' : 'Offline'}
          </span>
        </div>
        {lobby.towers.length ? (
          <div className={styles.towerGrid}>
            {lobby.towers.map((tower) => (
              <a className={styles.towerCard} key={tower.id} href={`/jogo/torre/?id=${encodeURIComponent(tower.id)}`}>
                <TowerCover tower={tower} api={session.api} />
                <span className={styles.towerCardInfo}>
                  <span className={styles.towerCardTop}>
                    <span>{tower.blockCount} blocos</span><span aria-hidden="true">↗</span>
                  </span>
                  <strong>{tower.name}</strong>
                  <span className={styles.towerCardMeta}>Custo por bloco: {tower.cost} moedas</span>
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className={styles.emptyTowers}>
            {lobby.connection === 'connecting' ? 'Carregando torres…' : 'Nenhuma torre disponível ainda. Crie a primeira.'}
          </p>
        )}
        {lobby.pageCount > 1 && (
          <nav className={styles.pagination} aria-label="Paginação das torres">
            <button className={styles.secondary} disabled={lobby.page <= 1} onClick={() => void lobby.goToPage(lobby.page - 1)}>Anterior</button>
            <span>Página {lobby.page} de {lobby.pageCount}</span>
            <button className={styles.secondary} disabled={lobby.page >= lobby.pageCount} onClick={() => void lobby.goToPage(lobby.page + 1)}>Próxima</button>
          </nav>
        )}
      </section>
    </main>
  )
}
