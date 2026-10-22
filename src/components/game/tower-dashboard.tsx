'use client'

import { useTowerLobby } from './hooks/use-tower-lobby'
import { useGameSession } from './hooks/use-game-session'
import { TowerCover } from './construction/tower-cover'
import styles from './tower-game.module.css'

export function TowerDashboard() {
  const session = useGameSession()
  const lobby = useTowerLobby(session.api)

  return (
    <main className={styles.game}>
      <header className={styles.dashboardPageHeading}>
        <div>
          <p className={styles.eyebrow}>GNUverse · Comunidade</p>
          <h1>Torres colaborativas</h1>
          <p>Escolha uma torre para acompanhar e construir com a comunidade.</p>
        </div>
        <a className={styles.primary} href="/jogo/torre/?novo=1">Criar torre</a>
      </header>

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
