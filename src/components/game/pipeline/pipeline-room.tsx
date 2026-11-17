'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { canManageRoom } from '../../../../core/authz/policy'
import { createRoomFromForm } from '../api/create-room'
import { AccountBanner } from '../account/account-banner'
import { CreateRoomPanel } from '../construction/create-room-panel'
import { RoomToolbar } from '../construction/room-toolbar'
import { useActionFeedback } from '../hooks/use-action-feedback'
import { useGameSession } from '../hooks/use-game-session'
import { useRoomLobby } from '../hooks/use-room-lobby'
import { pipelineRulesFrom } from './model/frame'
import { usePipelineStream } from './hooks/use-pipeline-stream'
import { PipelineScene } from './scene/pipeline-scene'
import styles from '../game-shell.module.css'

/** Room chrome plus the grid. Game numbers stay on the canvas. */
export function PipelineRoom() {
  const session = useGameSession()
  const lobby = useRoomLobby(session.api)
  const live = usePipelineStream(session.api, lobby.roomId)
  const feedback = useActionFeedback()
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const rules = pipelineRulesFrom(live.rules ?? lobby.rules)
  const openLogin = () => {
    const destination = new URL(window.location.href)
    router.push(`/login/?next=${encodeURIComponent(destination.pathname + destination.search)}`)
  }
  useEffect(() => {
    if (!session.user || !lobby.roomId) return
    void session.api.request(`/api/towers/${lobby.roomId}/join`, {}).catch(() => {})
  }, [session.user, session.api, lobby.roomId])
  const place = (cells: { x: number; y: number; direction: string }[]) => {
    if (!session.user) {
      feedback.setError('Entre para colocar esteiras.')
      return
    }
    void feedback.run(async () => {
      await session.api.request(`/api/towers/${lobby.roomId}/place`, { cells })
      await live.refresh()
    })
  }
  const removeRefresh = useRef<ReturnType<typeof setTimeout> | null>(null)
  const remove = (cells: { x: number; y: number }[]) => {
    if (cells.length === 0) return
    if (!session.user) {
      feedback.setError('Entre para remover esteiras.')
      return
    }
    for (const cell of cells) {
      void session.api
        .request(`/api/towers/${lobby.roomId}/remove`, cell)
        .catch((cause) => {
          feedback.setError(
            cause instanceof Error
              ? cause.message
              : 'O servidor não respondeu. Confira a conexão.',
          )
        })
        .finally(() => {
          if (removeRefresh.current) clearTimeout(removeRefresh.current)
          removeRefresh.current = setTimeout(() => {
            removeRefresh.current = null
            void live.refresh()
          }, 60)
        })
    }
  }
  return (
    <main className={styles.gameShell}>
      <header className={styles.gameTopBar}>
        <RoomToolbar
          connection={lobby.roomId ? live.connection : lobby.connection}
          roomName={live.name}
          onCreate={() => setShowCreate(true)}
          canDelete={Boolean(
            session.user &&
              live.creatorId &&
              canManageRoom(
                { ...session.user, roles: session.user.roles ?? [] },
                'delete',
                live.creatorId,
              ),
          )}
          onDelete={() =>
            feedback.run(async () => {
              await session.api.request(`/api/towers/${lobby.roomId}`, undefined, 'DELETE')
              lobby.setRoomId('')
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
        <CreateRoomPanel
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
          onCreateRoom={(form) =>
            feedback.run(async () => {
              const result = await createRoomFromForm(session.api, form)
              setShowCreate(false)
              lobby.setRoomId(result.room.id)
            })
          }
        />
      )}
      {lobby.roomId ? (
        <PipelineScene frame={live.frame.seed ? live.frame : null} rules={rules} onPlace={place} onRemove={remove} />
      ) : (
        <p className={styles.message} role="status">
          Nenhuma sala ainda. Crie uma para ligar a fonte ao núcleo.
        </p>
      )}
    </main>
  )
}