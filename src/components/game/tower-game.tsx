'use client'

import { AccountBanner } from './account/account-banner'
import { AuthPanel } from './account/auth-panel'
import { BlockControls } from './construction/block-controls'
import { CreateTowerPanel } from './construction/create-tower-panel'
import { TowerScene } from './construction/tower-scene'
import { TowerToolbar } from './construction/tower-toolbar'
import { TowerCommunity } from './community/tower-community'
import { ProposalForm } from './community/proposal-form'
import { useGameController } from './hooks/use-game-controller'
import styles from './tower-game.module.css'

/** Page composition only. State, transport, scenes, forms and governance have their own modules. */
export function TowerGame() {
  const game = useGameController()
  const { session, lobby, live, feedback, placement } = game
  const notice = feedback.notice || session.notice
  return (
    <main className={styles.game}>
      <AccountBanner
        user={session.user}
        wallet={session.wallet}
        secondsToCoin={session.secondsToCoin}
        busy={feedback.busy}
        onLogout={game.logout}
        onOpenAuth={() => game.setShowAuth(true)}
      />
      <TowerToolbar
        towers={lobby.towers}
        towerId={lobby.towerId}
        connection={game.connection}
        onSelect={(id) => {
          lobby.setTowerId(id)
          feedback.setError('')
        }}
        onCreate={() =>
          session.user
            ? game.setShowCreate(!game.showCreate)
            : game.setShowAuth(true)
        }
      />
      {game.connection === 'offline' && (
        <div className={styles.message} role="status">
          Servidor indisponível. Reconectando…
        </div>
      )}
      {feedback.error && (
        <div className={styles.error} role="alert">
          {feedback.error}
          <button
            aria-label="Fechar erro"
            onClick={() => feedback.setError('')}
          >
            ×
          </button>
        </div>
      )}
      {notice && (
        <p className={styles.message} role="status">
          {notice}
        </p>
      )}
      {game.showAuth && (
        <AuthPanel
          mode={game.authMode}
          busy={feedback.busy}
          onClose={() => game.setShowAuth(false)}
          onSubmit={game.authenticate}
          onToggleMode={() => {
            game.setAuthMode(
              game.authMode === 'register' ? 'login' : 'register',
            )
            feedback.setError('')
          }}
        />
      )}
      {game.showCreate && (
        <CreateTowerPanel
          busy={feedback.busy}
          maxCost={Number(game.rules?.maxCost ?? 20)}
          defaultCost={Number(game.rules?.defaultCost ?? 1)}
          blockIntervalMs={Number(game.rules?.cooldownMs ?? 2000)}
          windMinBlocks={Number(game.rules?.windMinBlocks ?? 15)}
          windEveryBlocks={Number(game.rules?.windEveryBlocks ?? 10)}
          minContributions={Number(game.rules?.minContributions ?? 3)}
          onClose={() => game.setShowCreate(false)}
          onCreateTower={game.createTower}
        />
      )}
      <div className={styles.playLayout}>
        <TowerScene
          frame={live.frame}
          preview={game.preview}
          tower={game.tower}
          {...placement}
          maxBlocks={Number(game.rules?.maxBlocks ?? 100)}
          onPositionChange={(x, y) =>
            game.setPlacement((current) => ({ ...current, x, y }))
          }
          onPreviewClose={() => game.setPreview(null)}
        />
        <BlockControls
          kind={placement.kind}
          x={placement.x}
          y={placement.y}
          angle={placement.angle}
          onKindChange={(kind) =>
            game.setPlacement((current) => ({ ...current, kind }))
          }
          onXChange={(x) => game.setPlacement((current) => ({ ...current, x }))}
          onYChange={(y) => game.setPlacement((current) => ({ ...current, y }))}
          onAngleChange={(angle) =>
            game.setPlacement((current) => ({ ...current, angle }))
          }
          canPlace={game.canPlace}
          busy={feedback.busy}
          user={session.user}
          wallet={session.wallet}
          tower={game.tower}
          isBanned={Boolean(game.member?.banned)}
          preview={game.preview}
          checkpointPending={live.frame.checkpointPending}
          cooldownRemainingMs={live.frame.cooldownRemainingMs}
          blocksUntilCheckpoint={live.frame.blocksUntilCheckpoint}
          wind={live.frame.wind}
          onPlace={game.place}
        />
      </div>
      {live.state && (
        <TowerCommunity
          state={live.state}
          user={session.user}
          busy={feedback.busy}
          isBanned={Boolean(game.member?.banned)}
          tab={game.tab}
          onTabChange={game.setTab}
          onPreview={game.setPreview}
          onRestore={(version) =>
            game.openProposal(
              { type: 'restore', targetId: version.id },
              version,
            )
          }
          onBan={(id) => game.openProposal({ type: 'ban', targetId: id })}
          onVote={game.vote}
          onDecide={game.decide}
          onEligibility={game.setEligibility}
          onSettingsSave={game.saveSettings}
        />
      )}
      {game.proposalTarget && (
        <ProposalForm
          key={`${game.proposalTarget.type}-${game.proposalTarget.targetId}`}
          target={game.proposalTarget}
          busy={feedback.busy}
          onCancel={() => game.setProposalTarget(null)}
          onSubmit={game.propose}
        />
      )}
    </main>
  )
}
