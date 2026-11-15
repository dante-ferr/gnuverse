'use client'

import { useEffect } from 'react'
import { canManageTower } from '../../../core/authz/policy'
import { useRouter } from 'next/navigation'
import { AccountBanner } from './account/account-banner'
import { CreateTowerPanel } from './construction/create-tower-panel'
import { TreeScene } from './construction/tree-scene'
import { TreeControls } from './construction/tree-controls'
import { TowerToolbar } from './construction/tower-toolbar'
import { TowerCommunity } from './community/tower-community'
import { ProposalForm } from './community/proposal-form'
import { useGameController } from './hooks/use-game-controller'
import styles from './tower-game.module.css'

/** Page composition only. State, transport, scenes, forms and governance have their own modules. */
export function TowerGame() {
  const game = useGameController()
  const router = useRouter()
  const openLogin = () => {
    const destination = new URL(window.location.href)
    router.push(`/login/?next=${encodeURIComponent(destination.pathname + destination.search)}`)
  }
  const { session, lobby, live, feedback } = game
  const notice = feedback.notice || session.notice
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('novo'))
      game.setShowCreate(true)
  }, [game.setShowCreate])
  const treeRules = game.treeRules
  return (
    <main className={styles.gameShell}>
      <header className={styles.gameTopBar}>
        <AccountBanner
          user={session.user}
          wallet={session.wallet}
          secondsToCoin={session.secondsToCoin}
          busy={feedback.busy}
          onLogout={game.logout}
          onOpenAuth={() => openLogin()}
        />
        <TowerToolbar
          connection={game.connection}
          towerName={game.tower?.name}
          onCreate={() => game.setShowCreate(true)}
          canDelete={Boolean(
            game.tower && canManageTower(session.user ? { ...session.user, roles: session.user.roles ?? [] } : null, 'delete', game.tower.creatorId),
          )}
          onDelete={game.deleteTower}
        />
      </header>
      {game.connection === 'offline' && (
        <div className={styles.message} role="status">
          Servidor indisponível. Reconectando…
        </div>
      )}
      {feedback.error && !game.showCreate && (
        <div className={styles.error} role="alert">
          {feedback.error}
          <button aria-label="Fechar erro" onClick={() => feedback.setError('')}>
            ×
          </button>
        </div>
      )}
      {notice && (
        <p className={styles.message} role="status">
          {notice}
        </p>
      )}
      {game.showCreate && (
        <CreateTowerPanel
          key={game.rules ? 'ready' : 'loading'}
          busy={feedback.busy}
          error={feedback.error || (game.connection === 'offline' ? 'Servidor indisponível. Reconectando…' : '')}
          loading={!game.rules}
          loginHref={session.user ? undefined : `/login/?next=${encodeURIComponent(window.location.pathname + window.location.search + (window.location.search ? '&' : '?') + 'novo=1')}`}
          maxCost={Number(game.rules?.maxCost ?? 0)}
          defaultCost={Number(game.rules?.defaultCost ?? 0)}
          minContributions={Number(game.rules?.minContributions ?? 1)}
          onClose={() => game.setShowCreate(false)}
          onCreateTower={game.createTower}
        />
      )}
      {treeRules ? (
        <div className={styles.treePlayLayout}>
          <TreeScene
            frame={live.frame}
            tower={game.tower}
            treeRules={treeRules}
            growAnchor={game.growAnchor}
            growPreview={game.growPreview}
            camera={game.camera}
            onCameraChange={game.setCamera}
            onSelectNode={(node) => game.setSelected(node)}
            onGrowAnchor={game.setGrowAnchor}
            onGrowPreview={(point) => game.setGrowPreview(point)}
            onGrowCommit={game.growCommit}
          />
          <aside className={styles.gameSidebar}>
            <TreeControls
              user={session.user}
              wallet={session.wallet}
              tower={game.tower}
              frame={live.frame}
              selected={game.selected}
              treeRules={treeRules}
              busy={feedback.busy}
              isBanned={Boolean(game.member?.banned)}
              onLeaf={() => game.selected && game.perform('leaf', { nodeId: game.selected.id })}
              onFortify={() => game.selected && game.perform('fortify', { nodeId: game.selected.id })}
              onPrune={() => game.selected && game.perform('prune', { nodeId: game.selected.id })}
            />
            {live.state && (
              <TowerCommunity
                state={live.state}
                user={session.user}
                busy={feedback.busy}
                isBanned={Boolean(game.member?.banned)}
                tab={game.tab}
                onTabChange={game.setTab}
                onBan={(id) => game.openProposal({ type: 'ban', targetId: id })}
                onDecide={game.decide}
                onEligibility={game.setEligibility}
                onSettingsSave={game.saveSettings}
              />
            )}
          </aside>
        </div>
      ) : (
        <p className={styles.message} role="status">
          Carregando regras da árvore…
        </p>
      )}
      {game.proposalTarget && (
        <ProposalForm
          target={game.proposalTarget}
          busy={feedback.busy}
          onCancel={() => game.setProposalTarget(null)}
          onSubmit={game.propose}
        />
      )}
    </main>
  )
}