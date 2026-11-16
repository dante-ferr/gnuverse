'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { canManageTower } from '../../../../core/authz/policy'
import { createTowerFromForm } from '../api/create-tower'
import { AccountBanner } from '../account/account-banner'
import { CreateTowerPanel } from '../construction/create-tower-panel'
import { TowerToolbar } from '../construction/tower-toolbar'
import { useActionFeedback } from '../hooks/use-action-feedback'
import { useGameSession } from '../hooks/use-game-session'
import { useTowerLobby } from '../hooks/use-tower-lobby'
import { pipelineRulesFrom } from './model/frame'
import { usePipelineStream } from './hooks/use-pipeline-stream'
import { PipelineScene } from './scene/pipeline-scene'
import styles from '../tower-game.module.css'

/** Room chrome plus the grid. Game numbers stay on the canvas. */
export function PipelineRoom() {
  const session = useGameSession()
  const lobby = useTowerLobby(session.api)
  const live = usePipelineStream(session.api, lobby.towerId)
  const feedback = useActionFeedback()
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const rules = pipelineRulesFrom(live.rules ?? lobby.rules)
  const openLogin = () => {
    const destination = new URL(window.location.href)
    router.push(`/login/?next=${encodeURIComponent(destination.pathname + destination.search)}`)
  }
  useEffect(() => {
    if (!session.user || !lobby.towerId) return
    void session.api.request(`/api/towers/${lobby.towerId}/join`, {}).catch(() => {})
  }, [session.user, session.api, lobby.towerId])
  const place = (cells: { x: number; y: number; direction: string }[]) => {
    if (!session.user) {
      feedback.setError('Entre para colocar esteiras.')
      return
    }
    void feedback.run(async () => {
      await session.api.request(`/api/towers/${lobby.towerId}/place`, { cells })
      await live.refresh()
    })
  }
  const remove = (cell: { x: number; y: number }) => {
    if (!session.user) {
      feedback.setError('Entre para remover esteiras.')
      return
    }
    void feedback.run(async () => {
      await session.api.request(`/api/towers/${lobby.towerId}/remove`, cell)
      await live.refresh()
    })
  }
  return (
    <main className={styles.gameShell}>
      <header className={styles.gameTopBar}>
        <TowerToolbar
          connection={lobby.towerId ? live.connection : lobby.connection}
          towerName={live.name}
          onCreate={() => setShowCreate(true)}
          canDelete={Boolean(
            session.user &&
              live.creatorId &&
              canManageTower(
                { ...session.user, roles: session.user.roles ?? [] },
                'delete',
                live.creatorId,
              ),
          )}
          onDelete={() =>
            feedback.run(async () => {
              await session.api.request(`/api/towers/${lobby.towerId}`, undefined, 'DELETE')
              lobby.setTowerId('')
            })
          }
        />
        <AccountBanner
          user={session.user}
          wallet={session.wallet}
          secondsToCoin={session.secondsToCoin}
          busy={feedback.busy}
          onLogout={() => feedback.run(session.logout)}
          onOpenAuth={openLogin}
        />
      </header>
      {feedback.error && (
        <div className={styles.playToast} role="alert">
          {feedback.error}
        </div>
      )}
      {showCreate && (
        <CreateTowerPanel
          busy={feedback.busy}
          error={feedback.error}
          loading={!lobby.rules}
          loginHref={
            session.user
              ? undefined
              : `/login/?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
          }
          maxCost={Number(lobby.rules?.maxCost ?? 0)}
          defaultCost={Number(lobby.rules?.defaultCost ?? 0)}
          minContributions={Number(lobby.rules?.minContributions ?? 1)}
          onClose={() => setShowCreate(false)}
          onCreateTower={(form) =>
            feedback.run(async () => {
              const result = await createTowerFromForm(session.api, form)
              setShowCreate(false)
              lobby.setTowerId(result.tower.id)
            })
          }
        />
      )}
      {lobby.towerId ? (
        <PipelineScene frame={live.frame.seed ? live.frame : null} rules={rules} onPlace={place} onRemove={remove} />
      ) : (
        <p className={styles.message} role="status">
          Nenhuma sala ainda. Crie uma para ligar a fonte ao núcleo.
        </p>
      )}
    </main>
  )
}
