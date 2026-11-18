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
import { RoomSidebar } from './room-sidebar'
import { PipelineScene, type EditMode } from './scene/pipeline-scene'
import {
  defaultStructureId,
  getStructure,
  type StructurePlaceRequest,
} from './structures'
import styles from '../game-shell.module.css'

function roomLoginHref() {
  if (typeof window === 'undefined') return '/login/'
  return `/login/?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
}

/** Room chrome, compact sidebar, and the grid canvas. */
export function PipelineRoom() {
  const session = useGameSession()
  const lobby = useRoomLobby(session.api)
  const live = usePipelineStream(session.api, lobby.roomId)
  const feedback = useActionFeedback()
  const router = useRouter()
  const [loginHref, setLoginHref] = useState('/login/')
  const [editMode, setEditMode] = useState<EditMode>('create')
  const [structureId, setStructureId] = useState(defaultStructureId)
  const chatMaxLength =
    typeof live.rules?.chatMessageMaxLength === 'number' && live.rules.chatMessageMaxLength > 0
      ? live.rules.chatMessageMaxLength
      : 280
  const [showCreate, setShowCreate] = useState(false)
  const rules = pipelineRulesFrom(live.rules ?? lobby.rules)
  const isAdmin = Boolean(session.user?.roles?.includes('admin'))
  useEffect(() => {
    setLoginHref(roomLoginHref())
  }, [lobby.roomId])
  const openLogin = () => {
    router.push(roomLoginHref())
  }
  useEffect(() => {
    if (!session.user || !lobby.roomId) return
    void session.api.request(`/api/towers/${lobby.roomId}/join`, {}).catch(() => {})
  }, [session.user, session.api, lobby.roomId])
  const place = (request: StructurePlaceRequest) => {
    const structure = getStructure(request.structureId)
    if (!structure) return
    if (!session.user) {
      feedback.setError(structure.signInMessage)
      return
    }
    void feedback.run(async () => {
      await structure.commit(
        {
          roomId: lobby.roomId,
          request: (path, body, method) => session.api.request(path, body, method),
        },
        request.payload,
      )
      await live.refresh()
    })
  }
  const removeRefresh = useRef<ReturnType<typeof setTimeout> | null>(null)
  const advance = () => {
    if (!session.user || !isAdmin) return
    void feedback.run(async () => {
      await session.api.request(`/api/towers/${lobby.roomId}/advance`, {})
      await live.refresh()
    })
  }
  const sendChat = (text: string) => {
    if (!session.user) {
      router.push(loginHref)
      return
    }
    void feedback.run(async () => {
      await session.api.request(`/api/towers/${lobby.roomId}/chat`, { text })
    })
  }
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
          canAdvance={Boolean(lobby.roomId && isAdmin)}
          onAdvance={advance}
          busy={feedback.busy}
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
        <div className={styles.pipelinePlay}>
          <div className={styles.sceneViewport}>
            <PipelineScene
              frame={live.frame.seed ? live.frame : null}
              rules={rules}
              editMode={editMode}
              structureId={structureId}
              onPlace={place}
              onRemove={remove}
              onToggleEditMode={() =>
                setEditMode((current) => (current === 'create' ? 'delete' : 'create'))
              }
            />
          </div>
          <RoomSidebar
            frame={live.frame.seed ? live.frame : null}
            rules={rules}
            structureId={structureId}
            onSelectStructure={setStructureId}
            editMode={editMode}
            onEditModeChange={setEditMode}
            api={session.api}
            roomId={lobby.roomId}
            user={session.user}
            creatorId={live.creatorId}
            members={live.members}
            proposals={live.proposals}
            chat={live.chat}
            loginHref={loginHref}
            chatMaxLength={chatMaxLength}
            busy={feedback.busy}
            onRefresh={live.refresh}
            onError={feedback.setError}
            onSendChat={sendChat}
          />
        </div>
      ) : (
        <p className={styles.message} role="status">
          Nenhuma sala ainda. Crie uma para ligar a fonte ao núcleo.
        </p>
      )}
    </main>
  )
}
