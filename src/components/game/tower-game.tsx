'use client'

import { useEffect, useState } from 'react'
import { canManageTower } from '../../../core/authz/policy'
import { useRouter } from 'next/navigation'
import { AccountBanner } from './account/account-banner'
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
  const router = useRouter()
  const openLogin = () => {
    const destination = new URL(window.location.href)
    router.push(`/login/?next=${encodeURIComponent(destination.pathname + destination.search)}`)
  }
  const { session, lobby, live, feedback, placement } = game
  const [spaceExpanded, setSpaceExpanded] = useState(false)
  const notice = feedback.notice || session.notice
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('novo'))
      game.setShowCreate(true)
  }, [game.setShowCreate])
  return (
    <main className={spaceExpanded ? `${styles.game} ${styles.gameExpanded}` : styles.game}>
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
        onCreate={() => game.setShowCreate(true)}
        canDelete={Boolean(
          game.tower && canManageTower(session.user ? { ...session.user, roles: session.user.roles ?? [] } : null, 'delete', game.tower.creatorId),
        )}
        onDelete={game.deleteTower}
      />
      {game.connection === 'offline' && (
        <div className={styles.message} role="status">
          Servidor indisponível. Reconectando…
        </div>
      )}
      {feedback.error && !game.showCreate && (
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
      {game.showCreate && (
        <CreateTowerPanel
          key={game.rules ? 'ready' : 'loading'}
          busy={feedback.busy}
          error={feedback.error || (game.connection === 'offline' ? 'Servidor indisponível. Reconectando…' : '')}
          loading={!game.rules}
          loginHref={session.user ? undefined : `/login/?next=${encodeURIComponent(window.location.pathname + window.location.search + (window.location.search ? '&' : '?') + 'novo=1')}`}
          maxCost={Number(game.rules?.maxCost ?? 0)}
          defaultCost={Number(game.rules?.defaultCost ?? 0)}
          blockIntervalMs={Number(game.rules?.cooldownMs ?? 0)}
          windMinBlocks={Number(game.rules?.windMinBlocks ?? 1)}
          windEveryBlocks={Number(game.rules?.windEveryBlocks ?? 1)}
          minContributions={Number(game.rules?.minContributions ?? 1)}
          onClose={() => game.setShowCreate(false)}
          onCreateTower={game.createTower}
        />
      )}
      <div className={spaceExpanded ? `${styles.playLayout} ${styles.playExpanded}` : styles.playLayout}>
        <TowerScene
          frame={live.frame}
          preview={game.preview}
          tower={game.tower}
          {...placement}
          maxBlocks={Number(game.rules?.maxBlocks ?? 100)}
          expanded={spaceExpanded}
          onToggleExpanded={() => setSpaceExpanded((current) => !current)}
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
          onAdminRestore={game.adminRestore}
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
